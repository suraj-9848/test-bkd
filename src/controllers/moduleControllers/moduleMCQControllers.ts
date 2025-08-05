// Updated MCQ Controller using utility functions with Quill Rich Text Editor support

import { Request, Response } from "express";
import { Module } from "../../db/mysqlModels/Module";
import { ModuleMCQ } from "../../db/mysqlModels/ModuleMCQ";
import { ModuleMCQAnswer } from "../../db/mysqlModels/ModuleMCQAnswer";
import { ModuleMCQResponses } from "../../db/mysqlModels/ModuleMCQResponses";
import {
  createRecord,
  getSingleRecord,
  updateRecords,
  deleteRecords,
  getAllRecordsWithFilter,
  createEntityInstance,
} from "../../lib/dbLib/sqlUtils";
import { getLoggerByName } from "../../utils/logger";

const logger = getLoggerByName("ModuleMCQController");

// Helper function to safely handle questions type conversion
const getQuestionsAsArray = (
  questions: Record<string, unknown> | any,
): MCQQuestion[] => {
  if (Array.isArray(questions)) {
    return questions as MCQQuestion[];
  }
  // If it's an object but not an array, try to convert it or return empty array
  return [];
};
interface QuillDelta {
  ops: Array<{
    insert: string | object;
    attributes?: object;
    retain?: number;
    delete?: number;
  }>;
}

interface MCQQuestion {
  id?: string;
  question: QuillDelta;
  options: {
    id: string;
    text: QuillDelta;
  }[];
  correctAnswer: string;
  explanation?: QuillDelta;
}

const isValidQuillDelta = (delta: any): delta is QuillDelta => {
  return (
    delta &&
    typeof delta === "object" &&
    Array.isArray((delta as QuillDelta).ops) &&
    (delta as QuillDelta).ops.every(
      (op: any) =>
        typeof op === "object" &&
        (op.insert !== undefined ||
          op.retain !== undefined ||
          op.delete !== undefined),
    )
  );
};

const stringToQuillDelta = (text: string): QuillDelta => {
  return {
    ops: [{ insert: text || "" }],
  };
};
const normalizeMCQQuestions = (questions: any[]): MCQQuestion[] => {
  return questions.map((question, qIndex) => {
    let normalizedQuestion: MCQQuestion;

    if (
      question.question &&
      typeof question.question === "object" &&
      question.question.ops
    ) {
      normalizedQuestion = question as MCQQuestion;
    } else {
      const questionId = question.id || `q_${Date.now()}_${qIndex}`;

      let normalizedOptions: { id: string; text: QuillDelta }[] = [];

      if (Array.isArray(question.options)) {
        if (
          question.options.length > 0 &&
          typeof question.options[0] === "string"
        ) {
          normalizedOptions = question.options.map(
            (optionText: string, oIndex: number) => ({
              id: `opt_${Date.now()}_${qIndex}_${oIndex}`,
              text: stringToQuillDelta(optionText),
            }),
          );
        } else {
          normalizedOptions = question.options.map(
            (option: any, oIndex: number) => ({
              id: option.id || `opt_${Date.now()}_${qIndex}_${oIndex}`,
              text:
                option.text &&
                typeof option.text === "object" &&
                option.text.ops
                  ? option.text
                  : stringToQuillDelta(option.text || ""),
            }),
          );
        }
      }

      let correctAnswerId: string;
      if (typeof question.correctAnswer === "number") {
        correctAnswerId = normalizedOptions[question.correctAnswer]?.id || "";
      } else if (question.correctAnswer) {
        correctAnswerId = question.correctAnswer;
      } else if (question.correct_option) {
        // Handle admin interface format - find the option ID that matches the correct_option text
        const correctOption = normalizedOptions.find(
          (opt) => opt.text.ops[0]?.insert === question.correct_option,
        );
        correctAnswerId = correctOption?.id || "";
      } else if (typeof question.correct_option_index === "number") {
        // Handle admin interface format with index
        correctAnswerId =
          normalizedOptions[question.correct_option_index]?.id || "";
      } else {
        correctAnswerId = "";
      }

      // Get question text from either 'question' or 'question_text' (admin interface)
      const questionText = question.question_text || question.question || "";

      normalizedQuestion = {
        id: questionId,
        question:
          question.question &&
          typeof question.question === "object" &&
          question.question.ops
            ? question.question
            : stringToQuillDelta(questionText),
        options: normalizedOptions,
        correctAnswer: correctAnswerId,
        explanation: question.explanation
          ? question.explanation &&
            typeof question.explanation === "object" &&
            question.explanation.ops
            ? question.explanation
            : stringToQuillDelta(question.explanation)
          : undefined,
      };
    }

    if (!normalizedQuestion.options.every((opt) => opt.id)) {
      normalizedQuestion.options = normalizedQuestion.options.map(
        (opt, oIndex) => ({
          ...opt,
          id: opt.id || `opt_${Date.now()}_${qIndex}_${oIndex}`,
        }),
      );
    }

    if (
      !normalizedQuestion.options.some(
        (opt) => opt.id === normalizedQuestion.correctAnswer,
      )
    ) {
      normalizedQuestion.correctAnswer =
        normalizedQuestion.options[0]?.id || "";
    }

    return normalizedQuestion;
  });
};

