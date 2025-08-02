import { Request, Response } from "express";
import { Test, TestStatus } from "../../db/mysqlModels/Test";
import { Question, QuestionType } from "../../db/mysqlModels/Question";
import { QuizOptions } from "../../db/mysqlModels/QuizOptions";
import { Course } from "../../db/mysqlModels/Course";
import { TestAttempt } from "../../db/mysqlModels/TestAttempt";
import {
  createRecord,
  getSingleRecord,
  getAllRecordsWithFilter,
} from "../../lib/dbLib/sqlUtils";
import { AppDataSource, redisClient } from "../../db/connect";
import { getLoggerByName } from "../../utils/logger";
import sanitizeHtml from "sanitize-html";

const logger = getLoggerByName("Test Management");

const sanitizeQuestionText = (text: string): string => {
  return sanitizeHtml(text, {
    allowedTags: [
      "p",
      "strong",
      "em",
      "ul",
      "ol",
      "li",
      "code",
      "pre",
      "span",
      "div",
      "br",
      "blockquote",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "u",
      "s",
      "i",
      "b",
    ],
    allowedAttributes: {
      "*": ["class", "style", "spellcheck", "data-*"],
    },
    allowedStyles: {
      "*": {
        color: [/^.*$/],
        "background-color": [/^.*$/],
        "font-weight": [/^.*$/],
        "font-style": [/^.*$/],
        "text-decoration": [/^.*$/],
        "font-size": [/^.*$/],
        "font-family": [/^.*$/],
        "text-align": [/^.*$/],
        "white-space": [/^.*$/],
      },
    },
    allowVulnerableTags: false,
  }).trim();
};

export const createTest = async (req: Request, res: Response) => {
  try {
    let courseIds: string[] = [];
    if (req.body.courseIds && Array.isArray(req.body.courseIds)) {
      courseIds = req.body.courseIds;
    } else if (req.params.courseId) {
      courseIds = [req.params.courseId];
    } else if (req.query.courseId) {
      courseIds = [req.query.courseId as string];
    }

    console.log("Extracted courseIds:", courseIds);

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
      maxAttempts,
    } = req.body;

    if (
      !title ||
      !courseIds.length ||
      !maxMarks ||
      !durationInMinutes ||
      !startDate ||
      !endDate
    ) {
      console.log("Validation failed - missing required fields");
      return res.status(400).json({
        error: "Missing required fields",
        required: [
          "title",
          "courseIds",
          "maxMarks",
          "durationInMinutes",
          "startDate",
          "endDate",
        ],
        received: {
          title,
          courseIds,
          maxMarks,
          durationInMinutes,
          startDate,
          endDate,
        },
      });
    }

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    if (
      isNaN(startDateObj.getTime()) ||
      isNaN(endDateObj.getTime()) ||
      startDateObj >= endDateObj
    ) {
      return res.status(400).json({ error: "Invalid start or end time" });
    }

    const validMaxAttempts = maxAttempts && maxAttempts > 0 ? maxAttempts : 1;

    const createdTests: Test[] = [];
    for (const courseId of courseIds) {
      console.log(`Creating test for course: ${courseId}`);

      const course = await getSingleRecord<Course, any>(
        Course,
        { where: { id: courseId } },
        `course:${courseId}`,
        false,
      );

      if (!course) {
        console.log(`Course not found: ${courseId}`);
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
      test.showResults = showResults !== undefined ? showResults : true;
      test.showCorrectAnswers = showCorrectAnswers || false;
      test.maxAttempts = validMaxAttempts;
      test.status = TestStatus.DRAFT;
      test.course = course;
      test.createdAt = new Date();
      test.lastUpdated = new Date();

      const savedTest = (await createRecord(
        Test.getRepository(),
        test,
      )) as Test;
      createdTests.push(savedTest);
    }

    if (!createdTests.length) {
      return res
        .status(404)
        .json({ error: "No valid courses found for test creation" });
    }

    return res.status(201).json({
      success: true,
      message: `Test(s) created successfully in ${createdTests.length} course(s)`,
      tests: createdTests,
    });
  } catch (error: any) {
    logger.error("Error creating test:", error);
    console.error("Detailed error:", error);
    return res.status(500).json({
      error: "Failed to create test",
      details: error.message,
    });
  }
};

export const createTestsBulk = (req: Request, res: Response) => {
  return createTest(req, res);
};

