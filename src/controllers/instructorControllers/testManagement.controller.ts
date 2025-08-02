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
import sanitizeHtml from "sanitize-html";

const logger = getLoggerByName("Test Management");

// Helper function to sanitize HTML content
const sanitizeQuestionText = (text: string): string => {
  return sanitizeHtml(text, {
    allowedTags: [
      "p", "strong", "em", "ul", "ol", "li", "code", "pre", "span", "div", "br",
      "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "u", "s", "i", "b",
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

// Create a new test (supports both single and multiple courses)
export const createTest = async (req: Request, res: Response) => {
  try {
    console.log("=== CREATE TEST REQUEST ===");
    console.log("Request body:", req.body);
    console.log("Request params:", req.params);
    
    // Accept either courseId from params or courseIds from body (array)
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

    // Validate required fields
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
        required: ["title", "courseIds", "maxMarks", "durationInMinutes", "startDate", "endDate"],
        received: { title, courseIds, maxMarks, durationInMinutes, startDate, endDate }
      });
    }

    // Validate dates
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    if (
      isNaN(startDateObj.getTime()) ||
      isNaN(endDateObj.getTime()) ||
      startDateObj >= endDateObj
    ) {
      console.log("Date validation failed");
      return res.status(400).json({ error: "Invalid start or end time" });
    }

    // Validate maxAttempts
    const validMaxAttempts = maxAttempts && maxAttempts > 0 ? maxAttempts : 1;

    // Create a test for each courseId
    const createdTests: Test[] = [];
    for (const courseId of courseIds) {
      console.log(`Creating test for course: ${courseId}`);
      
      const course = await getSingleRecord<Course, any>(
        Course,
        { where: { id: courseId } },
        `course:${courseId}`,
        false, // Get entity instance, not plain object
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

      console.log("Test object before save:", {
        title: test.title,
        courseId: course.id,
        status: test.status,
        maxAttempts: test.maxAttempts
      });

      const savedTest = await createRecord(Test.getRepository(), test) as Test;
      console.log("Test saved successfully:", savedTest.id);
      createdTests.push(savedTest);
    }

    if (!createdTests.length) {
      console.log("No valid courses found for test creation");
      return res
        .status(404)
        .json({ error: "No valid courses found for test creation" });
    }

    console.log(`Successfully created ${createdTests.length} test(s)`);
    
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
      details: error.message 
    });
  }
};

// Bulk create tests in multiple courses (alias for createTest)
export const createTestsBulk = (req: Request, res: Response) => {
  return createTest(req, res);
};

// 🔥 FIXED: Create a single question for a test
export const createQuestion = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const { question_text, type, marks, options, expectedWordCount, codeLanguage } = req.body;

    console.log("🔥 FIXED - Creating question for test:", {
      testId,
      question_text_length: question_text?.length,
      has_html_tags: question_text?.includes("<"),
      question_text_preview: question_text?.substring(0, 100),
      type,
      marks,
    });

    // Validate required fields
    if (!question_text || !type || !marks) {
      return res.status(400).json({
        error: "question_text, type, and marks are required",
      });
    }

    // Validate question type
    if (!["MCQ", "DESCRIPTIVE", "CODE"].includes(type)) {
      return res.status(400).json({ error: "Invalid question type" });
    }

    if (marks <= 0) {
      return res.status(400).json({ error: "Marks must be greater than zero" });
    }

    const sanitizedQuestionText = sanitizeQuestionText(question_text);

    if (!sanitizedQuestionText) {
      return res.status(400).json({
        error: "Question text cannot be empty after sanitization",
      });
    }

    console.log("🔥 FIXED - Sanitized question text:", {
      original_length: question_text.length,
      sanitized_length: sanitizedQuestionText.length,
      has_html_tags: sanitizedQuestionText.includes("<"),
      sanitized_preview: sanitizedQuestionText.substring(0, 100),
    });

    // Get the test
    const test = await getSingleRecord<Test, any>(
      Test,
      { where: { id: testId } },
      `test_${testId}`,
      false // Get entity instance
    );

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    // Prevent updates for published tests
    if (test.status !== TestStatus.DRAFT) {
      return res.status(400).json({
        error: "Cannot add questions to a published test",
      });
    }

    // Create Question
    const question = new Question();
    question.question_text = sanitizedQuestionText;
    question.type = type as QuestionType;
    question.marks = marks;
    question.test = test;

    if (expectedWordCount && (type === "DESCRIPTIVE" || type === "CODE")) {
      question.expectedWordCount = expectedWordCount;
    }

    if (codeLanguage && type === "CODE") {
      question.codeLanguage = codeLanguage;
    }

    const savedQuestion = await createRecord(
      Question.getRepository(),
      question
    ) as Question;

    console.log("🔥 FIXED - Question saved with HTML:", {
      questionId: savedQuestion.id,
      stored_text_length: savedQuestion.question_text?.length,
      stored_has_html: savedQuestion.question_text?.includes("<"),
      stored_preview: savedQuestion.question_text?.substring(0, 100),
    });

    // Handle MCQ options
    if (type === "MCQ" && options && Array.isArray(options)) {
      if (options.length < 2) {
        return res.status(400).json({
          error: "MCQ must have at least 2 options",
        });
      }

      let hasCorrectOption = false;

      for (const opt of options) {
        const { text, correct } = opt;

        if (!text || typeof text !== "string" || !text.trim()) {
          return res.status(400).json({
            error: "All options must have non-empty text",
          });
        }

        if (correct) hasCorrectOption = true;

        const option = new QuizOptions();
        option.text = text.trim();
        option.correct = correct || false;
        option.question = savedQuestion;

        await createRecord(QuizOptions.getRepository(), option);
      }

      if (!hasCorrectOption) {
        return res.status(400).json({
          error: "MCQ must have at least one correct option",
        });
      }
    }

    // Update test lastUpdated timestamp
    test.lastUpdated = new Date();
    await test.save();

    // Clear cache
    await redisClient.del(`test_${testId}_detailed`);

    // Get the complete question with options
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
      details: error.message 
    });
  }
};