const validateMCQQuestions = (questions: MCQQuestion[]): boolean => {
  if (!Array.isArray(questions) || questions.length === 0) {
    return false;
  }

  return questions.every((question) => {
    if (!isValidQuillDelta(question.question)) {
      return false;
    }

    if (!Array.isArray(question.options) || question.options.length < 2) {
      return false;
    }

    const validOptions = question.options.every(
      (option) =>
        option.id &&
        typeof option.id === "string" &&
        isValidQuillDelta(option.text),
    );

    if (!validOptions) {
      return false;
    }

    const correctAnswerExists = question.options.some(
      (option) => option.id === question.correctAnswer,
    );

    if (!correctAnswerExists) {
      return false;
    }

    if (question.explanation && !isValidQuillDelta(question.explanation)) {
      return false;
    }

    return true;
  });
};

export const createMCQ = async (req: Request, res: Response) => {
  const { moduleId } = req.params;
  const { questions, passingScore } = req.body;

  try {
    if (!questions || passingScore === undefined) {
      return res.status(400).json({
        message: "Questions and passing score are required",
      });
    }

    if (
      typeof passingScore !== "number" ||
      passingScore < 0 ||
      passingScore > 100
    ) {
      return res.status(400).json({
        message: "Passing score must be a number between 0 and 100",
      });
    }

    const normalizedQuestions = normalizeMCQQuestions(questions);
    logger.info(
      "Normalized questions:",
      JSON.stringify(normalizedQuestions, null, 2),
    );

    // Validate MCQ questions with Quill format
    if (!validateMCQQuestions(normalizedQuestions)) {
      return res.status(400).json({
        message:
          "Invalid questions format. Each question must have valid content for question text and options, with at least 2 options and a valid correct answer.",
      });
    }

    // Check if the module exists
    const moduleRecord = await getSingleRecord(Module, {
      where: { id: moduleId },
    });
    if (!moduleRecord) {
      return res.status(404).json({ message: "Module not found" });
    }

    // Check if an MCQ already exists for this module
    const existingMCQ = await getSingleRecord(ModuleMCQ, {
      where: { module: { id: moduleId } },
    });

    if (existingMCQ) {
      const currentQuestions = getQuestionsAsArray(existingMCQ.questions);

      const updatedQuestions = [...currentQuestions, ...normalizedQuestions];

      // Update the MCQ with new questions and passing score
      await updateRecords(
        ModuleMCQ,
        { id: existingMCQ.id },
        {
          questions: updatedQuestions as unknown as Record<string, unknown>,
          passingScore,
        },
        false,
      );

      // Get the updated MCQ
      const updatedMCQ = await getSingleRecord(ModuleMCQ, {
        where: { id: existingMCQ.id },
      });

      for (let index = 0; index < normalizedQuestions.length; index++) {
        const question = normalizedQuestions[index];
        const answer = createEntityInstance(ModuleMCQAnswer, {
          moduleMCQ: updatedMCQ,
          questionId: question.id || `q_${Date.now()}_${index}`,
          correctAnswer: question.correctAnswer,
        });
        await createRecord(ModuleMCQAnswer, answer);
      }

      return res.status(200).json({
        message: "Questions added to existing MCQ successfully",
        mcq: {
          id: updatedMCQ.id,
          passingScore: updatedMCQ.passingScore,
          questions: updatedQuestions,
          totalQuestions: updatedQuestions.length,
        },
      });
    }

    const newMCQ = createEntityInstance(ModuleMCQ, {
      module: moduleRecord,
      questions: normalizedQuestions as unknown as Record<string, unknown>,
      passingScore,
    });

    const savedMCQ = (await createRecord(ModuleMCQ, newMCQ)) as ModuleMCQ;
    for (let index = 0; index < normalizedQuestions.length; index++) {
      const question = normalizedQuestions[index];
      const answer = createEntityInstance(ModuleMCQAnswer, {
        moduleMCQ: savedMCQ,
        questionId: question.id || `q_${index}`,
        correctAnswer: question.correctAnswer,
      });
      await createRecord(ModuleMCQAnswer, answer);
    }

    res.status(201).json({
      message: "MCQ created successfully",
      mcq: {
        id: savedMCQ.id,
        passingScore: savedMCQ.passingScore,
        questions: normalizedQuestions,
      },
    });
  } catch (error) {
    logger.error("Error creating MCQ:", error);
    res.status(500).json({ message: "Error creating MCQ" });
  }
};

