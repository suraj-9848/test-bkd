import { Request, Response } from "express";
import { Test, TestStatus } from "../../db/mysqlModels/Test";
import { Question, QuestionType } from "../../db/mysqlModels/Question";
import { TestAttempt, AttemptStatus } from "../../db/mysqlModels/TestAttempt";
import { TestAnswer } from "../../db/mysqlModels/TestAnswer";
import { User } from "../../db/mysqlModels/User";
import {
  getSingleRecord,
  getAllRecordsWithFilter,
  updateRecords,
} from "../../lib/dbLib/sqlUtils";
import { redisClient } from "../../db/connect";

const logger = require("../../utils/logger").getLoggerByName("Test Evaluation");

// Get all test attempts for evaluation
export const getTestAttempts = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    // Check if test exists
    const test = await getSingleRecord<Test, any>(
      Test,
      { where: { id: testId } },
      `test_${testId}_basic`,
      true,
    );

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    // Get all attempts for this test
    const attempts = await getAllRecordsWithFilter<TestAttempt, any>(
      TestAttempt,
      {
        where: { test: { id: testId } },
        relations: ["student"],
      },
      `test_${testId}_attempts`,
      true,
      300, // Cache for 5 minutes
    );

    // Format response
    const formattedAttempts = attempts.map((attempt) => ({
      id: attempt.id,
      student: {
        id: attempt.student.id,
        name: attempt.student.username,
      },
      status: attempt.status,
      score: attempt.score,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      needsEvaluation: attempt.status === AttemptStatus.SUBMITTED,
      isComplete: attempt.status === AttemptStatus.EVALUATED,
    }));

    return res.status(200).json({
      message: "Test attempts retrieved successfully",
      attempts: formattedAttempts,
    });
  } catch (error) {
    logger.error("Error fetching test attempts:", error);
    return res.status(500).json({ error: "Failed to fetch test attempts" });
  }
};

// Get a specific test attempt for grading
export const getAttemptForGrading = async (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;

    const attempt = await getSingleRecord<TestAttempt, any>(TestAttempt, {
      where: { id: attemptId },
      relations: ["test", "student", "answers", "answers.question"],
    });

    if (!attempt) {
      return res.status(404).json({ error: "Test attempt not found" });
    }

    // Organize the response by question types
    const mcqAnswers = [];
    const descriptiveAnswers = [];

    for (const answer of attempt.answers) {
      const answerData = {
        id: answer.id,
        question: {
          id: answer.question.id,
          text: answer.question.question_text,
          marks: answer.question.marks,
        },
        isEvaluated: answer.isEvaluated,
        score: answer.score,
        feedback: answer.feedback,
      };

      if (answer.question.type === QuestionType.MCQ) {
        // For MCQs, include selected options and correctness
        mcqAnswers.push({
          ...answerData,
          selectedOptions: answer.selectedOptions,
        });
      } else {
        // For descriptive, include the text answer
        descriptiveAnswers.push({
          ...answerData,
          textAnswer: answer.textAnswer,
          expectedWordCount: answer.question.expectedWordCount,
        });
      }
    }

    return res.status(200).json({
      message: "Test attempt retrieved successfully",
      attempt: {
        id: attempt.id,
        test: {
          id: attempt.test.id,
          title: attempt.test.title,
          maxMarks: attempt.test.maxMarks,
          passingMarks: attempt.test.passingMarks,
        },
        student: {
          id: attempt.student.id,
          name: attempt.student.username,
        },
        status: attempt.status,
        score: attempt.score,
        submittedAt: attempt.submittedAt,
        mcqAnswers,
        descriptiveAnswers,
        needsEvaluation: attempt.status === AttemptStatus.SUBMITTED,
      },
    });
  } catch (error) {
    logger.error("Error fetching test attempt for grading:", error);
    return res.status(500).json({ error: "Failed to fetch test attempt" });
  }
};