// 🔥 FIXED: Update an existing question
export const updateQuestion = async (req: Request, res: Response) => {
  try {
    const { testId, questionId } = req.params;
    const { question_text, type, marks, options, expectedWordCount, codeLanguage } = req.body;

    console.log("🔥 FIXED - Updating question:", {
      testId,
      questionId,
      question_text_length: question_text?.length,
      has_html_tags: question_text?.includes("<"),
      question_text_preview: question_text?.substring(0, 100),
    });

    const question = await getSingleRecord<Question, any>(
      Question,
      {
        where: { id: questionId, test: { id: testId } },
        relations: ["test", "options"],
      },
      `question_${questionId}`,
      false // Get entity instance
    );

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    // Prevent updates for published tests
    if (question.test.status !== TestStatus.DRAFT) {
      return res.status(400).json({
        error: "Cannot update questions on a published test",
      });
    }

    if (question_text !== undefined) {
      const sanitizedQuestionText = sanitizeQuestionText(question_text);

      if (!sanitizedQuestionText) {
        return res.status(400).json({
          error: "Question text cannot be empty after sanitization",
        });
      }

      question.question_text = sanitizedQuestionText;

      console.log("🔥 FIXED - Updated question text:", {
        updated_length: question.question_text?.length,
        updated_has_html: question.question_text?.includes("<"),
        updated_preview: question.question_text?.substring(0, 100),
      });
    }

    if (marks !== undefined) question.marks = marks;
    if (type) {
      question.type = type as QuestionType;
    }

    if (expectedWordCount !== undefined && (type === "DESCRIPTIVE" || type === "CODE")) {
      question.expectedWordCount = expectedWordCount;
    }

    if (codeLanguage !== undefined && type === "CODE") {
      question.codeLanguage = codeLanguage;
    }

    await question.save();

    // Update options if provided and question is MCQ
    if (options && Array.isArray(options) && question.type === QuestionType.MCQ) {
      // Delete existing options
      if (question.options && question.options.length > 0) {
        await Promise.all(
          question.options.map((option: any) =>
            deleteRecords(QuizOptions, { id: option.id })
          )
        );
      }

      // Validate new options
      if (options.length < 2) {
        return res.status(400).json({
          error: "MCQ must have at least 2 options",
        });
      }

      let hasCorrectOption = false;

      // Create new options
      for (const opt of options) {
        const { text, correct } = opt;

        if (!text || typeof text !== "string" || !text.trim()) {
          return res.status(400).json({
            error: "All options must have non-empty text",
          });
        }

        if (correct) hasCorrectOption = true;

        const option = new QuizOptions();
        option.text = text.trim();
        option.correct = correct || false;
        option.question = question;

        await createRecord(QuizOptions.getRepository(), option);
      }

      if (!hasCorrectOption) {
        return res.status(400).json({
          error: "MCQ must have at least one correct option",
        });
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

    console.log("🔥 FIXED - Question updated successfully:", {
      questionId,
      final_text_length: updatedQuestion?.question_text?.length,
      final_has_html: updatedQuestion?.question_text?.includes("<"),
      final_preview: updatedQuestion?.question_text?.substring(0, 100),
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
      details: error.message 
    });
  }
};

// 🔥 FIXED: Get all questions for a test
export const getQuestions = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    console.log("🔥 FIXED - Getting questions for test:", testId);

    const test = await getSingleRecord<Test, any>(
      Test,
      {
        where: { id: testId },
        relations: ["questions", "questions.options"],
      },
      `test_${testId}_detailed`,
      false // Get entity instance
    );

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const questionsWithHtml =
      test.questions?.map((question: Question) => {
        console.log("🔥 FIXED - Retrieving question:", {
          questionId: question.id,
          text_length: question.question_text?.length,
          has_html_tags: question.question_text?.includes("<"),
          text_preview: question.question_text?.substring(0, 100),
        });

        return {
          ...question,
          question_text: question.question_text || "", // Keep HTML formatting
        };
      }) || [];

    console.log("🔥 FIXED - Retrieved questions successfully:", {
      testId,
      questionsCount: questionsWithHtml.length,
      firstQuestionHasHtml: questionsWithHtml[0]?.question_text?.includes("<"),
    });

    return res.status(200).json({
      success: true,
      message: "Questions retrieved successfully",
      data: { questions: questionsWithHtml },
    });
  } catch (error: any) {
    logger.error("Error retrieving questions:", error);
    return res.status(500).json({ 
      error: "Failed to retrieve questions",
      details: error.message 
    });
  }
};

