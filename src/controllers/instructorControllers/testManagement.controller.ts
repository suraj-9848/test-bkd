import { Request, Response } from "express";
import { Test, TestStatus } from "../../db/mysqlModels/Test";
import { Question, QuestionType } from "../../db/mysqlModels/Question";
import { QuizOptions } from "../../db/mysqlModels/QuizOptions";
import { Course } from "../../db/mysqlModels/Course";
import { TestAttempt, AttemptStatus } from "../../db/mysqlModels/TestAttempt";
import {
  createRecord,
  getSingleRecord,
  getAllRecordsWithFilter,
  deleteRecords,
} from "../../lib/dbLib/sqlUtils";
import { redisClient } from "../../db/connect";
import { getLoggerByName } from "../../utils/logger";

const logger = getLoggerByName("Test Management");

// Create a new test (single or multiple courses)
export const createTest = async (req: Request, res: Response) => {
  try {
    // Accept either courseId from params or courseIds from body (array)
    let courseIds: string[] = [];
    if (req.body.courseIds && Array.isArray(req.body.courseIds)) {
      courseIds = req.body.courseIds;
    } else if (req.params.courseId) {
      courseIds = [req.params.courseId];
    }

    const {
      title,
      description,
      maxMarks,
      passingMarks,
      durationInMinutes,
      startDate,
      endDate,
      shuffleQuestions,
      showResults,
      showCorrectAnswers,
    } = req.body;

    // Validate required fields
    if (
      !title ||
      !courseIds.length ||
      !maxMarks ||
      !durationInMinutes ||
      !startDate ||
      !endDate
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate dates
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    if (
      isNaN(startDateObj.getTime()) ||
      isNaN(endDateObj.getTime()) ||
      startDateObj >= endDateObj
    ) {
      return res.status(400).json({ error: "Invalid start or end time" });
    }

    // Create a test for each courseId
    const createdTests = [];
    for (const courseId of courseIds) {
      const course = await getSingleRecord<Course, any>(
        Course,
        { where: { id: courseId } },
        `course:${courseId}`,
        true,
      );
      if (!course) {
        // Optionally skip or return error for missing course
        continue;
      }
      const test = new Test();
      test.title = title;
      test.description = description || "";
      test.maxMarks = maxMarks;
      test.passingMarks = passingMarks || 0;
      test.durationInMinutes = durationInMinutes;
      test.startDate = startDateObj;
      test.endDate = endDateObj;
      test.shuffleQuestions = shuffleQuestions || false;
      test.showResults = showResults || false;
      test.showCorrectAnswers = showCorrectAnswers || false;
      test.status = TestStatus.DRAFT;
      test.course = course;
      const savedTest = await createRecord(Test.getRepository(), test);
      createdTests.push(savedTest);
    }

    if (!createdTests.length) {
      return res
        .status(404)
        .json({ error: "No valid courses found for test creation" });
    }

    return res.status(201).json({
      message: `Test(s) created successfully in ${createdTests.length} course(s)`,
      tests: createdTests,
    });
  } catch (error) {
    logger.error("Error creating test:", error);
    return res.status(500).json({ error: "Failed to create test" });
  }
};

// Bulk create tests in multiple courses (for new route)
export const createTestsBulk = (req: Request, res: Response) => {
  // Call createTest with the same req/res
  // This works because createTest checks for courseIds array
  // and handles multi-course creation
  // (must be after createTest is defined)
  return (createTest as any)(req, res);
};

// Get all tests for a course
export const getTestsByCourse = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;

    const tests = await getAllRecordsWithFilter<Test, any>(
      Test,
      {
        where: { course: { id: courseId } },
        relations: ["course"],
        order: { createdAt: "DESC" },
      },
      `tests_by_course_${courseId}`,
      true,
      60,
    );

    return res.status(200).json({
      tests,
    });
  } catch (error) {
    logger.error("Error fetching tests:", error);
    return res.status(500).json({ error: "Failed to fetch tests" });
  }
};

// Get a specific test with questions
export const getTestById = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    const test = await getSingleRecord<Test, any>(
      Test,
      {
        where: { id: testId },
        relations: ["questions", "questions.options", "course"],
      },
      `test_${testId}_detailed`,
      true,
    );

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    return res.status(200).json({ test });
  } catch (error) {
    logger.error("Error fetching test:", error);
    return res.status(500).json({ error: "Failed to fetch test" });
  }
};