// Grade descriptive answers
export const gradeDescriptiveAnswers = async (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;
    const { evaluations } = req.body;

    if (
      !evaluations ||
      !Array.isArray(evaluations) ||
      evaluations.length === 0
    ) {
      return res.status(400).json({ error: "Invalid evaluation data" });
    }

    const attempt = await getSingleRecord<TestAttempt, any>(TestAttempt, {
      where: { id: attemptId },
      relations: ["test", "answers", "answers.question"],
    });

    if (!attempt) {
      return res.status(404).json({ error: "Test attempt not found" });
    }

    // Only allow grading submissions
    if (attempt.status !== AttemptStatus.SUBMITTED) {
      return res.status(400).json({
        error:
          attempt.status === AttemptStatus.EVALUATED
            ? "This attempt has already been evaluated"
            : "This attempt is not yet submitted",
      });
    }

    // Process each evaluation
    for (const evaluation of evaluations) {
      const { answerId, score, feedback } = evaluation;

      // Find the answer in this attempt
      const answer = attempt.answers.find((a) => a.id === answerId);

      if (!answer) {
        return res.status(404).json({
          error: `Answer ${answerId} not found in this attempt`,
        });
      }

      // Validate score
      if (score < 0 || score > answer.question.marks) {
        return res.status(400).json({
          error: `Invalid score for answer ${answerId}. Score must be between 0 and ${answer.question.marks}`,
        });
      }

      // Update the answer
      answer.score = score;
      answer.feedback = feedback || "";
      answer.isEvaluated = true;
      await answer.save();
    }

    // Check if all answers are now evaluated
    const allEvaluated = attempt.answers.every((answer) => answer.isEvaluated);

    if (allEvaluated) {
      // Calculate total score
      const totalScore = attempt.answers.reduce(
        (sum, answer) => sum + (answer.score || 0),
        0,
      );

      // Update attempt
      attempt.status = AttemptStatus.EVALUATED;
      attempt.score = totalScore;
      await attempt.save();

      // Update the leaderboard in Redis
      await updateTestLeaderboard(attempt.test.id);

      // Clear any cached results for this test
      await redisClient.del(`test:${attempt.test.id}:results`);
    }

    return res.status(200).json({
      message: "Answers graded successfully",
      fullyEvaluated: allEvaluated,
      status: attempt.status,
      score: allEvaluated ? attempt.score : null,
    });
  } catch (error) {
    logger.error("Error grading descriptive answers:", error);
    return res.status(500).json({ error: "Failed to grade answers" });
  }
};

// Finalize grading of a test attempt
export const finalizeGrading = async (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;

    const attempt = await getSingleRecord<TestAttempt, any>(TestAttempt, {
      where: { id: attemptId },
      relations: ["test", "answers"],
    });

    if (!attempt) {
      return res.status(404).json({ error: "Test attempt not found" });
    }

    // Can only finalize submitted attempts
    if (attempt.status !== AttemptStatus.SUBMITTED) {
      return res.status(400).json({
        error:
          attempt.status === AttemptStatus.EVALUATED
            ? "This attempt has already been evaluated"
            : "This attempt is not yet submitted",
      });
    }

    // Check if all descriptive answers have been graded
    const ungraded = attempt.answers.filter(
      (answer) =>
        answer.question.type === QuestionType.DESCRIPTIVE &&
        !answer.isEvaluated,
    );

    if (ungraded.length > 0) {
      return res.status(400).json({
        error: `Cannot finalize: ${ungraded.length} descriptive answers still need evaluation`,
      });
    }

    // Calculate total score
    const totalScore = attempt.answers.reduce(
      (sum, answer) => sum + (answer.score || 0),
      0,
    );

    // Update attempt
    attempt.status = AttemptStatus.EVALUATED;
    attempt.score = totalScore;
    await attempt.save();

    // Update the leaderboard in Redis
    await updateTestLeaderboard(attempt.test.id);

    // Clear any cached results for this test
    await redisClient.del(`test:${attempt.test.id}:results`);

    return res.status(200).json({
      message: "Test grading finalized successfully",
      status: attempt.status,
      score: attempt.score,
    });
  } catch (error) {
    logger.error("Error finalizing grading:", error);
    return res.status(500).json({ error: "Failed to finalize grading" });
  }
};