// 🔥 FIXED: Delete a question from a test
export const deleteQuestion = async (req: Request, res: Response) => {
  try {
    const { testId, questionId } = req.params;

    console.log("🔥 FIXED - Deleting question:", { testId, questionId });

    const question = await getSingleRecord<Question, any>(
      Question,
      {
        where: { id: questionId, test: { id: testId } },
        relations: ["test"],
      },
      `question_${questionId}`,
      false,
    );

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    // Prevent deletion for tests that have started
    if (question.test.status !== TestStatus.DRAFT) {
      return res
        .status(400)
        .json({ error: "Cannot delete questions from a published test" });
    }

    // Delete associated options first
    await deleteRecords(QuizOptions, { question: { id: questionId } });
    
    // Delete the question
    await deleteRecords(Question, { id: questionId });

    // Update test lastUpdated timestamp
    question.test.lastUpdated = new Date();
    await question.test.save();

    // Clear cache
    await redisClient.del(`question_${questionId}`);
    await redisClient.del(`test_${testId}_detailed`);

    return res.status(200).json({
      success: true,
      message: "Question deleted successfully",
    });
  } catch (error: any) {
    logger.error("Error deleting question:", error);
    return res.status(500).json({ 
      error: "Failed to delete question",
      details: error.message 
    });
  }
};

// 🔥 FIXED: Publish a test
export const publishTest = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    console.log("🔥 FIXED - Publishing test:", testId);

    const test = await getSingleRecord<Test, any>(
      Test,
      {
        where: { id: testId },
        relations: ["questions", "questions.options", "course"],
      },
      `test_${testId}_detailed`,
      false,
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

        const hasCorrectOption = question.options.some((opt: any) => opt.correct);
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
    if (test.course?.id) {
      await redisClient.del(`tests_by_course_${test.course.id}`);
    }

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
    const questionsForStudents = test.questions.map((q: Question) => ({
      id: q.id,
      question_text: q.question_text,
      type: q.type,
      marks: q.marks,
      expectedWordCount: q.expectedWordCount,
      options:
        q.type === QuestionType.MCQ
          ? q.options?.map((opt: any) => ({
              id: opt.id,
              text: opt.text,
              // Don't include correct answer flag
            })) || []
          : [],
    }));

    await redisClient.set(
      `test:${testId}:questions`,
      JSON.stringify(questionsForStudents),
      { EX: 86400 },
    );

    return res.status(200).json({
      success: true,
      message: "Test published successfully",
      test: {
        id: test.id,
        status: test.status,
        startDate: test.startDate,
        endDate: test.endDate,
      },
    });
  } catch (error: any) {
    logger.error("Error publishing test:", error);
    return res.status(500).json({ 
      error: "Failed to publish test",
      details: error.message 
    });
  }
};

// Add multiple questions to a test (bulk operation)
export const addQuestions = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const { questions } = req.body;

    console.log("=== ADD QUESTIONS REQUEST ===");
    console.log("Test ID:", testId);
    console.log("Questions data:", questions);

    // Validate input
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "Questions array is required" });
    }

    // Fetch Test entity
    const test = await getSingleRecord<Test, any>(
      Test,
      { where: { id: testId } },
      `test_${testId}`,
      false, // Get entity instance
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

      // Validate required fields
      if (!question_text || !type || marks === undefined) {
        return res.status(400).json({
          error: "Missing required fields in question: question_text, type, marks",
        });
      }

      const question = new Question();
      question.question_text = sanitizeQuestionText(question_text);
      question.type = type === "DESCRIPTIVE" ? QuestionType.DESCRIPTIVE : 
                     type === "CODE" ? QuestionType.CODE : QuestionType.MCQ;
      question.marks = marks || 1;
      question.test = test;

      if ((type === "DESCRIPTIVE" || type === "CODE") && expectedWordCount) {
        question.expectedWordCount = expectedWordCount;
      }

      if (codeLanguage && type === "CODE") {
        question.codeLanguage = codeLanguage;
      }

      const savedQuestion = await createRecord(Question.getRepository(), question) as Question;

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
      details: error.message 
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
    ); // Cache for 5 minutes

    return res.status(200).json({
      message: "Test results retrieved successfully",
      results,
    });
  } catch (error: any) {
    logger.error("Error fetching test results:", error);
    return res.status(500).json({ 
      error: "Failed to fetch test results",
      details: error.message 
    });
  }
};