export const getMCQById = async (req: Request, res: Response) => {
  const { mcqId } = req.params;

  try {
    const mcq = await getSingleRecord(ModuleMCQ, {
      where: { id: mcqId },
      relations: ["module"],
    });

    if (!mcq) {
      return res.status(404).json({ message: "MCQ not found" });
    }

    res.status(200).json({
      id: mcq.id,
      passingScore: mcq.passingScore,
      questions: mcq.questions,
      module: {
        id: mcq.module.id,
        title: mcq.module.title,
      },
    });
  } catch (error) {
    logger.error("Error fetching MCQ:", error);
    res.status(500).json({ message: "Error fetching MCQ" });
  }
};

export const updateMCQ = async (req: Request, res: Response) => {
  const { mcqId } = req.params;
  const { questions, passingScore } = req.body;

  try {
    if (!mcqId) {
      return res.status(400).json({ message: "MCQ ID is required" });
    }

    // Check if MCQ exists
    const existingMCQ = await getSingleRecord(ModuleMCQ, {
      where: { id: mcqId },
    });

    if (!existingMCQ) {
      return res.status(404).json({ message: "MCQ not found" });
    }

    // Check if any students have already attempted this MCQ
    const existingResponses = await getAllRecordsWithFilter(
      ModuleMCQResponses,
      {
        where: { moduleMCQ: { id: mcqId } },
      },
    );

    if (existingResponses.length > 0) {
      logger.warn(
        `[UPDATE MCQ] Warning: ${existingResponses.length} student responses exist for this MCQ`,
      );
      logger.info("[UPDATE MCQ] Allowing update for development purposes");
    }

    let normalizedQuestions: MCQQuestion[] | undefined;
    if (questions) {
      logger.info(
        "Updating MCQ with raw questions:",
        JSON.stringify(questions, null, 2),
      );
      normalizedQuestions = normalizeMCQQuestions(questions);
      logger.info(
        "Normalized questions for update:",
        JSON.stringify(normalizedQuestions, null, 2),
      );

      if (!validateMCQQuestions(normalizedQuestions)) {
        return res.status(400).json({
          message:
            "Invalid questions format. Each question must have valid content for question text and options, with at least 2 options and a valid correct answer.",
        });
      }
    }

    if (
      passingScore !== undefined &&
      (typeof passingScore !== "number" ||
        passingScore < 0 ||
        passingScore > 100)
    ) {
      return res.status(400).json({
        message: "Passing score must be a number between 0 and 100",
      });
    }
    const updateData: any = {};
    if (normalizedQuestions) {
      updateData.questions = normalizedQuestions;
    }
    if (passingScore !== undefined) {
      updateData.passingScore = passingScore;
    }

    await updateRecords(ModuleMCQ, { id: mcqId }, updateData, false);
    if (normalizedQuestions) {
      await deleteRecords(ModuleMCQAnswer, { moduleMCQ: { id: mcqId } });

      for (let index = 0; index < normalizedQuestions.length; index++) {
        const question = normalizedQuestions[index];
        const answer = createEntityInstance(ModuleMCQAnswer, {
          moduleMCQ: existingMCQ,
          questionId: question.id || `q_${index}`,
          correctAnswer: question.correctAnswer,
        });
        await createRecord(ModuleMCQAnswer, answer);
      }
    }

    const updatedMCQ = await getSingleRecord(ModuleMCQ, {
      where: { id: mcqId },
    });

    res.status(200).json({
      message: "MCQ updated successfully",
      mcq: {
        id: updatedMCQ.id,
        passingScore: updatedMCQ.passingScore,
        questions: updatedMCQ.questions,
      },
    });
  } catch (error) {
    logger.error("Error updating MCQ:", error);
    res.status(500).json({ message: "Error updating MCQ" });
  }
};