// Get test statistics with evaluations summary
export const getEvaluationStats = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    // Try to get from cache first
    const cacheKey = `test:${testId}:evaluation_stats`;
    const cachedStats = await redisClient.get(cacheKey);

    if (cachedStats) {
      return res.status(200).json(JSON.parse(cachedStats));
    }

    const test = await getSingleRecord<Test, any>(Test, {
      where: { id: testId },
      relations: ["questions"],
    });

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const attempts = await getAllRecordsWithFilter<TestAttempt, any>(
      TestAttempt,
      { where: { test: { id: testId } } },
    );

    // Calculate statistics
    const totalAttempts = attempts.length;
    const submittedAttempts = attempts.filter(
      (a) =>
        a.status === AttemptStatus.SUBMITTED ||
        a.status === AttemptStatus.EVALUATED,
    ).length;
    const evaluatedAttempts = attempts.filter(
      (a) => a.status === AttemptStatus.EVALUATED,
    ).length;
    const pendingEvaluations = submittedAttempts - evaluatedAttempts;

    // Distribution of scores (for evaluated attempts)
    const evaluatedScores = attempts
      .filter((a) => a.status === AttemptStatus.EVALUATED)
      .map((a) => a.score);

    const scoreDistribution = {};
    if (evaluatedScores.length > 0) {
      // Create score ranges (0-10%, 10-20%, etc.)
      const rangeSize = 10;
      for (let i = 0; i < 100; i += rangeSize) {
        const min = (i / 100) * test.maxMarks;
        const max = ((i + rangeSize) / 100) * test.maxMarks;
        const count = evaluatedScores.filter(
          (score) => score >= min && score < max,
        ).length;
        scoreDistribution[`${i}-${i + rangeSize}%`] = count;
      }
    }

    const stats = {
      testId: test.id,
      title: test.title,
      totalQuestions: test.questions.length,
      mcqCount: test.questions.filter((q) => q.type === QuestionType.MCQ)
        .length,
      descriptiveCount: test.questions.filter(
        (q) => q.type === QuestionType.DESCRIPTIVE,
      ).length,
      totalAttempts,
      submittedAttempts,
      evaluatedAttempts,
      pendingEvaluations,
      scoreDistribution,
    };

    // Cache the statistics
    await redisClient.set(
      cacheKey,
      JSON.stringify({
        message: "Evaluation statistics retrieved successfully",
        statistics: stats,
      }),
      { EX: 300 }, // Cache for 5 minutes
    );

    return res.status(200).json({
      message: "Evaluation statistics retrieved successfully",
      statistics: stats,
    });
  } catch (error) {
    logger.error("Error fetching evaluation statistics:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch evaluation statistics" });
  }
};

// Helper function to update leaderboard in Redis
const updateTestLeaderboard = async (testId: string): Promise<void> => {
  try {
    const attempts = await getAllRecordsWithFilter<TestAttempt, any>(
      TestAttempt,
      {
        where: {
          test: { id: testId },
          status: AttemptStatus.EVALUATED,
        },
        relations: ["student"],
      },
    );

    if (!attempts || attempts.length === 0) {
      return;
    }

    // Format leaderboard data
    const leaderboard = attempts
      .map((attempt) => ({
        attemptId: attempt.id,
        studentId: attempt.student.id,
        studentName: attempt.student.username,
        score: attempt.score || 0,
        submittedAt: attempt.submittedAt,
      }))
      .sort((a, b) => {
        // Sort by score first (descending)
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        // Then by submission time (ascending) for tiebreaker
        return (
          new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
        );
      });

    // Cache the leaderboard
    await redisClient.set(
      `test:${testId}:leaderboard`,
      JSON.stringify(leaderboard),
      { EX: 3600 }, // Cache for 1 hour
    );
  } catch (error) {
    logger.error("Error updating leaderboard:", error);
  }
};
