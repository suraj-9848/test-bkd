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

import sanitizeHtml from "sanitize-html";
export const createQuestion = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const { question_text, type, marks, options, expectedWordCount } = req.body;

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
      true
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

    const savedQuestion = (await createRecord(
      Question.getRepository(),
      question
    )) as Question;

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
      message: "Question created successfully",
      question: completeQuestion,
    });
  } catch (error) {
    logger.error("Error creating question:", error);
    return res.status(500).json({ error: "Failed to create question" });
  }
};

// 🔥 REPLACE your existing updateQuestion function with this:
export const updateQuestion = async (req: Request, res: Response) => {
  try {
    const { testId, questionId } = req.params;
    const { question_text, type, marks, options, expectedWordCount } = req.body;

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
      true
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

    if (
      expectedWordCount !== undefined &&
      (type === "DESCRIPTIVE" || type === "CODE")
    ) {
      question.expectedWordCount = expectedWordCount;
    }

    await question.save();

    // Update options if provided and question is MCQ
    if (
      options &&
      Array.isArray(options) &&
      question.type === QuestionType.MCQ
    ) {
      // Delete existing options
      if (question.options && question.options.length > 0) {
        await Promise.all(
          question.options.map((option) =>
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
      message: "Question updated successfully",
      question: updatedQuestion,
    });
  } catch (error) {
    logger.error("Error updating question:", error);
    return res.status(500).json({ error: "Failed to update question" });
  }
};

// 🔥 REPLACE your existing getQuestions function with this:
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
      true
    );

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const questionsWithHtml =
      test.questions?.map((question) => {
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
      message: "Questions retrieved successfully",
      data: { questions: questionsWithHtml }, // Note: your API expects data.questions based on frontend
    });
  } catch (error) {
    logger.error("Error retrieving questions:", error);
    return res.status(500).json({ error: "Failed to retrieve questions" });
  }
};



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