export const createQuestion = async (req: Request, res: Response) => {
  if (!AppDataSource.isInitialized) {
    return res.status(500).json({
      error: "Failed to create question",
      details: "Database connection not initialized",
    });
  }

  try {
    const { testId } = req.params;
    const {
      question_text,
      type,
      marks,
      options,
      expectedWordCount,
      codeLanguage,
    } = req.body;

    if (!question_text || !type || !marks) {
      return res.status(400).json({
        error: "question_text, type, and marks are required",
      });
    }

    if (!Object.values(QuestionType).includes(type)) {
      return res.status(400).json({
        error: `Invalid question type. Must be one of: ${Object.values(QuestionType).join(", ")}`,
      });
    }
    const test = await getSingleRecord<Test, any>(
      Test,
      { where: { id: testId } },
      `test_${testId}`,
      false,
    );

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    if (test.status !== TestStatus.DRAFT) {
      return res.status(400).json({
        error: "Cannot add questions to a published test",
      });
    }
    const questionRepository = AppDataSource.getRepository(Question);
    const question = questionRepository.create({
      question_text: question_text.trim(),
      type,
      marks: parseInt(marks.toString()),
      expectedWordCount: expectedWordCount
        ? parseInt(expectedWordCount.toString())
        : undefined,
      codeLanguage,
      test,
    });

    const savedQuestion = await questionRepository.save(question);
    if (type === QuestionType.MCQ && Array.isArray(options)) {
      if (options.length < 2) {
        return res.status(400).json({
          error: "MCQ must have at least 2 options",
        });
      }

      let hasCorrectOption = false;
      const optionRepository = AppDataSource.getRepository(QuizOptions);

      for (const opt of options) {
        const { text, correct } = opt;

        if (!text || typeof text !== "string" || !text.trim()) {
          return res.status(400).json({
            error: "All options must have non-empty text",
          });
        }

        if (correct) hasCorrectOption = true;

        const option = optionRepository.create({
          text: text.trim(),
          correct: correct || false,
          question: savedQuestion,
        });

        await optionRepository.save(option);
      }

      if (!hasCorrectOption) {
        return res.status(400).json({
          error: "MCQ must have at least one correct option",
        });
      }
    }

    test.lastUpdated = new Date();
    await AppDataSource.getRepository(Test).save(test);

    try {
      if (redisClient.isOpen) {
        await redisClient.del(`test_${testId}_detailed`);
      }
    } catch (cacheError) {
      logger.warn("Cache clear failed but continuing:", cacheError);
    }

    const completeQuestion = await getSingleRecord<Question, any>(Question, {
      where: { id: savedQuestion.id },
      relations: ["options"],
    });

    return res.status(201).json({
      success: true,
      message: "Question created successfully",
      question: completeQuestion,
    });
  } catch (error: any) {
    logger.error("Error creating question:", error);
    return res.status(500).json({
      error: "Failed to create question",
      details: error.message || "Database connection error",
    });
  }
};

export const updateQuestion = async (req: Request, res: Response) => {
  if (!AppDataSource.isInitialized) {
    return res.status(500).json({
      error: "Failed to update question",
      details: "Database connection not initialized",
    });
  }

  try {
    const { testId, questionId } = req.params;
    const {
      question_text,
      type,
      marks,
      options,
      expectedWordCount,
      codeLanguage,
    } = req.body;

    const question = await getSingleRecord<Question, any>(
      Question,
      {
        where: { id: questionId, test: { id: testId } },
        relations: ["test", "options"],
      },
      `question_${questionId}`,
      false,
    );

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    if (question.test.status !== TestStatus.DRAFT) {
      return res.status(400).json({
        error: "Cannot update questions in a published test",
      });
    }
    const questionRepository = AppDataSource.getRepository(Question);
    question.question_text = question_text.trim();
    question.type = type;
    question.marks = parseInt(marks.toString());
    question.expectedWordCount = expectedWordCount
      ? parseInt(expectedWordCount.toString())
      : undefined;
    question.codeLanguage = codeLanguage;

    await questionRepository.save(question);

    if (Array.isArray(options) && question.type === QuestionType.MCQ) {
      if (question.options && question.options.length > 0) {
        const optionRepository = AppDataSource.getRepository(QuizOptions);
        await optionRepository.delete({ question: { id: question.id } });
      }

      if (options.length < 2) {
        return res.status(400).json({
          error: "MCQ must have at least 2 options",
        });
      }

      let hasCorrectOption = false;
      const optionRepository = AppDataSource.getRepository(QuizOptions);

      for (const opt of options) {
        const { text, correct } = opt;

        if (!text || typeof text !== "string" || !text.trim()) {
          return res.status(400).json({
            error: "All options must have non-empty text",
          });
        }

        if (correct) hasCorrectOption = true;

        const option = optionRepository.create({
          text: text.trim(),
          correct: correct || false,
          question,
        });

        await optionRepository.save(option);
      }

      if (!hasCorrectOption) {
        return res.status(400).json({
          error: "MCQ must have at least one correct option",
        });
      }
    }

    question.test.lastUpdated = new Date();
    await AppDataSource.getRepository(Test).save(question.test);

    try {
      if (redisClient.isOpen) {
        await redisClient.del(`question_${questionId}`);
        await redisClient.del(`test_${testId}_detailed`);
      }
    } catch (cacheError) {
      logger.warn("Cache clear failed but continuing:", cacheError);
    }

    const updatedQuestion = await getSingleRecord<Question, any>(Question, {
      where: { id: questionId },
      relations: ["options"],
    });

    return res.status(200).json({
      success: true,
      message: "Question updated successfully",
      question: updatedQuestion,
    });
  } catch (error: any) {
    logger.error("Error updating question:", error);
    return res.status(500).json({
      error: "Failed to update question",
      details: error.message || "Database connection error",
    });
  }
};

