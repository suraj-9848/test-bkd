// Test Analytics: Number of students who gave and did not give the test
import { UserCourse } from "../../db/mysqlModels/UserCourse";
import { User } from "../../db/mysqlModels/User";

export const getTestAnalytics = async (req: Request, res: Response) => {
  try {
    const { batchId, courseId, testId } = req.params;

    // 1. Get all students enrolled in the course (UserCourse)
    const userCourses = await UserCourse.find({
      where: { course: { id: courseId } },
      relations: ["user"],
    });
    const allStudentIds = userCourses.map((uc) => uc.user.id);

    // 2. Get all students who submitted the test (TestSubmission)
    const testSubmissions = await TestSubmission.find({
      where: { test: { id: testId } },
      relations: ["user"],
    });
    const submittedStudentIds = testSubmissions.map((ts) => ts.user.id);

    // 3. Calculate who gave and who did not give the test
    const studentsWhoGave = allStudentIds.filter((id) =>
      submittedStudentIds.includes(id)
    );
    const studentsWhoDidNotGive = allStudentIds.filter(
      (id) => !submittedStudentIds.includes(id)
    );

    // Optionally, fetch student details
    const studentsGave = userCourses
      .filter((uc) => studentsWhoGave.includes(uc.user.id))
      .map((uc) => ({
        id: uc.user.id,
        username: uc.user.username,
        email: uc.user.email,
      }));
    const studentsNotGave = userCourses
      .filter((uc) => studentsWhoDidNotGive.includes(uc.user.id))
      .map((uc) => ({
        id: uc.user.id,
        username: uc.user.username,
        email: uc.user.email,
      }));

    return res.status(200).json({
      totalEnrolled: allStudentIds.length,
      gaveTest: studentsWhoGave.length,
      didNotGiveTest: studentsWhoDidNotGive.length,
      studentsGave,
      studentsNotGave,
    });
  } catch (error) {
    console.error("Error in getTestAnalytics:", error);
    return res.status(500).json({ error: "Failed to fetch test analytics" });
  }
};
import { Request, Response } from "express";
import { Test, TestStatus } from "../../db/mysqlModels/Test";
import { Question, QuestionType } from "../../db/mysqlModels/Question";
import { Course } from "../../db/mysqlModels/Course";
import { QuizOptions } from "../../db/mysqlModels/QuizOptions";
import {
  createRecord,
  updateRecords,
  getSingleRecord,
  deleteRecords,
  getAllRecordsWithFilter,
} from "../../lib/dbLib/sqlUtils";
import { redisClient } from "../../db/connect";
import { TestSubmission } from "../../db/mysqlModels/TestSubmission";
import { TestResponse } from "../../db/mysqlModels/TestResponse";

import { validate } from "class-validator";
import sanitizeHtml from "sanitize-html";
import { LessThanOrEqual, MoreThanOrEqual } from "typeorm";

const logger =
  require("../../utils/logger").getLoggerByName("QuestionController");
