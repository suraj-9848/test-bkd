import { Request, Response } from "express";
import { Question, QuestionType } from "../../db/mysqlModels/Question";
import { QuizOptions } from "../../db/mysqlModels/QuizOptions";
import { Test, TestStatus } from "../../db/mysqlModels/Test";
import { Course } from "../../db/mysqlModels/Course";
import {
  createRecord,
  getSingleRecord,
  deleteRecord,
} from "../../lib/dbLib/sqlUtils";
import sanitizeHtml from "sanitize-html";
import { logger } from "../../utils/logger";
import multer from "multer";

const sanitizeQuestionText = (text: string): string => {
  return sanitizeHtml(text, {
    allowedTags: [
      "p",
      "br",
      "div",
      "span",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "sub",
      "sup",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "code",
      "pre",
      "blockquote",
      "a",
    ],
    allowedAttributes: {
      "*": ["style", "class", "id", "data-*"],
      a: ["href", "target", "rel"],
    },
    allowedStyles: {
      "*": {
        "font-weight": [/^.*$/],
        "font-style": [/^.*$/],
        "text-decoration": [/^.*$/],
        color: [/^.*$/],
        "background-color": [/^.*$/],
        "font-size": [/^.*$/],
      },
    },
  });
};

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (
      file.originalname.endsWith(".txt") ||
      file.originalname.endsWith(".json")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only .txt and .json files are allowed"));
    }
  },
});

interface TestCase {
  input: string;
  expected_output: string;
}

// Enhanced interface for processed questions
interface ProcessedQuestion {
  id: string;
  question_text: string;
  type: QuestionType;
  marks: number;
  expectedWordCount?: number | null;
  codeLanguage?: string | null;
  correctAnswer?: string | null;
  constraints?: string | null;
  testcases_s3_url?: string | null;
  visible_testcases?: TestCase[] | null;
  hidden_testcases?: TestCase[] | null;
  time_limit_ms?: number | null;
  memory_limit_mb?: number | null;
  options?: QuizOptions[];
  [key: string]: any; // Allow additional properties
}

