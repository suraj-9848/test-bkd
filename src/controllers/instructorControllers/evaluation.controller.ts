import { Request, Response } from "express";
import { TestSubmission } from "../../db/mysqlModels/TestSubmission";
import { TestResponse } from "../../db/mysqlModels/TestResponse";
import { Test } from "../../db/mysqlModels/Test";
import { Question, QuestionType } from "../../db/mysqlModels/Question";
import {
  getSingleRecord,
  getAllRecordsWithFilter,
  updateRecords,
} from "../../lib/dbLib/sqlUtils";
import { getLogger } from "../../utils/logger";

const logger = getLogger();

// Get all test submissions that need evaluation (descriptive/code questions only)
export const getSubmissionsForEvaluation = async (
  req: Request,
  res: Response,
) => {
  try {
    const { testId } = req.params;
    const { status } = req.query;

    // Validate test exists
    const test = await getSingleRecord(Test, {
      where: { id: testId },
      relations: ["questions"],
    });

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    // Build filter conditions
    const whereCondition: any = {
      test: { id: testId },
    };

    // Filter by status if provided
    if (
      status &&
      ["SUBMITTED", "PARTIALLY_EVALUATED", "FULLY_EVALUATED"].includes(
        status as string,
      )
    ) {
      whereCondition.status = status;
    }

    // Get all submissions for this test
    const submissions = await getAllRecordsWithFilter(TestSubmission, {
      where: whereCondition,
      relations: ["user", "responses", "responses.question"],
      order: { submittedAt: "DESC" },
    });

    // Filter submissions that have descriptive/code questions needing evaluation
    const submissionsNeedingEvaluation = submissions.filter((submission) => {
      return submission.responses.some(
        (response) =>
          (response.question.type === QuestionType.DESCRIPTIVE ||
            response.question.type === QuestionType.CODE) &&
          response.evaluationStatus === "PENDING",
      );
    });

    const formattedSubmissions = submissionsNeedingEvaluation.map(
      (submission) => {
        const descriptiveResponses = submission.responses.filter(
          (response) =>
            response.question.type === QuestionType.DESCRIPTIVE ||
            response.question.type === QuestionType.CODE,
        );

        const pendingCount = descriptiveResponses.filter(
          (r) => r.evaluationStatus === "PENDING",
        ).length;
        const evaluatedCount = descriptiveResponses.filter(
          (r) => r.evaluationStatus === "EVALUATED",
        ).length;

        return {
          submissionId: submission.id,
          student: {
            id: submission.user.id,
            name: submission.user.username || submission.user.email,
          },
          submittedAt: submission.submittedAt,
          status: submission.status,
          totalDescriptiveQuestions: descriptiveResponses.length,
          pendingEvaluations: pendingCount,
          evaluatedQuestions: evaluatedCount,
          mcqScore: submission.mcqScore || 0,
          totalScore: submission.totalScore || 0,
          needsEvaluation: pendingCount > 0,
        };
      },
    );

    return res.status(200).json({
      message: "Submissions retrieved successfully",
      data: {
        testTitle: test.title,
        totalSubmissions: formattedSubmissions.length,
        submissions: formattedSubmissions,
      },
    });
  } catch (error) {
    logger.error("Error fetching submissions for evaluation:", error);
    return res.status(500).json({ error: "Failed to fetch submissions" });
  }
};

// Get detailed submission for evaluation with descriptive/code responses only
export const getSubmissionForEvaluation = async (
  req: Request,
  res: Response,
) => {
  try {
    const { submissionId } = req.params;

    // Get submission with all relations
    const submission = await getSingleRecord(TestSubmission, {
      where: { id: submissionId },
      relations: [
        "test",
        "user",
        "responses",
        "responses.question",
        "responses.question.options",
      ],
    });

    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    // Filter only descriptive and code responses
    const descriptiveAndCodeResponses = submission.responses.filter(
      (response) =>
        response.question.type === QuestionType.DESCRIPTIVE ||
        response.question.type === QuestionType.CODE,
    );

    const formattedResponses = descriptiveAndCodeResponses.map((response) => ({
      responseId: response.id,
      question: {
        id: response.question.id,
        text: response.question.question_text,
        type: response.question.type,
        marks: response.question.marks,
        expectedWordCount: response.question.expectedWordCount,
        codeLanguage: response.question.codeLanguage,
      },
      answer: response.answer,
      currentScore: response.score || 0,
      evaluationStatus: response.evaluationStatus,
      evaluatorComments: response.evaluatorComments,
      isEvaluated: response.evaluationStatus === "EVALUATED",
    }));

    // Calculate evaluation statistics
    const totalResponses = formattedResponses.length;
    const evaluatedResponses = formattedResponses.filter(
      (r) => r.isEvaluated,
    ).length;
    const pendingResponses = totalResponses - evaluatedResponses;

    return res.status(200).json({
      message: "Submission details retrieved successfully",
      data: {
        submission: {
          id: submission.id,
          submittedAt: submission.submittedAt,
          status: submission.status,
          mcqScore: submission.mcqScore || 0,
          currentTotalScore: submission.totalScore || 0,
        },
        test: {
          id: submission.test.id,
          title: submission.test.title,
          maxMarks: submission.test.maxMarks,
          passingMarks: submission.test.passingMarks,
        },
        student: {
          id: submission.user.id,
          name: submission.user.username || submission.user.email,
        },
        evaluation: {
          totalDescriptiveQuestions: totalResponses,
          evaluatedQuestions: evaluatedResponses,
          pendingQuestions: pendingResponses,
          isFullyEvaluated: pendingResponses === 0,
        },
        responses: formattedResponses,
      },
    });
  } catch (error) {
    logger.error("Error fetching submission for evaluation:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch submission details" });
  }
};