//  Delete MCQ
export const deleteMCQ = async (req: Request, res: Response) => {
  const { mcqId } = req.params;

  try {
    if (!mcqId) {
      return res.status(400).json({ message: "MCQ ID is required" });
    }

    // Check if MCQ exists
    const existingMCQ = await getSingleRecord(ModuleMCQ, {
      where: { id: mcqId },
    });

    if (!existingMCQ) {
      return res.status(404).json({ message: "MCQ not found" });
    }

    const existingResponses = await getAllRecordsWithFilter(
      ModuleMCQResponses,
      {
        where: { moduleMCQ: { id: mcqId } },
      },
    );

    if (existingResponses.length > 0) {
      return res.status(400).json({
        message: "Cannot delete MCQ as students have already attempted it",
      });
    }

    await deleteRecords(ModuleMCQAnswer, { moduleMCQ: { id: mcqId } });

    // Delete the MCQ
    await deleteRecords(ModuleMCQ, { id: mcqId });

    res.status(200).json({ message: "MCQ deleted successfully" });
  } catch (error) {
    logger.error("Error deleting MCQ:", error);
    res.status(500).json({ message: "Error deleting MCQ" });
  }
};

//  Get MCQ by Module ID with Quill support (Fixed relation)
export const getMCQ = async (req: Request, res: Response) => {
  const { moduleId } = req.params;

  try {
    // Check if module exists
    const moduleData = await getSingleRecord(Module, {
      where: { id: moduleId },
    });

    if (!moduleData) {
      return res.status(404).json({ message: "Module not found" });
    }
    // Get MCQ for this module (fixed relation name)
    const mcq = await getSingleRecord(ModuleMCQ, {
      where: { module: { id: moduleId } },
    });

    if (!mcq) {
      return res.status(404).json({ message: "No MCQ found for this module" });
    }
    res.status(200).json({
      id: mcq.id,
      passingScore: mcq.passingScore,
      questions: mcq.questions,
      module: {
        id: mcq.module.id,
        title: mcq.module.title,
      },
    });
  } catch (error) {
    logger.error(`Error fetching MCQ for module ${moduleId}:`, error);
    res.status(500).json({ message: "Error fetching MCQ" });
  }
};