// Update test details
export const updateTest = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const {
      title,
      description,
      maxMarks,
      passingMarks,
      durationInMinutes,
      startDate,
      endDate,
      shuffleQuestions,
      showResults,
      showCorrectAnswers,
    } = req.body;

    const test = await getSingleRecord<Test, any>(
      Test,
      { where: { id: testId } },
      `test_${testId}`,
      true,
    );

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    // Allow only startDate and endDate to be changed after publishing, unless test has ended
    const now = new Date();
    const testEnded = now > new Date(test.endDate);
    if (test.status !== TestStatus.DRAFT && testEnded) {
      return res.status(400).json({
        error: "Cannot update a test that has ended",
      });
    }

    if (test.status !== TestStatus.DRAFT) {
      // Only allow startDate and endDate to be updated
      if (startDate) {
        const startDateObj = new Date(startDate);
        if (!isNaN(startDateObj.getTime())) test.startDate = startDateObj;
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        if (!isNaN(endDateObj.getTime())) test.endDate = endDateObj;
      }
    } else {
      // Allow all fields to be updated in DRAFT
      if (title) test.title = title;
      if (description !== undefined) test.description = description;
      if (maxMarks) test.maxMarks = maxMarks;
      if (passingMarks !== undefined) test.passingMarks = passingMarks;
      if (durationInMinutes) test.durationInMinutes = durationInMinutes;
      if (startDate) {
        const startDateObj = new Date(startDate);
        if (!isNaN(startDateObj.getTime())) test.startDate = startDateObj;
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        if (!isNaN(endDateObj.getTime())) test.endDate = endDateObj;
      }
      if (shuffleQuestions !== undefined)
        test.shuffleQuestions = shuffleQuestions;
      if (showResults !== undefined) test.showResults = showResults;
      if (showCorrectAnswers !== undefined)
        test.showCorrectAnswers = showCorrectAnswers;
    }

    test.lastUpdated = new Date();
    await test.save();

    // Clear cache
    await redisClient.del(`test_${testId}`);
    await redisClient.del(`test_${testId}_detailed`);

    return res.status(200).json({
      message: "Test updated successfully",
      test,
    });
  } catch (error) {
    logger.error("Error updating test:", error);
    return res.status(500).json({ error: "Failed to update test" });
  }
};

// Delete a test
export const deleteTest = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    const test = await getSingleRecord<Test, any>(
      Test,
      { where: { id: testId } },
      `test_${testId}`,
      true,
    );

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    // Prevent deletion of active tests
    const now = new Date();
    if (test.status !== TestStatus.DRAFT && now >= new Date(test.startDate)) {
      return res.status(400).json({
        error: "Cannot delete a test that has already started",
      });
    }

    await deleteRecords(Test, { id: testId });

    // Clear cache
    await redisClient.del(`test_${testId}`);
    await redisClient.del(`test_${testId}_detailed`);
    await redisClient.del(`tests_by_course_${test.course.id}`);

    return res.status(200).json({
      message: "Test deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting test:", error);
    return res.status(500).json({ error: "Failed to delete test" });
  }
};

// Add questions to a test
export const addQuestions = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "Invalid questions data" });
    }

    const test = await getSingleRecord<Test, any>(
      Test,
      { where: { id: testId } },
      `test_${testId}`,
      true,
    );

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    // Prevent updates for tests that have started
    if (test.status !== TestStatus.DRAFT) {
      return res
        .status(400)
        .json({ error: "Cannot add questions to a published test" });
    }

    const createdQuestions = [];

    // Create questions and options
    for (const q of questions) {
      const { question_text, type, marks, options, expectedWordCount } = q;

      const question = new Question();
      question.question_text = question_text;
      question.type =
        type === QuestionType.DESCRIPTIVE
          ? QuestionType.DESCRIPTIVE
          : QuestionType.MCQ;
      question.marks = marks || 1;
      question.test = test;

      if (type === QuestionType.DESCRIPTIVE && expectedWordCount) {
        question.expectedWordCount = expectedWordCount;
      }

      const savedQuestion = (await createRecord(
        Question.getRepository(),
        question,
      )) as Question;

      // Add options for MCQ questions
      if (type === QuestionType.MCQ && options && Array.isArray(options)) {
        for (const opt of options) {
          const { text, correct } = opt;

          const option = new QuizOptions();
          option.text = text;
          option.correct = correct || false;
          option.question = savedQuestion;

          await createRecord(QuizOptions.getRepository(), option);
        }
      }

      createdQuestions.push(savedQuestion);
    }

    // Update test lastUpdated timestamp
    test.lastUpdated = new Date();
    await test.save();

    // Clear cache
    await redisClient.del(`test_${testId}_detailed`);

    return res.status(201).json({
      message: "Questions added successfully",
      questions: createdQuestions,
    });
  } catch (error) {
    logger.error("Error adding questions:", error);
    return res.status(500).json({ error: "Failed to add questions" });
  }
};