// Evaluate individual response (descriptive/code only)
export const evaluateResponse = async (req: Request, res: Response) => {
  try {
    // Accept responseId from body or params for flexibility
    const responseId = req.body.responseId || req.params.responseId;
    const { score, comments } = req.body;

    // Validate input
    if (typeof score !== "number" || score < 0) {
      return res
        .status(400)
        .json({ error: "Valid score is required (must be >= 0)" });
    }

    // Get response with question details
    const response = await getSingleRecord(TestResponse, {
      where: { id: responseId },
      relations: ["question", "submission", "submission.test"],
    });

    if (!response) {
      return res.status(404).json({ error: "Response not found" });
    }

    // Only allow manual grading for DESCRIPTIVE or CODE
    if (response.question.type === QuestionType.MCQ) {
      return res.status(400).json({
        error:
          "MCQ questions are automatically evaluated and cannot be manually graded",
      });
    }

    // Validate score doesn't exceed question marks
    if (score > response.question.marks) {
      return res.status(400).json({
        error: `Score cannot exceed maximum marks (${response.question.marks})`,
      });
    }

    // Update the response
    const updateResult = await updateRecords(
      TestResponse,
      { id: responseId },
      {
        score: score,
        evaluationStatus: "EVALUATED",
        evaluatorComments: comments || null,
        // isEvaluated: true, // <-- REMOVE THIS LINE
      },
      false,
    );

    if (!updateResult) {
      return res.status(500).json({ error: "Failed to update response" });
    }

    // Get updated submission to recalculate total score
    const submission = await getSingleRecord(TestSubmission, {
      where: { id: response.submission.id },
      relations: ["responses", "responses.question"],
    });

    // Calculate new total score (MCQ + evaluated descriptive/code)
    const evaluatedResponses = submission.responses.filter(
      (r) =>
        (r.evaluationStatus === "EVALUATED" ||
          r.question.type === QuestionType.MCQ) &&
        typeof r.score === "number",
    );
    const totalScore = evaluatedResponses.reduce(
      (sum, resp) => sum + (resp.score || 0),
      0,
    );

    // Check if all non-MCQ questions are now evaluated
    const nonMcqResponses = submission.responses.filter(
      (r) => r.question.type !== QuestionType.MCQ,
    );
    const allNonMcqEvaluated =
      nonMcqResponses.length === 0
        ? true
        : nonMcqResponses.every((r) => r.evaluationStatus === "EVALUATED");

    // Update submission status and total score
    const newStatus = allNonMcqEvaluated
      ? "FULLY_EVALUATED"
      : "PARTIALLY_EVALUATED";

    await updateRecords(
      TestSubmission,
      { id: submission.id },
      {
        totalScore: totalScore,
        status: newStatus,
      },
      false,
    );

    logger.info("Response evaluated successfully", {
      responseId,
      submissionId: submission.id,
      score,
      newTotalScore: totalScore,
      newStatus,
    });

    return res.status(200).json({
      message: "Response evaluated successfully",
      data: {
        responseId,
        score,
        comments,
        submissionStatus: newStatus,
        newTotalScore: totalScore,
        isSubmissionFullyEvaluated: allNonMcqEvaluated,
      },
    });
  } catch (error) {
    logger.error("Error evaluating response:", error);
    return res.status(500).json({ error: "Failed to evaluate response" });
  }
};