//  Get MCQ for student (without correct answers)
export const getMCQForStudent = async (req: Request, res: Response) => {
  const { moduleId } = req.params;
  const userId = req.user?.id;

  try {
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Check if module exists
    const moduleData = await getSingleRecord(Module, {
      where: { id: moduleId },
    });

    if (!moduleData) {
      return res.status(404).json({ message: "Module not found" });
    }

    // Get MCQ for this module
    const mcq = await getSingleRecord(ModuleMCQ, {
      where: { module: { id: moduleId } },
    });

    if (!mcq) {
      return res.status(404).json({ message: "No MCQ found for this module" });
    }

    // Check if student has already attempted and passed
    const existingResponse = await getSingleRecord(ModuleMCQResponses, {
      where: {
        moduleMCQ: { id: mcq.id },
        user: { id: userId },
      },
    });

    if (existingResponse) {
      // Calculate if they passed
      const correctAnswers = await getAllRecordsWithFilter(ModuleMCQAnswer, {
        where: { moduleMCQ: { id: mcq.id } },
        order: { createdAt: "ASC" },
      });

      let score = 0;
      existingResponse.responses.forEach((response: any) => {
        const correct = correctAnswers.find(
          (ans: ModuleMCQAnswer) => ans.questionId === response.questionId,
        );
        if (correct && correct.correctAnswer === response.answer) {
          score++;
        }
      });

      const percentage = (score / correctAnswers.length) * 100;
      const passed = percentage >= mcq.passingScore;

      if (passed) {
        return res.status(400).json({
          message: "You have already passed this MCQ",
          attempted: true,
          passed: true,
        });
      }

      // If failed, allow retake but inform them
      // Note: We'll delete the old response to allow fresh attempt
      await deleteRecords(ModuleMCQResponses, {
        id: existingResponse.id,
      });
    }

    // Remove correct answers from questions for student view
    const questionsForStudent = getQuestionsAsArray(mcq.questions).map(
      (question: MCQQuestion) => ({
        id: question.id,
        question: question.question,
        options: question.options.map((option) => ({
          id: option.id,
          text: option.text,
        })),
        explanation: question.explanation,
      }),
    );

    res.status(200).json({
      id: mcq.id,
      passingScore: mcq.passingScore,
      questions: questionsForStudent,
      attempted: false,
    });
  } catch (error) {
    logger.error("Error fetching MCQ for student:", error);
    res.status(500).json({ message: "Error fetching MCQ" });
  }
};

// GET /instructor/courses/:courseId/modules/:moduleId/mcq/retake-status
export const getMCQRetakeStatus = async (req: Request, res: Response) => {
  const { moduleId } = req.params;
  const userId = req.user?.id;

  try {
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Check if module exists
    const moduleData = await getSingleRecord(Module, {
      where: { id: moduleId },
    });

    if (!moduleData) {
      return res.status(404).json({ message: "Module not found" });
    }

    // Get MCQ for this module
    const mcq = await getSingleRecord(ModuleMCQ, {
      where: { module: { id: moduleId } },
    });

    if (!mcq) {
      return res.status(404).json({ message: "No MCQ found for this module" });
    }

    // Check if student has already attempted
    const existingResponse = await getSingleRecord(ModuleMCQResponses, {
      where: {
        moduleMCQ: { id: mcq.id },
        user: { id: userId },
      },
    });

    if (!existingResponse) {
      return res.status(200).json({
        canTake: true,
        canRetake: false,
        hasAttempted: false,
        hasPassed: false,
        score: null,
        message: "You can take this MCQ",
      });
    }

    // Calculate if they passed
    const correctAnswers = await getAllRecordsWithFilter(ModuleMCQAnswer, {
      where: { moduleMCQ: { id: mcq.id } },
      order: { createdAt: "ASC" },
    });

    let score = 0;
    existingResponse.responses.forEach((response: any) => {
      const correct = correctAnswers.find(
        (ans: ModuleMCQAnswer) => ans.questionId === response.questionId,
      );
      if (correct && correct.correctAnswer === response.answer) {
        score++;
      }
    });

    const percentage = (score / correctAnswers.length) * 100;
    const passed = percentage >= mcq.passingScore;

    return res.status(200).json({
      canTake: false,
      canRetake: !passed,
      hasAttempted: true,
      hasPassed: passed,
      score: percentage,
      passingScore: mcq.passingScore,
      message: passed
        ? "You have already passed this MCQ"
        : "You can retake this MCQ to improve your score",
    });
  } catch (error) {
    logger.error("Error checking MCQ retake status:", error);
    res.status(500).json({ message: "Error checking MCQ retake status" });
  }
};