export const deleteQuestion = async (req: Request, res: Response) => {
  if (!AppDataSource.isInitialized) {
    return res.status(500).json({
      error: "Failed to delete question",
      details: "Database connection not initialized",
    });
  }

  try {
    const { testId, questionId } = req.params;

    const question = await getSingleRecord<Question, any>(
      Question,
      {
        where: { id: questionId, test: { id: testId } },
        relations: ["test", "options"],
      },
      `question_${questionId}`,
      false,
    );

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    if (question.test.status !== TestStatus.DRAFT) {
      return res.status(400).json({
        error: "Cannot delete questions from a published test",
      });
    }

    if (question.options && question.options.length > 0) {
      const optionRepository = AppDataSource.getRepository(QuizOptions);
      await optionRepository.delete({ question: { id: question.id } });
    }

    const questionRepository = AppDataSource.getRepository(Question);
    await questionRepository.delete({ id: question.id });

    question.test.lastUpdated = new Date();
    await AppDataSource.getRepository(Test).save(question.test);

    try {
      if (redisClient.isOpen) {
        await redisClient.del(`question_${questionId}`);
        await redisClient.del(`test_${testId}_detailed`);
      }
    } catch (cacheError) {
      logger.warn("Cache clear failed but continuing:", cacheError);
    }

    return res.status(200).json({
      success: true,
      message: "Question deleted successfully",
    });
  } catch (error: any) {
    logger.error("Error deleting question:", error);
    return res.status(500).json({
      error: "Failed to delete question",
      details: error.message || "Database connection error",
    });
  }
};

export const getQuestions = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    const test = await getSingleRecord<Test, any>(
      Test,
      {
        where: { id: testId },
        relations: ["questions", "questions.options"],
      },
      `test_${testId}_detailed`,
      false,
    );

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const questionsWithHtml =
      test.questions?.map((question: Question) => {
        return {
          ...question,
          question_text: question.question_text || "",
        };
      }) || [];

    return res.status(200).json({
      success: true,
      message: "Questions retrieved successfully",
      data: { questions: questionsWithHtml },
    });
  } catch (error: any) {
    logger.error("Error retrieving questions:", error);
    return res.status(500).json({
      error: "Failed to retrieve questions",
      details: error.message,
    });
  }
};