// Update a question
export const updateQuestion = async (req: Request, res: Response) => {
  try {
    const { testId, questionId } = req.params;
    const { question_text, type, marks, options, expectedWordCount } = req.body;

    const question = await getSingleRecord<Question, any>(
      Question,
      {
        where: { id: questionId, test: { id: testId } },
        relations: ["test", "options"],
      },
      `question_${questionId}`,
      true,
    );

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    // Prevent updates for tests that have started
    if (question.test.status !== TestStatus.DRAFT) {
      return res
        .status(400)
        .json({ error: "Cannot update questions on a published test" });
    }

    // Update question fields
    if (question_text) question.question_text = question_text;
    if (marks) question.marks = marks;
    if (type) {
      question.type =
        type === QuestionType.DESCRIPTIVE
          ? QuestionType.DESCRIPTIVE
          : QuestionType.MCQ;
    }

    if (expectedWordCount !== undefined && type === QuestionType.DESCRIPTIVE) {
      question.expectedWordCount = expectedWordCount;
    }

    await question.save();

    // Update options if provided
    if (
      options &&
      Array.isArray(options) &&
      question.type === QuestionType.MCQ
    ) {
      // Delete existing options
      if (question.options && question.options.length > 0) {
        await Promise.all(
          question.options.map((option) =>
            deleteRecords(QuizOptions, { id: option.id }),
          ),
        );
      }

      // Create new options
      for (const opt of options) {
        const { text, correct } = opt;

        const option = new QuizOptions();
        option.text = text;
        option.correct = correct || false;
        option.question = question;

        await createRecord(QuizOptions.getRepository(), option);
      }
    }

    // Update test lastUpdated timestamp
    question.test.lastUpdated = new Date();
    await question.test.save();

    // Clear cache
    await redisClient.del(`question_${questionId}`);
    await redisClient.del(`test_${testId}_detailed`);

    // Get the updated question with options
    const updatedQuestion = await getSingleRecord<Question, any>(Question, {
      where: { id: questionId },
      relations: ["options"],
    });

    return res.status(200).json({
      message: "Question updated successfully",
      question: updatedQuestion,
    });
  } catch (error) {
    logger.error("Error updating question:", error);
    return res.status(500).json({ error: "Failed to update question" });
  }
};

// Delete a question
export const deleteQuestion = async (req: Request, res: Response) => {
  try {
    const { testId, questionId } = req.params;

    const question = await getSingleRecord<Question, any>(Question, {
      where: { id: questionId, test: { id: testId } },
      relations: ["test"],
    });

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    // Prevent updates for tests that have started
    if (question.test.status !== TestStatus.DRAFT) {
      return res.status(400).json({
        error: "Cannot delete questions from a published test",
      });
    }

    await deleteRecords(Question, { id: questionId });

    // Clear cache
    await redisClient.del(`test_${testId}_detailed`);

    // Update test lastUpdated timestamp
    question.test.lastUpdated = new Date();
    await question.test.save();

    return res.status(200).json({
      message: "Question deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting question:", error);
    return res.status(500).json({ error: "Failed to delete question" });
  }
};

// Publish a test to make it available
export const publishTest = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    const test = await getSingleRecord<Test, any>(
      Test,
      {
        where: { id: testId },
        relations: ["questions", "questions.options"],
      },
      `test_${testId}_detailed`,
      true,
    );

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    // Check if test already published
    if (test.status !== TestStatus.DRAFT) {
      return res.status(400).json({ error: "Test is already published" });
    }

    // Check if there are questions
    if (!test.questions || test.questions.length === 0) {
      return res
        .status(400)
        .json({ error: "Cannot publish a test without questions" });
    }

    // Validate that MCQ questions have options with correct answers
    for (const question of test.questions) {
      if (question.type === QuestionType.MCQ) {
        if (!question.options || question.options.length < 2) {
          return res.status(400).json({
            error: `MCQ question "${question.question_text}" must have at least 2 options`,
          });
        }

        const hasCorrectOption = question.options.some((opt) => opt.correct);
        if (!hasCorrectOption) {
          return res.status(400).json({
            error: `MCQ question "${question.question_text}" must have at least one correct option`,
          });
        }
      }
    }

    // Update test status
    test.status = TestStatus.PUBLISHED;
    test.lastUpdated = new Date();
    await test.save();

    // Clear and update cache
    await redisClient.del(`test_${testId}`);
    await redisClient.del(`test_${testId}_detailed`);
    await redisClient.del(`tests_by_course_${test.course.id}`);

    // Cache test data for faster access during exam
    await redisClient.set(
      `test:${testId}:config`,
      JSON.stringify({
        id: test.id,
        title: test.title,
        description: test.description,
        maxMarks: test.maxMarks,
        passingMarks: test.passingMarks,
        durationInMinutes: test.durationInMinutes,
        startDate: test.startDate,
        endDate: test.endDate,
        status: test.status,
        shuffleQuestions: test.shuffleQuestions,
        showResults: test.showResults,
        showCorrectAnswers: test.showCorrectAnswers,
      }),
      { EX: 86400 },
    ); // Cache for 24 hours

    // Cache questions without correct answers for students
    const questionsForStudents = test.questions.map((q) => ({
      id: q.id,
      question_text: q.question_text,
      type: q.type,
      marks: q.marks,
      expectedWordCount: q.expectedWordCount,
      options:
        q.type === QuestionType.MCQ
          ? q.options.map((opt) => ({
              id: opt.id,
              text: opt.text,
              // Don't include correct answer flag
            }))
          : [],
    }));

    await redisClient.set(
      `test:${testId}:questions`,
      JSON.stringify(questionsForStudents),
      { EX: 86400 },
    );

    return res.status(200).json({
      message: "Test published successfully",
      test: {
        id: test.id,
        status: test.status,
        startDate: test.startDate,
        endDate: test.endDate,
      },
    });
  } catch (error) {
    logger.error("Error publishing test:", error);
    return res.status(500).json({ error: "Failed to publish test" });
  }
};