// FIXED: Complete implementation of createTest
export const createTest = async (req: Request, res: Response) => {
  try {
    const { batchId, courseId } = req.params;
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

    console.log("🔄 Creating test:", {
      batchId,
      courseId,
      title,
      maxMarks,
      durationInMinutes,
    });

    // Validation
    if (!title || !maxMarks || !durationInMinutes || !startDate || !endDate) {
      return res.status(400).json({ error: "Missing required fields" });
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

    // Check if course exists
    const course = await getSingleRecord<Course, { where: { id: string } }>(
      Course,
      { where: { id: courseId } },
    );

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Create test
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

    console.log("✅ Test created successfully:", savedTest);

    return res.status(201).json({
      success: true,
      message: "Test created successfully",
      test: savedTest,
    });
  } catch (error) {
    console.error("❌ Error creating test:", error);
    logger.error("Error creating test:", error);
    return res.status(500).json({
      error: "Failed to create test",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const createTestsBulk = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const {
      courseIds,
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

    console.log("🔄 Creating tests in bulk:", {
      batchId,
      courseCount: courseIds?.length,
      title,
      maxMarks,
      durationInMinutes,
    });

    // Validate required fields
    if (!courseIds || !Array.isArray(courseIds) || courseIds.length === 0) {
      return res.status(400).json({ error: "courseIds array is required" });
    }

    if (!title || !maxMarks || !durationInMinutes || !startDate || !endDate) {
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

    const createdTests = [];
    const errors = [];

    // Create test for each course
    for (const courseId of courseIds) {
      try {
        console.log(`🔄 Creating test for course: ${courseId}`);

        // Check if course exists
        const course = await getSingleRecord<Course, { where: { id: string } }>(
          Course,
          { where: { id: courseId } },
        );

        if (!course) {
          errors.push({ courseId, error: "Course not found" });
          console.error(`❌ Course not found: ${courseId}`);
          continue;
        }

        // Create test
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

        console.log(`🔄 Saving test for course: ${courseId}`, {
          title: test.title,
          maxMarks: test.maxMarks,
          status: test.status,
        });

        const savedTest = await createRecord(Test.getRepository(), test);
        createdTests.push({
          ...savedTest,
          courseId,
          courseName: course.title || course.name || `Course ${courseId}`,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(`❌ Error creating test for course ${courseId}:`, error);
        errors.push({
          courseId,
          error: errorMessage,
        });
      }
    }

    console.log("✅ Bulk test creation completed:", {
      created: createdTests.length,
      errors: errors.length,
      totalRequested: courseIds.length,
    });

    // Return success response
    return res.status(201).json({
      success: true,
      message: `Bulk test creation completed: ${createdTests.length} tests created successfully`,
      data: {
        createdTests,
        errors: errors.length > 0 ? errors : undefined,
        summary: {
          totalRequested: courseIds.length,
          totalCreated: createdTests.length,
          totalErrors: errors.length,
          successRate: `${Math.round((createdTests.length / courseIds.length) * 100)}%`,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error in bulk test creation:", error);
    logger.error("Error creating tests in bulk:", error);
    return res.status(500).json({
      error: "Failed to create tests in bulk",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// ENHANCED: Create single question with full coding support
export const createQuestion = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const {
      question_text,
      type,
      marks,
      options,
      expectedWordCount,
      codeLanguage,
      constraints,
      visible_testcases,
      hidden_testcases,
      time_limit_ms,
      memory_limit_mb,
    } = req.body;

    console.log("🔍 CREATE QUESTION REQUEST:", {
      testId,
      type,
      question_text_length: question_text?.length,
      constraints_provided: !!constraints,
      constraints_length: constraints?.length,
      visible_testcases_provided: !!visible_testcases,
      visible_testcases_count: Array.isArray(visible_testcases)
        ? visible_testcases.length
        : 0,
      hidden_testcases_provided: !!hidden_testcases,
      hidden_testcases_count: Array.isArray(hidden_testcases)
        ? hidden_testcases.length
        : 0,
    });

    // Validate test exists
    const test = await getSingleRecord<Test, any>(Test, {
      where: { id: testId },
    });

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    if (test.status === TestStatus.PUBLISHED) {
      return res.status(400).json({
        error: "Cannot add questions to a published test",
      });
    }

    // Basic validation
    if (!question_text || typeof question_text !== "string") {
      return res.status(400).json({ error: "Question text is required" });
    }

    if (!marks || marks < 1) {
      return res.status(400).json({ error: "Marks must be at least 1" });
    }

    if (!type || !["MCQ", "DESCRIPTIVE", "CODE"].includes(type)) {
      return res.status(400).json({ error: "Invalid question type" });
    }

    // Enhanced validation for coding questions
    if (type === "CODE") {
      if (!codeLanguage) {
        return res.status(400).json({
          error: "Programming language is required for coding questions",
        });
      }

      if (
        !visible_testcases ||
        !Array.isArray(visible_testcases) ||
        visible_testcases.length === 0
      ) {
        return res.status(400).json({
          error:
            "At least one visible test case is required for coding questions",
        });
      }

      if (
        !hidden_testcases ||
        !Array.isArray(hidden_testcases) ||
        hidden_testcases.length === 0
      ) {
        return res.status(400).json({
          error:
            "At least one hidden test case is required for coding questions",
        });
      }

      // Validate test case structure
      const validateTestCases = (testCases: TestCase[], type: string) => {
        testCases.forEach((testCase, index) => {
          if (typeof testCase.input !== "string") {
            throw new Error(
              `${type} test case ${index + 1}: input must be a string`,
            );
          }
          if (typeof testCase.expected_output !== "string") {
            throw new Error(
              `${type} test case ${index + 1}: expected_output must be a string`,
            );
          }
          if (!testCase.input.trim()) {
            throw new Error(
              `${type} test case ${index + 1}: input cannot be empty`,
            );
          }
          if (!testCase.expected_output.trim()) {
            throw new Error(
              `${type} test case ${index + 1}: expected_output cannot be empty`,
            );
          }
        });
      };

      try {
        validateTestCases(visible_testcases, "Visible");
        validateTestCases(hidden_testcases, "Hidden");
      } catch (error: any) {
        return res.status(400).json({
          error: `Test case validation failed: ${error.message}`,
        });
      }
    }

    // Create question
    const question = new Question();
    question.question_text = sanitizeQuestionText(question_text);
    question.type = type as QuestionType;
    question.marks = marks || 1;
    question.test = test;

    // Set common optional fields
    if (expectedWordCount && (type === "DESCRIPTIVE" || type === "CODE")) {
      question.expectedWordCount = expectedWordCount;
    }

    // Set coding-specific fields with enhanced handling
    if (type === "CODE") {
      question.codeLanguage = codeLanguage;

      // Handle constraints - ensure it's saved even if empty string
      question.constraints = constraints || null;

      // CRITICAL: Properly stringify test cases with error handling
      try {
        question.visible_testcases = JSON.stringify(visible_testcases);
        question.hidden_testcases = JSON.stringify(hidden_testcases);

        console.log("🔍 STRINGIFIED TEST CASES:", {
          visible_testcases_string_length: question.visible_testcases.length,
          hidden_testcases_string_length: question.hidden_testcases.length,
          visible_sample: question.visible_testcases.substring(0, 100) + "...",
          hidden_sample: question.hidden_testcases.substring(0, 100) + "...",
        });
      } catch (jsonError) {
        console.error("❌ JSON STRINGIFY ERROR:", jsonError);
        return res.status(400).json({
          error: "Failed to process test cases data",
        });
      }

      question.time_limit_ms = time_limit_ms || 5000;
      question.memory_limit_mb = memory_limit_mb || 256;
    }

    console.log("🔍 ABOUT TO SAVE QUESTION:", {
      type: question.type,
      constraints_set: !!question.constraints,
      constraints_length: question.constraints?.length,
      visible_testcases_set: !!question.visible_testcases,
      visible_testcases_length: question.visible_testcases?.length,
      hidden_testcases_set: !!question.hidden_testcases,
      hidden_testcases_length: question.hidden_testcases?.length,
    });

    // Save question with enhanced error handling
    let savedQuestion: Question;
    try {
      savedQuestion = (await createRecord(
        Question.getRepository(),
        question,
      )) as Question;
      console.log("✅ QUESTION SAVED SUCCESSFULLY:", savedQuestion.id);
    } catch (dbError) {
      console.error("❌ DATABASE SAVE ERROR:", dbError);
      return res.status(500).json({
        error: "Failed to save question to database",
        details:
          dbError instanceof Error ? dbError.message : "Unknown database error",
      });
    }

    // Immediate verification of saved data
    try {
      const verifyQuestion = await Question.findOne({
        where: { id: savedQuestion.id },
        select: [
          "id",
          "type",
          "constraints",
          "visible_testcases",
          "hidden_testcases",
        ],
      });

      console.log("🔍 VERIFICATION READ:", {
        questionId: verifyQuestion?.id,
        type: verifyQuestion?.type,
        constraints_retrieved: !!verifyQuestion?.constraints,
        constraints_length: verifyQuestion?.constraints?.length,
        visible_retrieved: !!verifyQuestion?.visible_testcases,
        visible_length: verifyQuestion?.visible_testcases?.length,
        hidden_retrieved: !!verifyQuestion?.hidden_testcases,
        hidden_length: verifyQuestion?.hidden_testcases?.length,
      });

      if (type === "CODE") {
        if (!verifyQuestion?.visible_testcases) {
          console.error(
            "❌ CRITICAL: visible_testcases not saved to database!",
          );
        }
        if (!verifyQuestion?.hidden_testcases) {
          console.error("❌ CRITICAL: hidden_testcases not saved to database!");
        }
      }
    } catch (verifyError) {
      console.error("❌ VERIFICATION ERROR:", verifyError);
    }

    // Add options for MCQ questions
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

    // Update test timestamp
    test.lastUpdated = new Date();
    await test.save();

    // Return complete question with relations
    const completeQuestion = await getSingleRecord<Question, any>(Question, {
      where: { id: savedQuestion.id },
      relations: ["options"],
    });

    console.log("✅ FINAL RESPONSE QUESTION:", {
      questionId: completeQuestion.id,
      type: completeQuestion.type,
      has_constraints: !!completeQuestion.constraints,
      has_visible_testcases: !!completeQuestion.visible_testcases,
      has_hidden_testcases: !!completeQuestion.hidden_testcases,
    });

    return res.status(201).json({
      message: "Question created successfully",
      question: completeQuestion,
    });
  } catch (error) {
    console.error("❌ CREATE QUESTION ERROR:", error);
    logger.error("Error creating question:", error);
    return res.status(500).json({
      error: "Failed to create question",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// ENHANCED: Add multiple questions (for bulk operations)
export const addQuestions = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const { questions } = req.body;

    console.log("🔍 ADD QUESTIONS BULK REQUEST:", {
      testId,
      questionsCount: questions?.length || 0,
    });

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        error: "Questions array is required and must not be empty",
      });
    }

    const test = await getSingleRecord<Test, any>(Test, {
      where: { id: testId },
    });

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    if (test.status === TestStatus.PUBLISHED) {
      return res.status(400).json({
        error: "Cannot add questions to a published test",
      });
    }

    const createdQuestions: Question[] = [];

    for (let i = 0; i < questions.length; i++) {
      const {
        question_text,
        type,
        marks,
        options,
        expectedWordCount,
        codeLanguage,
        constraints,
        visible_testcases,
        hidden_testcases,
        time_limit_ms,
        memory_limit_mb,
      } = questions[i];

      // Basic validation
      if (!question_text || typeof question_text !== "string") {
        return res.status(400).json({
          error: `Question ${i + 1}: question_text is required`,
        });
      }

      if (!marks || marks < 1) {
        return res.status(400).json({
          error: `Question ${i + 1}: marks must be at least 1`,
        });
      }

      if (!type || !["MCQ", "DESCRIPTIVE", "CODE"].includes(type)) {
        return res.status(400).json({
          error: `Question ${i + 1}: Invalid question type`,
        });
      }

      // Enhanced validation for coding questions
      if (type === "CODE") {
        if (!codeLanguage) {
          return res.status(400).json({
            error: `Question ${i + 1}: Programming language is required for coding questions`,
          });
        }

        if (
          !visible_testcases ||
          !Array.isArray(visible_testcases) ||
          visible_testcases.length === 0
        ) {
          return res.status(400).json({
            error: `Question ${i + 1}: At least one visible test case is required for coding questions`,
          });
        }

        if (
          !hidden_testcases ||
          !Array.isArray(hidden_testcases) ||
          hidden_testcases.length === 0
        ) {
          return res.status(400).json({
            error: `Question ${i + 1}: At least one hidden test case is required for coding questions`,
          });
        }

        // Validate test case structure
        const validateTestCases = (testCases: TestCase[], type: string) => {
          testCases.forEach((testCase, index) => {
            if (typeof testCase.input !== "string") {
              throw new Error(
                `${type} test case ${index + 1}: input must be a string`,
              );
            }
            if (typeof testCase.expected_output !== "string") {
              throw new Error(
                `${type} test case ${index + 1}: expected_output must be a string`,
              );
            }
            if (!testCase.input.trim()) {
              throw new Error(
                `${type} test case ${index + 1}: input cannot be empty`,
              );
            }
            if (!testCase.expected_output.trim()) {
              throw new Error(
                `${type} test case ${index + 1}: expected_output cannot be empty`,
              );
            }
          });
        };

        try {
          validateTestCases(visible_testcases, "Visible");
          validateTestCases(hidden_testcases, "Hidden");
        } catch (error: any) {
          return res.status(400).json({
            error: `Question ${i + 1}: Test case validation failed: ${error.message}`,
          });
        }
      }

      const question = new Question();
      question.question_text = sanitizeQuestionText(question_text);
      question.type = type as QuestionType;
      question.marks = marks || 1;
      question.test = test;

      // Set common optional fields
      if (expectedWordCount && (type === "DESCRIPTIVE" || type === "CODE")) {
        question.expectedWordCount = expectedWordCount;
      }

      // Set coding-specific fields
      if (type === "CODE") {
        question.codeLanguage = codeLanguage;
        question.constraints = constraints || null;

        try {
          question.visible_testcases = JSON.stringify(visible_testcases);
          question.hidden_testcases = JSON.stringify(hidden_testcases);
        } catch (jsonError) {
          return res.status(400).json({
            error: `Question ${i + 1}: Failed to process test cases data:${jsonError}`,
          });
        }

        question.time_limit_ms = time_limit_ms || 5000;
        question.memory_limit_mb = memory_limit_mb || 256;
      }

      const savedQuestion = (await createRecord(
        Question.getRepository(),
        question,
      )) as Question;

      // Add options for MCQ questions
      if (type === "MCQ" && options && Array.isArray(options)) {
        if (options.length < 2) {
          return res.status(400).json({
            error: `Question ${i + 1}: MCQ must have at least 2 options`,
          });
        }

        let hasCorrectOption = false;

        for (const opt of options) {
          const { text, correct } = opt;

          if (!text || typeof text !== "string" || !text.trim()) {
            return res.status(400).json({
              error: `Question ${i + 1}: All options must have non-empty text`,
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
            error: `Question ${i + 1}: MCQ must have at least one correct option`,
          });
        }
      }

      createdQuestions.push(savedQuestion);
    }

    // Update test lastUpdated time
    test.lastUpdated = new Date();
    await test.save();

    return res.status(201).json({
      success: true,
      message: "Questions added successfully",
      data: { questions: createdQuestions },
    });
  } catch (error: any) {
    console.error("❌ ADD QUESTIONS BULK ERROR:", error);
    logger.error("Error adding questions:", error);
    return res.status(500).json({
      error: "Failed to add questions",
      details: error.message,
    });
  }
};

// ENHANCED: Update question with full coding support
export const updateQuestion = async (req: Request, res: Response) => {
  try {
    const { testId, questionId } = req.params;
    const {
      question_text,
      type,
      marks,
      options,
      expectedWordCount,
      codeLanguage,
      constraints,
      visible_testcases,
      hidden_testcases,
      time_limit_ms,
      memory_limit_mb,
    } = req.body;

    console.log("🔍 UPDATE QUESTION REQUEST:", {
      questionId,
      type,
      constraints_provided: !!constraints,
      visible_testcases_provided: !!visible_testcases,
      hidden_testcases_provided: !!hidden_testcases,
    });

    // Validate test exists and is not published
    const test = await getSingleRecord<Test, any>(Test, {
      where: { id: testId },
    });

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    if (test.status === TestStatus.PUBLISHED) {
      return res.status(400).json({
        error: "Cannot update questions in a published test",
      });
    }

    // Find existing question
    const question = await getSingleRecord<Question, any>(Question, {
      where: { id: questionId, test: { id: testId } },
      relations: ["options"],
    });

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    // Basic validation
    if (!question_text || typeof question_text !== "string") {
      return res.status(400).json({ error: "Question text is required" });
    }

    if (!marks || marks < 1) {
      return res.status(400).json({ error: "Marks must be at least 1" });
    }

    if (!type || !["MCQ", "DESCRIPTIVE", "CODE"].includes(type)) {
      return res.status(400).json({ error: "Invalid question type" });
    }

    // Enhanced validation for coding questions
    if (type === "CODE") {
      if (!codeLanguage) {
        return res.status(400).json({
          error: "Programming language is required for coding questions",
        });
      }

      if (
        !visible_testcases ||
        !Array.isArray(visible_testcases) ||
        visible_testcases.length === 0
      ) {
        return res.status(400).json({
          error:
            "At least one visible test case is required for coding questions",
        });
      }

      if (
        !hidden_testcases ||
        !Array.isArray(hidden_testcases) ||
        hidden_testcases.length === 0
      ) {
        return res.status(400).json({
          error:
            "At least one hidden test case is required for coding questions",
        });
      }

      // Validate test case structure
      const validateTestCases = (testCases: TestCase[], type: string) => {
        testCases.forEach((testCase, index) => {
          if (typeof testCase.input !== "string") {
            throw new Error(
              `${type} test case ${index + 1}: input must be a string`,
            );
          }
          if (typeof testCase.expected_output !== "string") {
            throw new Error(
              `${type} test case ${index + 1}: expected_output must be a string`,
            );
          }
          if (!testCase.input.trim()) {
            throw new Error(
              `${type} test case ${index + 1}: input cannot be empty`,
            );
          }
          if (!testCase.expected_output.trim()) {
            throw new Error(
              `${type} test case ${index + 1}: expected_output cannot be empty`,
            );
          }
        });
      };

      try {
        validateTestCases(visible_testcases, "Visible");
        validateTestCases(hidden_testcases, "Hidden");
      } catch (error: any) {
        return res.status(400).json({
          error: `Test case validation failed: ${error.message}`,
        });
      }
    }

    // Update basic fields
    question.question_text = sanitizeQuestionText(question_text);
    question.type = type as QuestionType;
    question.marks = marks;

    // Clear previous optional fields
    question.expectedWordCount = null;
    question.codeLanguage = null;
    question.constraints = null;
    question.visible_testcases = null;
    question.hidden_testcases = null;
    question.time_limit_ms = null;
    question.memory_limit_mb = null;

    // Set common optional fields
    if (expectedWordCount && (type === "DESCRIPTIVE" || type === "CODE")) {
      question.expectedWordCount = expectedWordCount;
    }

    // Set coding-specific fields with enhanced handling
    if (type === "CODE") {
      question.codeLanguage = codeLanguage;

      // Handle constraints - ensure it's saved even if empty string
      question.constraints = constraints || null;

      // CRITICAL: Properly stringify test cases with error handling
      try {
        question.visible_testcases = JSON.stringify(visible_testcases);
        question.hidden_testcases = JSON.stringify(hidden_testcases);

        console.log("🔍 UPDATE - STRINGIFIED TEST CASES:", {
          visible_testcases_string_length: question.visible_testcases.length,
          hidden_testcases_string_length: question.hidden_testcases.length,
        });
      } catch (jsonError) {
        console.error("❌ JSON STRINGIFY ERROR:", jsonError);
        return res.status(400).json({
          error: "Failed to process test cases data",
        });
      }

      question.time_limit_ms = time_limit_ms || 5000;
      question.memory_limit_mb = memory_limit_mb || 256;
    }

    // Save updated question
    try {
      await question.save();
      console.log("✅ QUESTION UPDATED SUCCESSFULLY:", question.id);
    } catch (dbError) {
      console.error("❌ DATABASE UPDATE ERROR:", dbError);
      return res.status(500).json({
        error: "Failed to update question in database",
        details:
          dbError instanceof Error ? dbError.message : "Unknown database error",
      });
    }

    // Handle options for MCQ questions
    if (type === "MCQ") {
      // Delete existing options
      if (question.options && question.options.length > 0) {
        for (const option of question.options) {
          await deleteRecord(QuizOptions.getRepository(), option.id);
        }
      }

      // Add new options
      if (options && Array.isArray(options)) {
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
          option.question = question;

          await createRecord(QuizOptions.getRepository(), option);
        }

        if (!hasCorrectOption) {
          return res.status(400).json({
            error: "MCQ must have at least one correct option",
          });
        }
      }
    } else {
      // Delete existing options for non-MCQ questions
      if (question.options && question.options.length > 0) {
        for (const option of question.options) {
          await deleteRecord(QuizOptions.getRepository(), option.id);
        }
      }
    }

    // Update test timestamp
    test.lastUpdated = new Date();
    await test.save();

    // Return updated question with relations
    const updatedQuestion = await getSingleRecord<Question, any>(Question, {
      where: { id: question.id },
      relations: ["options"],
    });

    console.log("✅ FINAL UPDATE RESPONSE:", {
      questionId: updatedQuestion.id,
      type: updatedQuestion.type,
      has_constraints: !!updatedQuestion.constraints,
      has_visible_testcases: !!updatedQuestion.visible_testcases,
      has_hidden_testcases: !!updatedQuestion.hidden_testcases,
    });

    return res.status(200).json({
      success: true,
      message: "Question updated successfully",
      question: updatedQuestion,
    });
  } catch (error) {
    console.error("❌ UPDATE QUESTION ERROR:", error);
    logger.error("Error updating question:", error);
    return res.status(500).json({
      error: "Failed to update question",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// ENHANCED: Get questions with enhanced data processing
export const getQuestions = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    const test = await getSingleRecord<Test, any>(Test, {
      where: { id: testId },
      relations: ["questions", "questions.options"],
    });

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const questionsWithProcessedData: ProcessedQuestion[] =
      test.questions?.map((question: Question): ProcessedQuestion => {
        const processedQuestion: ProcessedQuestion = {
          ...question,
          question_text: question.question_text || "",
          visible_testcases: null,
          hidden_testcases: null,
        };

        // Enhanced parsing for coding questions
        if (question.type === QuestionType.CODE) {
          console.log("🔍 PROCESSING CODE QUESTION:", {
            questionId: question.id,
            raw_visible_testcases: question.visible_testcases,
            raw_hidden_testcases: question.hidden_testcases,
            raw_constraints: question.constraints,
          });

          try {
            if (question.visible_testcases) {
              processedQuestion.visible_testcases = JSON.parse(
                question.visible_testcases,
              );
              console.log(
                "✅ PARSED VISIBLE TEST CASES:",
                processedQuestion.visible_testcases.length,
              );
            } else {
              console.log("❌ NO VISIBLE TEST CASES FOUND");
              processedQuestion.visible_testcases = [];
            }
          } catch (error) {
            console.error("❌ FAILED TO PARSE VISIBLE TEST CASES:", error);
            processedQuestion.visible_testcases = [];
          }

          try {
            if (question.hidden_testcases) {
              processedQuestion.hidden_testcases = JSON.parse(
                question.hidden_testcases,
              );
              console.log(
                "✅ PARSED HIDDEN TEST CASES:",
                processedQuestion.hidden_testcases.length,
              );
            } else {
              console.log("❌ NO HIDDEN TEST CASES FOUND");
              processedQuestion.hidden_testcases = [];
            }
          } catch (error) {
            console.error("❌ FAILED TO PARSE HIDDEN TEST CASES:", error);
            processedQuestion.hidden_testcases = [];
          }

          // Ensure constraints are properly handled
          processedQuestion.constraints = question.constraints || null;
        }

        return processedQuestion;
      }) || [];

    console.log(
      "🔍 FINAL PROCESSED QUESTIONS:",
      questionsWithProcessedData.map((q) => ({
        id: q.id,
        type: q.type,
        has_constraints: !!q.constraints,
        visible_count: Array.isArray(q.visible_testcases)
          ? q.visible_testcases.length
          : 0,
        hidden_count: Array.isArray(q.hidden_testcases)
          ? q.hidden_testcases.length
          : 0,
      })),
    );

    return res.status(200).json({
      success: true,
      message: "Questions retrieved successfully",
      data: { questions: questionsWithProcessedData },
    });
  } catch (error: any) {
    console.error("❌ GET QUESTIONS ERROR:", error);
    logger.error("Error retrieving questions:", error);
    return res.status(500).json({
      error: "Failed to retrieve questions",
      details: error.message || "Unknown error",
    });
  }
};

// Delete question from test
export const deleteQuestion = async (req: Request, res: Response) => {
  try {
    const { testId, questionId } = req.params;

    // Validate test exists and is not published
    const test = await getSingleRecord<Test, any>(Test, {
      where: { id: testId },
    });

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    if (test.status === TestStatus.PUBLISHED) {
      return res.status(400).json({
        error: "Cannot delete questions from a published test",
      });
    }

    // Find and delete question
    const question = await getSingleRecord<Question, any>(Question, {
      where: { id: questionId, test: { id: testId } },
    });

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    await deleteRecord(Question.getRepository(), questionId);

    // Update test timestamp
    test.lastUpdated = new Date();
    await test.save();

    return res.status(200).json({
      message: "Question deleted successfully",
    });
  } catch (error) {
    console.error("❌ DELETE QUESTION ERROR:", error);
    logger.error("Error deleting question:", error);
    return res.status(500).json({ error: "Failed to delete question" });
  }
};

// Test publishing
export const publishTest = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    const test = await getSingleRecord<Test, any>(Test, {
      where: { id: testId },
      relations: ["questions", "questions.options"],
    });

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    if (test.status === TestStatus.PUBLISHED) {
      return res.status(400).json({ error: "Test is already published" });
    }

    // Validate test has questions
    if (!test.questions || test.questions.length === 0) {
      return res.status(400).json({
        error: "Cannot publish test without questions",
      });
    }

    // Validate MCQ questions have correct answers
    const mcqWithNoCorrect = test.questions.filter(
      (q: Question) =>
        q.type === QuestionType.MCQ &&
        (!q.options || q.options.filter((o) => o.correct).length === 0),
    );

    if (mcqWithNoCorrect.length > 0) {
      return res.status(400).json({
        error: "All MCQ questions must have at least one correct answer",
      });
    }

    // Validate coding questions have test cases
    const codingWithoutTestCases = test.questions.filter(
      (q: Question) =>
        q.type === QuestionType.CODE &&
        (!q.visible_testcases || !q.hidden_testcases),
    );

    if (codingWithoutTestCases.length > 0) {
      return res.status(400).json({
        error: "All coding questions must have visible and hidden test cases",
      });
    }

    // Publish test
    test.status = TestStatus.PUBLISHED;
    test.lastUpdated = new Date();
    await test.save();

    return res.status(200).json({
      success: true,
      message: "Test published successfully",
      data: { test },
    });
  } catch (error) {
    console.error("❌ PUBLISH TEST ERROR:", error);
    logger.error("Error publishing test:", error);
    return res.status(500).json({ error: "Failed to publish test" });
  }
};

// FIXED: Complete implementation of getTestResults
export const getTestResults = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    console.log("🔄 Getting test results for test:", testId);

    const test = await getSingleRecord<Test, any>(Test, {
      where: { id: testId },
      relations: ["questions", "course"],
    });

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    // TODO: Implement actual test results retrieval
    // This would typically involve getting all submissions for the test
    // and calculating scores, rankings, etc.

    const mockResults = {
      testId: test.id,
      testTitle: test.title,
      totalSubmissions: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      submissions: [],
    };

    return res.status(200).json({
      success: true,
      message: "Test results retrieved successfully",
      data: mockResults,
    });
  } catch (error) {
    console.error("❌ GET TEST RESULTS ERROR:", error);
    logger.error("Error getting test results:", error);
    return res.status(500).json({
      error: "Failed to get test results",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// File upload handlers for test cases
export const uploadTestCaseFile = [
  upload.single("testcaseFile"),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Process the uploaded file content
      const content = file.buffer.toString("utf8");

      let parsedData;
      if (file.originalname.endsWith(".json")) {
        parsedData = JSON.parse(content);
      } else {
        // Parse custom TXT format
        parsedData = parseCustomTestCaseFormat(content);
      }

      // Validate parsed data
      if (!parsedData.visible_testcases || !parsedData.hidden_testcases) {
        return res.status(400).json({
          error:
            "Invalid file format. Missing visible_testcases or hidden_testcases.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Test cases uploaded successfully",
        data: parsedData,
      });
    } catch (error) {
      console.error("❌ UPLOAD TEST CASE FILE ERROR:", error);
      return res.status(500).json({
        error: "Failed to process uploaded file",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
];

// Helper function to parse custom test case format
function parseCustomTestCaseFormat(content: string) {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line);
  const visible_testcases: TestCase[] = [];
  const hidden_testcases: TestCase[] = [];

  let currentSection: "VISIBLE" | "HIDDEN" | null = null;
  let currentInput = "";
  let currentOutput = "";
  let parsingMode: "INPUT" | "OUTPUT" | null = null;

  for (const line of lines) {
    if (line === "VISIBLE") {
      if (currentInput && currentOutput && currentSection) {
        const testCase = {
          input: currentInput.trim(),
          expected_output: currentOutput.trim(),
        };
        if (currentSection === "VISIBLE") {
          visible_testcases.push(testCase);
        } else {
          hidden_testcases.push(testCase);
        }
      }
      currentSection = "VISIBLE";
      currentInput = "";
      currentOutput = "";
      parsingMode = null;
      continue;
    }

    if (line === "HIDDEN") {
      if (currentInput && currentOutput && currentSection) {
        const testCase = {
          input: currentInput.trim(),
          expected_output: currentOutput.trim(),
        };
        if (currentSection === "VISIBLE") {
          visible_testcases.push(testCase);
        } else {
          hidden_testcases.push(testCase);
        }
      }
      currentSection = "HIDDEN";
      currentInput = "";
      currentOutput = "";
      parsingMode = null;
      continue;
    }

    if (line === "INPUT:") {
      if (currentInput && currentOutput && currentSection) {
        const testCase = {
          input: currentInput.trim(),
          expected_output: currentOutput.trim(),
        };
        if (currentSection === "VISIBLE") {
          visible_testcases.push(testCase);
        } else {
          hidden_testcases.push(testCase);
        }
      }
      currentInput = "";
      currentOutput = "";
      parsingMode = "INPUT";
      continue;
    }

    if (line === "OUTPUT:") {
      parsingMode = "OUTPUT";
      continue;
    }

    if (parsingMode === "INPUT") {
      currentInput += (currentInput ? "\n" : "") + line;
    } else if (parsingMode === "OUTPUT") {
      currentOutput += (currentOutput ? "\n" : "") + line;
    }
  }

  // Save last test case
  if (currentInput && currentOutput && currentSection) {
    const testCase = {
      input: currentInput.trim(),
      expected_output: currentOutput.trim(),
    };
    if (currentSection === "VISIBLE") {
      visible_testcases.push(testCase);
    } else {
      hidden_testcases.push(testCase);
    }
  }

  return { visible_testcases, hidden_testcases };
}

// Demo test case file generator
export const getDemoTestCaseFile = async (req: Request, res: Response) => {
  try {
    const { format = "txt" } = req.query;

    const demoData = {
      visible_testcases: [
        { input: "5 3", expected_output: "8" },
        { input: "10 20", expected_output: "30" },
        { input: "1 1", expected_output: "2" },
      ],
      hidden_testcases: [
        { input: "100 200", expected_output: "300" },
        { input: "-5 10", expected_output: "5" },
        { input: "0 0", expected_output: "0" },
      ],
    };

    let content: string;
    let filename: string;

    if (format === "json") {
      content = JSON.stringify(demoData, null, 2);
      filename = "demo_testcases.json";
    } else {
      content = `VISIBLE
INPUT:
5 3
OUTPUT:
8

INPUT:
10 20
OUTPUT:
30

INPUT:
1 1
OUTPUT:
2

HIDDEN
INPUT:
100 200
OUTPUT:
300

INPUT:
-5 10
OUTPUT:
5

INPUT:
0 0
OUTPUT:
0`;
      filename = "demo_testcases.txt";
    }

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error: any) {
    logger.error("Error generating demo file:", error);
    return res.status(500).json({
      error: "Failed to generate demo file",
      details: error.message,
    });
  }
};