export const publishTest = async (req: Request, res: Response) => {
  if (!AppDataSource.isInitialized) {
    return res.status(500).json({
      error: "Failed to publish test",
      details: "Database connection not initialized",
    });
  }

  try {
    const { testId } = req.params;
    const testRepository = AppDataSource.getRepository(Test);
    const test = await testRepository.findOne({
      where: { id: testId },
      relations: ["questions", "questions.options", "course"],
    });

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    if (test.status === TestStatus.PUBLISHED) {
      return res.status(400).json({
        error: "Test is already published",
      });
    }

    // Validate test has questions
    if (!test.questions || test.questions.length === 0) {
      return res.status(400).json({
        error:
          "Cannot publish test without questions. Please add at least one question.",
      });
    }

    // Validate date constraints
    const currentDate = new Date();
    const startDate = new Date(test.startDate);
    const endDate = new Date(test.endDate);

    if (startDate <= currentDate) {
      return res.status(400).json({
        error:
          "Cannot publish test with start date in the past. Please update the start date.",
      });
    }

    if (endDate <= startDate) {
      return res.status(400).json({
        error: "End date must be after start date.",
      });
    }

    // Validate test duration
    if (!test.durationInMinutes || test.durationInMinutes <= 0) {
      return res.status(400).json({
        error: "Test must have a valid duration.",
      });
    }

    // Validate marks
    if (!test.maxMarks || test.maxMarks <= 0) {
      return res.status(400).json({
        error: "Test must have valid maximum marks.",
      });
    }

    if (
      !test.passingMarks ||
      test.passingMarks <= 0 ||
      test.passingMarks > test.maxMarks
    ) {
      return res.status(400).json({
        error:
          "Test must have valid passing marks (greater than 0 and less than or equal to maximum marks).",
      });
    }

    for (const question of test.questions) {
      if (question.type === "MCQ") {
        if (!question.options || question.options.length < 2) {
          return res.status(400).json({
            error: `Question "${question.question_text?.substring(0, 50)}..." must have at least 2 options.`,
          });
        }

        const hasCorrectOption = question.options.some(
          (option) => option.correct,
        );
        if (!hasCorrectOption) {
          return res.status(400).json({
            error: `Question "${question.question_text?.substring(0, 50)}..." must have at least one correct option.`,
          });
        }
      }
    }

    const totalMarks = test.questions.reduce(
      (sum, question) => sum + question.marks,
      0,
    );
    if (totalMarks !== test.maxMarks) {
      test.maxMarks = totalMarks;
    }

    test.status = TestStatus.PUBLISHED;
    test.lastUpdated = new Date();

    const savedTest = await testRepository.save(test);

    try {
      if (redisClient.isOpen) {
        await redisClient.del(`test_${testId}_detailed`);
        await redisClient.del(`test_${testId}_basic`);
        const pattern = `user:*:available_tests`;
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.del(keys);
        }
      }
    } catch (cacheError) {
      logger.warn("Cache clear failed but continuing:", cacheError);
    }

    return res.status(200).json({
      success: true,
      message: "Test published successfully",
      data: {
        test: {
          id: savedTest.id,
          title: savedTest.title,
          status: savedTest.status,
          questionsCount: test.questions.length,
          maxMarks: savedTest.maxMarks,
          passingMarks: savedTest.passingMarks,
          startDate: savedTest.startDate,
          endDate: savedTest.endDate,
        },
      },
    });
  } catch (error: any) {
    logger.error("Error publishing test:", error);
    return res.status(500).json({
      error: "Failed to publish test",
      details: error.message || "Database connection error",
    });
  }
};

export const addQuestions = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "Questions array is required" });
    }

    const test = await getSingleRecord<Test, any>(
      Test,
      { where: { id: testId } },
      `test_${testId}`,
      false,
    );

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    if (test.status !== TestStatus.DRAFT) {
      return res
        .status(400)
        .json({ error: "Cannot add questions to a published test" });
    }

    const createdQuestions: Question[] = [];

    for (const questionData of questions) {
      const {
        question_text,
        type,
        marks,
        options,
        expectedWordCount,
        codeLanguage,
      } = questionData;

      if (!question_text || !type || marks === undefined) {
        return res.status(400).json({
          error:
            "Missing required fields in question: question_text, type, marks",
        });
      }

      const question = new Question();
      question.question_text = sanitizeQuestionText(question_text);
      question.type =
        type === "DESCRIPTIVE"
          ? QuestionType.DESCRIPTIVE
          : type === "CODE"
            ? QuestionType.CODE
            : QuestionType.MCQ;
      question.marks = marks || 1;
      question.test = test;

      if ((type === "DESCRIPTIVE" || type === "CODE") && expectedWordCount) {
        question.expectedWordCount = expectedWordCount;
      }

      if (codeLanguage && type === "CODE") {
        question.codeLanguage = codeLanguage;
      }

      const savedQuestion = (await createRecord(
        Question.getRepository(),
        question,
      )) as Question;

      // Add options for MCQ questions
      if (type === "MCQ" && options && Array.isArray(options)) {
        for (const opt of options) {
          const { text, correct } = opt;

          if (!text) continue; // Skip empty options

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
      success: true,
      message: "Questions added successfully",
      questions: createdQuestions,
    });
  } catch (error: any) {
    logger.error("Error adding questions:", error);
    return res.status(500).json({
      error: "Failed to add questions",
      details: error.message,
    });
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
    const results = attempts.map((attempt: TestAttempt) => ({
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
    );

    return res.status(200).json({
      message: "Test results retrieved successfully",
      results,
    });
  } catch (error: any) {
    logger.error("Error fetching test results:", error);
    return res.status(500).json({
      error: "Failed to fetch test results",
      details: error.message,
    });
  }
};