// Get test results
export const getTestResults = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    // Try to get from cache first
    const cachedResults = await redisClient.get(`test:${testId}:results`);
    if (cachedResults) {
      return res.status(200).json(JSON.parse(cachedResults));
    }

    const attempts = await getAllRecordsWithFilter<TestAttempt, any>(
      TestAttempt,
      {
        where: { test: { id: testId } },
        relations: ["student", "test"],
      },
    );

    if (!attempts || attempts.length === 0) {
      return res.status(200).json({
        message: "No attempts found for this test",
        results: [],
      });
    }

    // Process results
    const results = attempts.map((attempt) => ({
      attemptId: attempt.id,
      student: {
        id: attempt.student.id,
        name: attempt.student.username,
      },
      status: attempt.status,
      score: attempt.score,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      feedback: attempt.feedback,
    }));

    // Cache results
    await redisClient.set(
      `test:${testId}:results`,
      JSON.stringify({
        message: "Test results retrieved successfully",
        results,
      }),
      { EX: 300 },
    ); // Cache for 5 minutes

    return res.status(200).json({
      message: "Test results retrieved successfully",
      results,
    });
  } catch (error) {
    logger.error("Error fetching test results:", error);
    return res.status(500).json({ error: "Failed to fetch test results" });
  }
};

// Get test statistics
export const getTestStatistics = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    // Try to get from cache first
    const cachedStats = await redisClient.get(`test:${testId}:stats`);
    if (cachedStats) {
      return res.status(200).json(JSON.parse(cachedStats));
    }

    // Get the test with questions
    const test = await getSingleRecord<Test, any>(
      Test,
      {
        where: { id: testId },
        relations: ["questions"],
      },
      `test_${testId}_with_questions`,
      true,
    );

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    // Get all attempts
    const attempts = await getAllRecordsWithFilter<TestAttempt, any>(
      TestAttempt,
      {
        where: { test: { id: testId } },
      },
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

    // Calculate average score
    const scores = attempts
      .filter((a) => a.status === AttemptStatus.EVALUATED && a.score !== null)
      .map((a) => a.score!);

    const averageScore =
      scores.length > 0
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : 0;

    // Calculate pass rate
    const passCount = scores.filter(
      (score) => score >= test.passingMarks,
    ).length;
    const passRate = scores.length > 0 ? (passCount / scores.length) * 100 : 0;

    const stats = {
      testId: test.id,
      title: test.title,
      questionCount: test.questions.length,
      totalMarks: test.maxMarks,
      passingMarks: test.passingMarks,
      totalAttempts,
      submittedAttempts,
      evaluatedAttempts,
      averageScore,
      passRate,
      highestScore: scores.length > 0 ? Math.max(...scores) : 0,
      lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
    };

    // Cache statistics
    await redisClient.set(
      `test:${testId}:stats`,
      JSON.stringify({
        message: "Test statistics retrieved successfully",
        statistics: stats,
      }),
      { EX: 300 },
    ); // Cache for 5 minutes

    return res.status(200).json({
      message: "Test statistics retrieved successfully",
      statistics: stats,
    });
  } catch (error) {
    logger.error("Error fetching test statistics:", error);
    return res.status(500).json({ error: "Failed to fetch test statistics" });
  }
};