// POST /instructor/courses/:courseId/modules/:moduleId/mcq/questions
export const addQuestionToMCQ = async (req: Request, res: Response) => {
  const { moduleId } = req.params;
  const {
    question,
    options,
    correctAnswer,
    explanation,
    difficulty,
    passingScore,
  } = req.body;

  try {
    logger.info("Adding single question to MCQ for module:", moduleId);
    logger.debug("Question data:", { question, options, correctAnswer });

    // Validate input
    if (
      !question ||
      !options ||
      !Array.isArray(options) ||
      options.length < 2
    ) {
      return res.status(400).json({
        message: "Question text and at least 2 options are required",
      });
    }

    if (
      correctAnswer === undefined ||
      correctAnswer < 0 ||
      correctAnswer >= options.length
    ) {
      return res.status(400).json({
        message: "Valid correct answer index is required",
      });
    }

    // Check if the module exists
    const moduleRecord = await getSingleRecord(Module, {
      where: { id: moduleId },
    });
    if (!moduleRecord) {
      return res.status(404).json({ message: "Module not found" });
    }

    // Create single question object
    const newQuestion = {
      id: `q_${Date.now()}`,
      question:
        typeof question === "string" ? stringToQuillDelta(question) : question,
      options: options.map((opt: string, index: number) => ({
        id: `opt_${Date.now()}_${index}`,
        text: typeof opt === "string" ? stringToQuillDelta(opt) : opt,
      })),
      correctAnswer: `opt_${Date.now()}_${correctAnswer}`,
      explanation: explanation
        ? typeof explanation === "string"
          ? stringToQuillDelta(explanation)
          : explanation
        : undefined,
      difficulty: difficulty || "medium",
    };

    // Check if an MCQ already exists for this module
    const mcqRecord = await getSingleRecord(ModuleMCQ, {
      where: { module: { id: moduleId } },
    });

    if (mcqRecord) {
      // Add question to existing MCQ
      const currentQuestions = getQuestionsAsArray(mcqRecord.questions);
      const updatedQuestions = [...currentQuestions, newQuestion];

      const updateData: any = {
        questions: updatedQuestions as unknown as Record<string, unknown>,
      };

      if (
        passingScore !== undefined &&
        passingScore >= 0 &&
        passingScore <= 100
      ) {
        updateData.passingScore = passingScore;
      }

      await updateRecords(ModuleMCQ, { id: mcqRecord.id }, updateData, false);

      // Get the updated MCQ
      const updatedMCQ = await getSingleRecord(ModuleMCQ, {
        where: { id: mcqRecord.id },
      });

      // Create answer record
      const answer = createEntityInstance(ModuleMCQAnswer, {
        moduleMCQ: updatedMCQ,
        questionId: newQuestion.id,
        correctAnswer: newQuestion.correctAnswer,
      });
      await createRecord(ModuleMCQAnswer, answer);

      return res.status(200).json({
        message: "Question added to existing MCQ successfully",
        mcq: {
          id: updatedMCQ.id,
          passingScore: updatedMCQ.passingScore,
          totalQuestions: getQuestionsAsArray(updatedMCQ.questions).length,
          newQuestionId: newQuestion.id,
        },
      });
    } else {
      // Create new MCQ with first question
      const newMCQ = createEntityInstance(ModuleMCQ, {
        module: moduleRecord,
        questions: [newQuestion] as unknown as Record<string, unknown>,
        passingScore: passingScore || 70,
      });

      const savedMCQ = (await createRecord(ModuleMCQ, newMCQ)) as ModuleMCQ;

      // Create answer record
      const answer = createEntityInstance(ModuleMCQAnswer, {
        moduleMCQ: savedMCQ,
        questionId: newQuestion.id,
        correctAnswer: newQuestion.correctAnswer,
      });
      await createRecord(ModuleMCQAnswer, answer);

      return res.status(201).json({
        message: "MCQ created with first question successfully",
        mcq: {
          id: savedMCQ.id,
          passingScore: savedMCQ.passingScore,
          totalQuestions: 1,
          newQuestionId: newQuestion.id,
        },
      });
    }
  } catch (error) {
    logger.error("Error adding question to MCQ:", error);
    res.status(500).json({ message: "Error adding question to MCQ" });
  }
};