// Bulk evaluate multiple responses for a submission
export const bulkEvaluateResponses = async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { evaluations } = req.body;

    // Validate input
    if (!Array.isArray(evaluations) || evaluations.length === 0) {
      return res.status(400).json({ error: "Evaluations array is required" });
    }

    // Get submission
    const submission = await getSingleRecord(TestSubmission, {
      where: { id: submissionId },
      relations: ["responses", "responses.question"],
    });

    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    // Validate all evaluations
    for (const evaluation of evaluations) {
      const { responseId, score } = evaluation;

      if (!responseId || typeof score !== "number" || score < 0) {
        return res.status(400).json({
          error: "Each evaluation must have responseId and valid score",
        });
      }

      // Find response and validate
      const response = submission.responses.find((r) => r.id === responseId);
      if (!response) {
        return res.status(400).json({
          error: `Response ${responseId} not found in this submission`,
        });
      }

      if (response.question.type === QuestionType.MCQ) {
        return res.status(400).json({
          error: `Cannot manually evaluate MCQ response ${responseId}`,
        });
      }

      if (score > response.question.marks) {
        return res.status(400).json({
          error: `Score for response ${responseId} exceeds maximum marks (${response.question.marks})`,
        });
      }
    }

    // Update all responses
    const updatePromises = evaluations.map((evaluation) =>
      updateRecords(
        TestResponse,
        { id: evaluation.responseId },
        {
          score: evaluation.score,
          evaluationStatus: "EVALUATED",
          evaluatorComments: evaluation.comments || null,
        },
        false,
      ),
    );

    await Promise.all(updatePromises);

    // Recalculate submission totals
    const evaluatedResponses = submission.responses.filter(
      (r) =>
        r.evaluationStatus === "EVALUATED" ||
        evaluations.some((e) => e.responseId === r.id),
    );

    const totalScore = evaluatedResponses.reduce((sum, resp) => {
      const evaluation = evaluations.find((e) => e.responseId === resp.id);
      const score = evaluation ? evaluation.score : resp.score || 0;
      return sum + score;
    }, 0);

    // Check completion status
    const nonMcqResponses = submission.responses.filter(
      (r) => r.question.type !== QuestionType.MCQ,
    );
    const allNonMcqEvaluated = nonMcqResponses.every(
      (r) =>
        r.evaluationStatus === "EVALUATED" ||
        evaluations.some((e) => e.responseId === r.id),
    );

    const newStatus = allNonMcqEvaluated
      ? "FULLY_EVALUATED"
      : "PARTIALLY_EVALUATED";

    // Update submission
    await updateRecords(
      TestSubmission,
      { id: submissionId },
      {
        totalScore: totalScore,
        status: newStatus,
      },
      false,
    );

    logger.info("Bulk evaluation completed", {
      submissionId,
      evaluationsCount: evaluations.length,
      newTotalScore: totalScore,
      newStatus,
    });

    return res.status(200).json({
      message: "Bulk evaluation completed successfully",
      data: {
        submissionId,
        evaluationsProcessed: evaluations.length,
        newTotalScore: totalScore,
        submissionStatus: newStatus,
        isFullyEvaluated: allNonMcqEvaluated,
      },
    });
  } catch (error) {
    logger.error("Error in bulk evaluation:", error);
    return res.status(500).json({ error: "Failed to process bulk evaluation" });
  }
};

// Get evaluation statistics for a test
export const getEvaluationStatistics = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    // Get test details
    const test = await getSingleRecord(Test, {
      where: { id: testId },
      relations: ["questions"],
    });

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    // Get all submissions for this test
    const submissions = await getAllRecordsWithFilter(TestSubmission, {
      where: { test: { id: testId } },
      relations: ["responses", "responses.question"],
    });

    // Calculate statistics
    const totalSubmissions = submissions.length;
    const fullyEvaluated = submissions.filter(
      (s) => s.status === "FULLY_EVALUATED",
    ).length;
    const partiallyEvaluated = submissions.filter(
      (s) => s.status === "PARTIALLY_EVALUATED",
    ).length;
    const pending = submissions.filter((s) => s.status === "SUBMITTED").length;

    // Count descriptive/code questions
    const descriptiveQuestions = test.questions.filter(
      (q) =>
        q.type === QuestionType.DESCRIPTIVE || q.type === QuestionType.CODE,
    ).length;

    const mcqQuestions = test.questions.filter(
      (q) => q.type === QuestionType.MCQ,
    ).length;

    // Calculate total responses needing evaluation
    let totalDescriptiveResponses = 0;
    let evaluatedDescriptiveResponses = 0;

    submissions.forEach((submission) => {
      const descriptiveResponses = submission.responses.filter(
        (r) =>
          r.question.type === QuestionType.DESCRIPTIVE ||
          r.question.type === QuestionType.CODE,
      );

      totalDescriptiveResponses += descriptiveResponses.length;
      evaluatedDescriptiveResponses += descriptiveResponses.filter(
        (r) => r.evaluationStatus === "EVALUATED",
      ).length;
    });

    const evaluationProgress =
      totalDescriptiveResponses > 0
        ? (evaluatedDescriptiveResponses / totalDescriptiveResponses) * 100
        : 100;

    return res.status(200).json({
      message: "Evaluation statistics retrieved successfully",
      data: {
        test: {
          id: test.id,
          title: test.title,
          maxMarks: test.maxMarks,
          totalQuestions: test.questions.length,
          mcqQuestions,
          descriptiveQuestions,
        },
        submissions: {
          total: totalSubmissions,
          fullyEvaluated,
          partiallyEvaluated,
          pending,
        },
        evaluation: {
          totalDescriptiveResponses,
          evaluatedDescriptiveResponses,
          pendingDescriptiveResponses:
            totalDescriptiveResponses - evaluatedDescriptiveResponses,
          progressPercentage: Math.round(evaluationProgress),
        },
      },
    });
  } catch (error) {
    logger.error("Error fetching evaluation statistics:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch evaluation statistics" });
  }
};