export const createTest = async (req: Request, res: Response) => {
  const { courseId } = req.params;
  const {
    title,
    description = "",
    maxMarks,
    passingMarks = 0,
    durationInMinutes,
    startDate,
    endDate,
    shuffleQuestions = false,
    showResults = false,
    showCorrectAnswers = false,
    maxAttempts = 1,
  } = req.body;

  // Validation for required fields
  if (
    !title ||
    maxMarks === undefined ||
    !durationInMinutes ||
    !startDate ||
    !endDate
  ) {
    return res.status(400).json({
      error:
        "Missing required fields: title, maxMarks, durationInMinutes, startDate, endDate",
    });
  }

  // Additional validations
  if (typeof maxMarks !== "number" || maxMarks < 0 || passingMarks < 0) {
    return res
      .status(400)
      .json({ error: "Marks must be non-negative numbers" });
  }
  if (passingMarks > maxMarks) {
    return res
      .status(400)
      .json({ error: "Passing marks cannot exceed max marks" });
  }
  if (new Date(endDate) <= new Date(startDate)) {
    return res.status(400).json({ error: "End date must be after start date" });
  }
  if (typeof durationInMinutes !== "number" || durationInMinutes <= 0) {
    return res
      .status(400)
      .json({ error: "Duration must be a positive number" });
  }
  if (typeof maxAttempts !== "number" || maxAttempts < 1) {
    return res.status(400).json({ error: "Max attempts must be at least 1" });
  }
  if (
    typeof shuffleQuestions !== "boolean" ||
    typeof showResults !== "boolean" ||
    typeof showCorrectAnswers !== "boolean"
  ) {
    return res
      .status(400)
      .json({ error: "Boolean fields must be true or false" });
  }

  try {
    // Verify course exists
    const course = await getSingleRecord<Course, any>(
      Course,
      { where: { id: courseId } },
      `course:${courseId}`
    );

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Create new test instance
    const test = new Test();
    test.title = title;
    test.description = description;
    test.questions = []; // Initialize with empty array
    test.maxMarks = maxMarks;
    test.passingMarks = passingMarks;
    test.durationInMinutes = durationInMinutes;
    test.startDate = new Date(startDate);
    test.endDate = new Date(endDate);
    test.course = course;
    test.status = TestStatus.DRAFT;
    test.shuffleQuestions = shuffleQuestions;
    test.showResults = showResults;
    test.showCorrectAnswers = showCorrectAnswers;
    test.maxAttempts = maxAttempts;

    // Validate entity
    const errors = await validate(test);
    if (errors.length > 0) {
      return res
        .status(400)
        .json({ error: "Validation failed", details: errors });
    }

    // Save the test
    const newTest = await createRecord<Test>(
      Test.getRepository(),
      test,
      `test:course:${courseId}:new`,
      600
    );

    return res.status(201).json({
      message: "Test created successfully",
      data: { test: newTest },
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to create test",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const fetchTestsInCourse = async (req: Request, res: Response) => {
  const { courseId } = req.params;

  // Validate courseId
  if (!courseId || typeof courseId !== "string") {
    return res.status(400).json({ error: "Invalid course ID" });
  }

  try {
    const course = await getSingleRecord<Course, any>(
      Course,
      { where: { id: courseId } },
      `course:${courseId}`,
      false
    );

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    const tests = await Test.find({
      where: { course: { id: courseId } },
      relations: ["course"],
      order: { createdAt: "DESC" },
    });

    return res.status(200).json({
      message: "Tests fetched successfully",
      data: { tests },
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch tests",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const fetchTestById = async (req: Request, res: Response) => {
  const { testId } = req.params;

  // Validate testId
  if (!testId || typeof testId !== "string") {
    return res.status(400).json({ error: "Invalid test ID" });
  }

  try {
    const test = await getSingleRecord<Test, any>(
      Test,
      { where: { id: testId }, relations: ["course", "questions"] },
      `test:${testId}`
    );

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    return res.status(200).json({
      message: "Test fetched successfully",
      data: { test },
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch test",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateTest = async (req: Request, res: Response) => {
  const { testId, courseId } = req.params;
  const updateData = req.body;

  // Validate parameters
  if (!testId || !courseId) {
    return res.status(400).json({
      error: "Invalid parameters",
      details: "Test ID and Course ID are required",
    });
  }

  try {
    // First fetch the test with course relation
    const test = await Test.findOne({
      where: {
        id: testId,
        course: { id: courseId },
      },
      relations: ["course"],
    });

    if (!test) {
      return res
        .status(404)
        .json({ error: "Test not found in the specified course" });
    }

    // Check if test has started
    const currentDate = new Date();
    if (currentDate >= test.startDate) {
      return res.status(400).json({
        error: "Cannot update test after it has started",
      });
    }

    // Update allowed fields only
    const allowedUpdates = [
      "title",
      "description",
      "maxMarks",
      "passingMarks",
      "durationInMinutes",
      "startDate",
      "endDate",
      "shuffleQuestions",
      "showResults",
      "showCorrectAnswers",
      "maxAttempts",
    ];

    const filteredUpdateData = Object.keys(updateData)
      .filter((key) => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = updateData[key];
        return obj;
      }, {});

    // Apply updates
    Object.assign(test, filteredUpdateData);

    // Validate the updated entity
    const errors = await validate(test);
    if (errors.length > 0) {
      return res.status(400).json({
        error: "Validation failed",
        details: errors,
      });
    }

    // Save changes
    const updatedTest = await Test.save(test);

    return res.status(200).json({
      message: "Test updated successfully",
      data: { test: updatedTest },
    });
  } catch (error) {
    console.error("Update test error:", error);
    return res.status(500).json({
      error: "Failed to update test",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const deleteTest = async (req: Request, res: Response) => {
  const { testId } = req.params;

  // Validate testId
  if (!testId || typeof testId !== "string") {
    return res.status(400).json({ error: "Invalid test ID" });
  }

  try {
    // Fetch test with questions and options
    const test = await Test.findOne({
      where: { id: testId },
      relations: ["questions", "questions.options"],
    });

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    // Delete in correct order to handle foreign key constraints
    if (test.questions && test.questions.length > 0) {
      // First delete all quiz options
      for (const question of test.questions) {
        if (question.options && question.options.length > 0) {
          await QuizOptions.createQueryBuilder()
            .delete()
            .where("questionId = :questionId", { questionId: question.id })
            .execute();
        }
      }

      // Then delete all questions
      await Question.createQueryBuilder()
        .delete()
        .where("testId = :testId", { testId: test.id })
        .execute();
    }

    // Finally delete the test
    await Test.createQueryBuilder()
      .delete()
      .where("id = :id", { id: test.id })
      .execute();

    return res.status(200).json({
      message: "Test and all related content deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting test:", error);
    return res.status(500).json({
      error: "Failed to delete test",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const teststatustoPublish = async (req: Request, res: Response) => {
  const { testId } = req.params;

  // Validate testId
  if (!testId || typeof testId !== "string") {
    return res.status(400).json({ error: "Invalid test ID" });
  }

  try {
    const test = await getSingleRecord<Test, any>(
      Test,
      { where: { id: testId }, relations: ["course"] },
      `test:${testId}`
    );

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    // Check if test has already started
    const currentDate = new Date();
    if (currentDate >= new Date(test.startDate)) {
      return res.status(400).json({
        error: "Cannot update test after it has started",
      });
    }

    // Update test status to PUBLISHED
    test.status = TestStatus.PUBLISHED;
    await test.save();

    return res.status(200).json({
      message: "Test status updated to PUBLISHED successfully",
    });
  } catch (error) {
    console.error("Error updating test status:", error);
    return res.status(500).json({
      error: "An error occurred while updating the test status",
    });
  }
};

export const createQuestion = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const questionData = req.body;

    // Check authentication (assuming JWT middleware sets req.user)
    if (!req.user) {
      return res
        .status(401)
        .json({ error: "Unauthorized: No user authenticated" });
    }

    // Validate input
    if (!questionData || typeof questionData !== "object") {
      return res.status(400).json({ error: "Invalid question data" });
    }

    // Fetch Test (ensure entity instance)
    const test = await getSingleRecord<Test, any>(
      Test,
      { where: { id: testId } },
      `test_${testId}`,
      false // returnPlain: false to get entity
    );

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    if (test.status !== TestStatus.DRAFT) {
      return res
        .status(400)
        .json({ error: "Cannot add questions to a published test" });
    }

    const {
      question_text,
      type,
      marks,
      options,
      expectedWordCount,
      codeLanguage,
    } = questionData;

    // Validate required fields
    if (!question_text || !type || !marks) {
      return res
        .status(400)
        .json({ error: "Missing required fields: question_text, type, marks" });
    }

    if (!["MCQ", "DESCRIPTIVE", "CODE"].includes(type)) {
      return res.status(400).json({ error: "Invalid question type" });
    }

    if (marks <= 0) {
      return res.status(400).json({ error: "Marks must be greater than zero" });
    }

    // Sanitize question_text (allow Quill/code-block formatting)
    const sanitizedQuestionText = sanitizeHtml(question_text, {
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
      ],
      allowedAttributes: {
        "*": ["class", "style", "spellcheck", "data-*"],
      },
      allowedStyles: {
        "*": {
          // Allow color, background, font, etc. for Quill
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
      allowVulnerableTags: true, // allow <style> if needed
    }).trim();

    if (!sanitizedQuestionText) {
      return res
        .status(400)
        .json({ error: "Question text cannot be empty after sanitization" });
    }

    // Validate optional fields
    let validatedExpectedWordCount = null;
    if (
      (type === "DESCRIPTIVE" || type === "CODE") &&
      expectedWordCount !== undefined
    ) {
      if (!Number.isInteger(expectedWordCount) || expectedWordCount < 0) {
        return res.status(400).json({
          error: "Expected word count must be a non-negative integer",
        });
      }
      validatedExpectedWordCount = expectedWordCount;
    }

    let validatedCodeLanguage = null;
    if (type === "CODE" && codeLanguage) {
      validatedCodeLanguage = codeLanguage.trim();
      if (!validatedCodeLanguage) {
        return res
          .status(400)
          .json({ error: "Code language cannot be empty if provided" });
      }
    }

    // Create Question
    const question = new Question();
    question.question_text = sanitizedQuestionText;
    question.type = type as QuestionType;
    question.marks = marks;
    question.test = test;
    question.expectedWordCount = validatedExpectedWordCount;
    question.codeLanguage = validatedCodeLanguage;

    const savedQuestion = (await createRecord(
      Question.getRepository(),
      question
    )) as Question;

    // Handle MCQ options
    const savedOptions = [];
    if (type === "MCQ" && options && Array.isArray(options)) {
      if (options.length < 2) {
        return res
          .status(400)
          .json({ error: "MCQ must have at least 2 options" });
      }
      if (!options.some((opt: any) => opt.correct)) {
        return res
          .status(400)
          .json({ error: "MCQ must have at least one correct option" });
      }
      // Check for duplicate or empty option text
      const optionTexts = options.map((opt: any) => opt.text.trim());
      if (new Set(optionTexts).size !== optionTexts.length) {
        return res
          .status(400)
          .json({ error: "MCQ options must have unique text" });
      }
      if (optionTexts.some((text: string) => !text)) {
        return res.status(400).json({ error: "Option text cannot be empty" });
      }

      for (const opt of options) {
        const option = new QuizOptions();
        option.text = opt.text.trim();
        option.correct = opt.correct || false;
        option.question = savedQuestion;
        const savedOption = await createRecord(
          QuizOptions.getRepository(),
          option
        );
        savedOptions.push(savedOption);
      }
    }

    // Reload question with options
    const reloadedQuestion = await getSingleRecord<Question, any>(
      Question,
      {
        where: { id: savedQuestion.id },
        relations: ["options"],
      },
      `question_${savedQuestion.id}`,
      false
    );

    // Update Test
    test.lastUpdated = new Date();
    await test.save();

    logger.info("Question created successfully", {
      questionId: reloadedQuestion.id,
      testId,
      questionData,
    });

    return res.status(201).json({
      data: {
        question: {
          id: reloadedQuestion.id,
          question_text: reloadedQuestion.question_text,
          type: reloadedQuestion.type,
          marks: reloadedQuestion.marks,
          expectedWordCount: reloadedQuestion.expectedWordCount,
          codeLanguage: reloadedQuestion.codeLanguage,
          options: reloadedQuestion.options || [],
        },
      },
    });
  } catch (error: any) {
    logger.error("Error creating question:", {
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      error: error.message || "Failed to create question",
      details: error.message,
    });
  }
};

export const getQuestions = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    // Check authentication
    if (!req.user) {
      return res
        .status(401)
        .json({ error: "Unauthorized: No user authenticated" });
    }

    // Fetch Test
    const test = await getSingleRecord<Test, any>(
      Test,
      { where: { id: testId } },
      `test_${testId}`,
      false
    );

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    // Fetch Questions
    const questions = await getAllRecordsWithFilter<Question, any>(
      Question,
      {
        where: { test: { id: testId } },
        relations: ["options"],
      },
      `test_${testId}_questions`,
      false
    );

    logger.info("Questions fetched successfully", {
      testId,
      questionCount: questions.length,
    });

    return res.status(200).json({
      data: {
        questions: questions.map((q) => ({
          id: q.id,
          question_text: q.question_text,
          type: q.type,
          marks: q.marks,
          expectedWordCount: q.expectedWordCount,
          codeLanguage: q.codeLanguage,
          options: q.options || [],
        })),
      },
    });
  } catch (error: any) {
    logger.error("Error fetching questions:", {
      message: error.message,
      stack: error.stack,
      testId: req.params.testId,
    });
    return res.status(500).json({
      error: error.message || "Failed to fetch questions",
      details: error.message,
    });
  }
};

export const updateQuestion = async (req: Request, res: Response) => {
  try {
    const { testId, questionId } = req.params;
    const questionData = req.body;

    // Check authentication
    if (!req.user) {
      return res
        .status(401)
        .json({ error: "Unauthorized: No user authenticated" });
    }

    // Fetch Question with Test and Options
    const question = await getSingleRecord<Question, any>(
      Question,
      {
        where: { id: questionId, test: { id: testId } },
        relations: ["test", "options"],
      },
      `question_${questionId}`,
      false
    );

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    // Update fields if provided
    const {
      question_text,
      type,
      marks,
      options,
      expectedWordCount,
      codeLanguage,
    } = questionData;

    if (question_text) {
      const sanitizedQuestionText = sanitizeHtml(question_text, {
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
        allowVulnerableTags: true,
      }).trim();
      if (!sanitizedQuestionText) {
        return res
          .status(400)
          .json({ error: "Question text cannot be empty after sanitization" });
      }
      question.question_text = sanitizedQuestionText;
    }

    if (marks !== undefined) {
      if (marks <= 0) {
        return res
          .status(400)
          .json({ error: "Marks must be greater than zero" });
      }
      question.marks = marks;
    }

    let validatedType = question.type;
    if (type) {
      if (!["MCQ", "DESCRIPTIVE", "CODE"].includes(type)) {
        return res.status(400).json({ error: "Invalid question type" });
      }
      validatedType = type as QuestionType;
      question.type = validatedType;
    }

    if (
      expectedWordCount !== undefined &&
      (validatedType === "DESCRIPTIVE" || validatedType === "CODE")
    ) {
      if (!Number.isInteger(expectedWordCount) || expectedWordCount < 0) {
        return res.status(400).json({
          error: "Expected word count must be a non-negative integer",
        });
      }
      question.expectedWordCount = expectedWordCount;
    } else if (validatedType !== "MCQ") {
      question.expectedWordCount = null;
    }

    if (validatedType === "CODE") {
      question.codeLanguage = codeLanguage ? codeLanguage.trim() : null;
      if (codeLanguage && !question.codeLanguage) {
        return res
          .status(400)
          .json({ error: "Code language cannot be empty if provided" });
      }
    } else {
      question.codeLanguage = null;
    }

    // Handle MCQ options
    if (options && Array.isArray(options) && validatedType === "MCQ") {
      if (options.length < 2) {
        return res
          .status(400)
          .json({ error: "MCQ must have at least 2 options" });
      }
      if (!options.some((opt: any) => opt.correct)) {
        return res
          .status(400)
          .json({ error: "MCQ must have at least one correct option" });
      }
      const optionTexts = options.map((opt: any) => opt.text.trim());
      if (new Set(optionTexts).size !== optionTexts.length) {
        return res
          .status(400)
          .json({ error: "MCQ options must have unique text" });
      }
      if (optionTexts.some((text: string) => !text)) {
        return res.status(400).json({ error: "Option text cannot be empty" });
      }

      // Update or create options
      const existingOptionIds = (question.options || []).map((opt) => opt.id);
      const newOptionIds = options
        .filter((opt: any) => opt.id)
        .map((opt: any) => opt.id);
      // Delete options not in the new list
      const optionsToDelete = existingOptionIds.filter(
        (id) => !newOptionIds.includes(id)
      );
      if (optionsToDelete.length > 0) {
        await Promise.all(
          optionsToDelete.map((id) => deleteRecords(QuizOptions, { id }))
        );
      }

      // Update or create options
      const updatedOptions = [];
      for (const opt of options) {
        let option;
        if (opt.id && existingOptionIds.includes(opt.id)) {
          // Update existing option
          option = question.options.find((o) => o.id === opt.id);
          option.text = opt.text.trim();
          option.correct = opt.correct || false;
          await option.save();
        } else {
          // Create new option
          option = new QuizOptions();
          option.text = opt.text.trim();
          option.correct = opt.correct || false;
          option.question = question;
          await createRecord(QuizOptions.getRepository(), option);
        }
        updatedOptions.push(option);
      }
      question.options = updatedOptions;
    } else if (
      validatedType === "MCQ" &&
      (!options || !Array.isArray(options))
    ) {
      return res
        .status(400)
        .json({ error: "MCQ requires valid options array" });
    } else if (question.options && question.options.length > 0) {
      // Clear options for non-MCQ types
      await Promise.all(
        question.options.map((option) =>
          deleteRecords(QuizOptions, { id: option.id })
        )
      );
      question.options = [];
    }

    // Save question
    await question.save();
    question.test.lastUpdated = new Date();
    await question.test.save();

    // Reload updated question
    const updatedQuestion = await getSingleRecord<Question, any>(
      Question,
      {
        where: { id: questionId },
        relations: ["options"],
      },
      `question_${questionId}`,
      false
    );

    logger.info("Question updated successfully", {
      questionId,
      testId,
      questionData,
    });

    return res.status(200).json({
      data: {
        question: {
          id: updatedQuestion.id,
          question_text: updatedQuestion.question_text,
          type: updatedQuestion.type,
          marks: updatedQuestion.marks,
          expectedWordCount: updatedQuestion.expectedWordCount,
          codeLanguage: updatedQuestion.codeLanguage,
          options: updatedQuestion.options || [],
        },
      },
    });
  } catch (error: any) {
    logger.error("Error updating question:", {
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      error: error.message || "Failed to update question",
      details: error.message,
    });
  }
};

export const deleteQuestion = async (req: Request, res: Response) => {
  try {
    const { testId, questionId } = req.params;

    // Check authentication
    if (!req.user) {
      return res
        .status(401)
        .json({ error: "Unauthorized: No user authenticated" });
    }

    // Fetch Question with Test
    const question = await getSingleRecord<Question, any>(
      Question,
      {
        where: { id: questionId, test: { id: testId } },
        relations: ["test"],
      },
      `question_${questionId}`,
      false
    );

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    if (question.test.status === TestStatus.ACTIVE) {
      {
        return res
          .status(400)
          .json({ error: "Cannot delete questions from a published test" });
      }
    } else if (question.test.status === TestStatus.COMPLETED) {
      return res
        .status(400)
        .json({ error: "Cannot delete questions from a completed test" });
    }

    // Delete question (cascade deletes options via database constraints)
    await deleteRecords(Question, { id: questionId });

    // Update Test
    question.test.lastUpdated = new Date();
    await question.test.save();

    logger.info("Question deleted successfully", { questionId, testId });

    return res.status(200).json({
      data: { message: "Question deleted successfully" },
    });
  } catch (error: any) {
    logger.error("Error deleting question:", {
      message: error.message,
      stack: error.stack,
      testId: req.params.testId,
      questionId: req.params.questionId,
    });
    return res.status(500).json({
      error: error.message || "Failed to delete question",
      details: error.message,
    });
  }
};

export const getSubmissionCount = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    // Validate testId
    if (!testId || typeof testId !== "string") {
      return res.status(400).json({ error: "Invalid test ID" });
    }

    // Count submissions for the given test
    const submissionCount = await TestSubmission.count({
      where: { test: { id: testId } },
    });

    return res.status(200).json({
      message: "Submission count fetched successfully",
      data: { submissionCount },
    });
  } catch (error) {
    console.error("Error fetching submission count:", error);
    return res.status(500).json({
      error: "Failed to fetch submission count",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const evaluateTestSubmission = async (req: Request, res: Response) => {
  try {
    const { testId, submissionId } = req.params;
    const { responses } = req.body;

    // Fetch submission
    const submission = await getSingleRecord(TestSubmission, {
      where: { id: submissionId, test: { id: testId } },
      relations: ["test", "responses", "responses.question"],
    });

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    // Validate responses
    if (!Array.isArray(responses)) {
      return res.status(400).json({ message: "Responses must be an array" });
    }

    const responseIds = submission.responses.map((r) => r.id);
    if (!responses.every((r) => responseIds.includes(r.responseId))) {
      return res.status(400).json({ message: "Invalid response IDs" });
    }

    // Process evaluations within a transaction
    const updatedSubmission =
      await TestSubmission.getRepository().manager.transaction(
        async (manager) => {
          let totalScore = submission.mcqScore || 0;

          await Promise.all(
            responses.map(async (evalResponse) => {
              const response = submission.responses.find(
                (r) => r.id === evalResponse.responseId
              );
              if (!response || response.question.type === "MCQ") {
                return;
              }

              if (
                evalResponse.score > response.question.marks ||
                evalResponse.score < 0
              ) {
                throw new Error(
                  `Invalid score for response ${evalResponse.responseId}`
                );
              }

              await manager.update(
                TestResponse,
                { id: evalResponse.responseId },
                {
                  score: evalResponse.score,
                  evaluationStatus: "EVALUATED",
                  evaluatorComments: evalResponse.comments || null,
                }
              );

              totalScore += evalResponse.score;
            })
          );

          // Update submission status
          const allEvaluated = submission.responses.every(
            (r) =>
              r.evaluationStatus === "EVALUATED" || r.question.type === "MCQ"
          );
          await manager.update(
            TestSubmission,
            { id: submissionId },
            {
              totalScore,
              status: allEvaluated ? "FULLY_EVALUATED" : "PARTIALLY_EVALUATED",
            }
          );

          return {
            ...submission,
            totalScore,
            status: allEvaluated ? "FULLY_EVALUATED" : "PARTIALLY_EVALUATED",
          };
        }
      );

    res.status(200).json({
      message: "Submission evaluated successfully",
      data: {
        submissionId: updatedSubmission.id,
        totalScore: updatedSubmission.totalScore,
        status: updatedSubmission.status,
      },
    });
  } catch (error) {
    console.error("Error evaluating submission:", error);
    res
      .status(500)
      .json({ message: error.message || "Error evaluating submission" });
  }
};

export const getTestResponses = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const { questionType, evaluationStatus } = req.query;

    // Build the where conditions
    const whereCondition: Record<string, any> = {
      question: { test: { id: testId } },
    };

    // Filter by question type if provided
    if (
      questionType &&
      ["MCQ", "DESCRIPTIVE", "CODE"].includes(questionType as string)
    ) {
      whereCondition.question = {
        ...whereCondition.question,
        type: questionType,
      };
    }

    // Filter by evaluation status if provided
    if (
      evaluationStatus &&
      ["PENDING", "EVALUATED"].includes(evaluationStatus as string)
    ) {
      whereCondition.evaluationStatus = evaluationStatus;
    }

    // Get all responses for the test that match the criteria
    const responses = await TestResponse.find({
      where: whereCondition,
      relations: ["question", "submission", "submission.user"],
    });

    // Format the response data
    const formattedResponses = responses.map((response) => ({
      id: response.id,
      answer: response.answer,
      questionId: response.question.id,
      questionType: response.question.type,
      questionText: response.question.question_text,
      marks: response.question.marks,
      evaluationStatus: response.evaluationStatus,
      score: response.score,
      evaluatorComments: response.evaluatorComments,
      submissionId: response.submission.id,
      studentId: response.submission.user.id,
      studentName:
        response.submission.user.username || response.submission.user.email,
    }));

    res.status(200).json({
      message: "Test responses fetched successfully",
      data: { responses: formattedResponses },
    });
  } catch (error) {
    console.error("Error fetching test responses:", error);
    res.status(500).json({ message: "Error fetching test responses" });
  }
};

export const evaluateTestResponseById = async (req: Request, res: Response) => {
  try {
    const { testId, responseId } = req.params;
    const { score, evaluatorComments } = req.body;

    if (score === undefined || typeof score !== "number" || score < 0) {
      return res.status(400).json({ message: "Valid score is required" });
    }

    // Find the response with question info
    const response = await getSingleRecord(TestResponse, {
      where: { id: responseId },
      relations: [
        "question",
        "submission",
        "submission.test",
        "submission.responses",
      ],
    });

    if (!response) {
      return res.status(404).json({ message: "Response not found" });
    }

    // Verify this response belongs to the specified test
    if (response.submission.test.id !== testId) {
      return res
        .status(400)
        .json({ message: "Response does not belong to the specified test" });
    }

    // Check if the score is within valid range for the question
    if (score > response.question.marks) {
      return res.status(400).json({
        message: `Score cannot exceed maximum marks (${response.question.marks})`,
      });
    }

    // Update the response
    await TestResponse.update(
      { id: responseId },
      {
        score: score,
        evaluationStatus: "EVALUATED",
        evaluatorComments: evaluatorComments || null,
      }
    );

    // Update the submission status
    const submission = response.submission;
    const allResponses = submission.responses;

    // Recalculate the total score
    const evaluatedResponses = await TestResponse.find({
      where: {
        submission: { id: submission.id },
        evaluationStatus: "EVALUATED",
      },
      relations: ["question"],
    });

    const totalScore = evaluatedResponses.reduce(
      (sum, resp) => sum + (resp.score || 0),
      0
    );

    // Check if all non-MCQ questions are evaluated
    const allEvaluated = allResponses.every(
      (r) => r.question.type === "MCQ" || r.evaluationStatus === "EVALUATED"
    );

    // Update submission status
    await TestSubmission.update(
      { id: submission.id },
      {
        totalScore,
        status: allEvaluated ? "FULLY_EVALUATED" : "PARTIALLY_EVALUATED",
      }
    );

    res.status(200).json({
      message: "Response evaluated successfully",
      data: {
        responseId,
        score,
        evaluatorComments,
        submissionStatus: allEvaluated
          ? "FULLY_EVALUATED"
          : "PARTIALLY_EVALUATED",
        submissionId: submission.id,
        totalScore,
      },
    });
  } catch (error) {
    console.error("Error evaluating test response:", error);
    res.status(500).json({ message: "Error evaluating test response" });
  }
};

export const getSubmissionsForEvaluation = async (
  req: Request,
  res: Response
) => {
  try {
    const { testId } = req.params;
    const { status } = req.query;

    const statusFilter: Record<string, any> = { test: { id: testId } };

    // If status is provided, filter by it
    if (
      status &&
      ["SUBMITTED", "PARTIALLY_EVALUATED", "FULLY_EVALUATED"].includes(
        status as string
      )
    ) {
      statusFilter.status = status;
    }

    // Fetch submissions for the given test
    const submissions = await getAllRecordsWithFilter(TestSubmission, {
      where: statusFilter,
      relations: ["user", "responses", "responses.question"],
      order: { submittedAt: "DESC" },
    });

    const processedSubmissions = submissions.map((submission) => ({
      id: submission.id,
      submittedAt: submission.submittedAt,
      studentId: submission.user.id,
      studentName: submission.user.username || submission.user.email,
      status: submission.status,
      mcqScore: submission.mcqScore || 0,
      totalScore: submission.totalScore || 0,
      responses: submission.responses.map((response) => ({
        responseId: response.id,
        questionId: response.question.id,
        questionText: response.question.question_text,
        type: response.question.type,
        answer: response.answer, // Ensure the answer is included
        evaluationStatus: response.evaluationStatus,
        score: response.score,
        maxMarks: response.question.marks,
        evaluatorComments: response.evaluatorComments,
      })),
    }));

    res.status(200).json({
      message: "Submissions fetched successfully",
      data: { submissions: processedSubmissions },
    });
  } catch (error) {
    console.error("Error fetching submissions for evaluation:", error);
    res.status(500).json({ message: "Error fetching submissions" });
  }
};
