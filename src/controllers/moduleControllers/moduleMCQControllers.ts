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
} from "../../lib/dbLib/sqlUtils";

// Interface for Quill Delta format
interface QuillDelta {
  ops: Array<{
    insert: string | object;
    attributes?: object;
    retain?: number;
    delete?: number;
  }>;
}

// Interface for MCQ Question with Quill content
interface MCQQuestion {
  id?: string;
  question: QuillDelta; // Quill Delta format for rich text
  options: {
    id: string;
    text: QuillDelta; // Quill Delta format for rich text options
  }[];
  correctAnswer: string; // ID of the correct option
  explanation?: QuillDelta; // Optional explanation in Quill format
}

// Validation function for Quill Delta
const isValidQuillDelta = (delta: any): delta is QuillDelta => {
  return (
    delta &&
    typeof delta === "object" &&
    Array.isArray(delta.ops) &&
    delta.ops.every(
      (op: any) =>
        typeof op === "object" &&
        (op.insert !== undefined ||
          op.retain !== undefined ||
          op.delete !== undefined),
    )
  );
};

// Helper function to convert string to QuillDelta format
const stringToQuillDelta = (text: string): QuillDelta => {
  return {
    ops: [{ insert: text || "" }],
  };
};

// Helper function to normalize MCQ questions from different frontend formats
const normalizeMCQQuestions = (questions: any[]): MCQQuestion[] => {
  return questions.map((question, qIndex) => {
    // Handle both new and old question formats
    let normalizedQuestion: MCQQuestion;

    if (
      question.question &&
      typeof question.question === "object" &&
      question.question.ops
    ) {
      // New format with QuillDelta
      normalizedQuestion = question as MCQQuestion;
    } else {
      // Old format with strings - convert to QuillDelta
      const questionId = question.id || `q_${Date.now()}_${qIndex}`;

      let normalizedOptions: { id: string; text: QuillDelta }[] = [];

      if (Array.isArray(question.options)) {
        if (
          question.options.length > 0 &&
          typeof question.options[0] === "string"
        ) {
          // Old format: options as string array
          normalizedOptions = question.options.map(
            (optionText: string, oIndex: number) => ({
              id: `opt_${Date.now()}_${qIndex}_${oIndex}`,
              text: stringToQuillDelta(optionText),
            }),
          );
        } else {
          // New format: options as object array
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

      // Handle correctAnswer (index vs ID)
      let correctAnswerId: string;
      if (typeof question.correctAnswer === "number") {
        // Old format: correctAnswer as index
        correctAnswerId = normalizedOptions[question.correctAnswer]?.id || "";
      } else {
        // New format: correctAnswer as ID
        correctAnswerId = question.correctAnswer || "";
      }

      normalizedQuestion = {
        id: questionId,
        question:
          question.question &&
          typeof question.question === "object" &&
          question.question.ops
            ? question.question
            : stringToQuillDelta(question.question || ""),
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

    // Ensure all options have valid IDs
    if (!normalizedQuestion.options.every((opt) => opt.id)) {
      normalizedQuestion.options = normalizedQuestion.options.map(
        (opt, oIndex) => ({
          ...opt,
          id: opt.id || `opt_${Date.now()}_${qIndex}_${oIndex}`,
        }),
      );
    }

    // Ensure correctAnswer matches an option ID
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

// Validation function for MCQ questions
const validateMCQQuestions = (questions: MCQQuestion[]): boolean => {
  if (!Array.isArray(questions) || questions.length === 0) {
    return false;
  }

  return questions.every((question) => {
    // Validate question text
    if (!isValidQuillDelta(question.question)) {
      return false;
    }

    // Validate options
    if (!Array.isArray(question.options) || question.options.length < 2) {
      return false;
    }

    // Validate each option
    const validOptions = question.options.every(
      (option) =>
        option.id &&
        typeof option.id === "string" &&
        isValidQuillDelta(option.text),
    );

    if (!validOptions) {
      return false;
    }

    // Validate correct answer exists in options
    const correctAnswerExists = question.options.some(
      (option) => option.id === question.correctAnswer,
    );

    if (!correctAnswerExists) {
      return false;
    }

    // Validate explanation if provided
    if (question.explanation && !isValidQuillDelta(question.explanation)) {
      return false;
    }

    return true;
  });
};

//  Create MCQ with Quill support
export const createMCQ = async (req: Request, res: Response) => {
  const { moduleId } = req.params;
  const { questions, passingScore } = req.body;

  try {
    console.log("📝 Creating MCQ for module:", moduleId);
    console.log(
      "📝 Raw questions received:",
      JSON.stringify(questions, null, 2),
    );
    console.log("📝 Passing score:", passingScore);

    // Validate input
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

    // Normalize questions from different frontend formats
    const normalizedQuestions = normalizeMCQQuestions(questions);
    console.log(
      "📝 Normalized questions:",
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
      return res.status(400).json({
        message:
          "An MCQ test already exists for this module. Use update to modify it.",
      });
    }

    // Create the new MCQ with normalized Quill content
    const newMCQ = ModuleMCQ.create({
      module: moduleRecord,
      questions: normalizedQuestions, // Store normalized questions as JSON (TypeORM will handle serialization)
      passingScore,
    });

    const savedMCQ = (await createRecord(ModuleMCQ, newMCQ)) as ModuleMCQ;
    console.log("📝 MCQ saved successfully with ID:", savedMCQ.id);

    // Store correct answers separately for evaluation
    for (let index = 0; index < normalizedQuestions.length; index++) {
      const question = normalizedQuestions[index];
      const answer = ModuleMCQAnswer.create({
        moduleMCQ: savedMCQ,
        questionId: question.id || `q_${index}`, // Use provided ID or generate one
        correctAnswer: question.correctAnswer,
      });
      await createRecord(ModuleMCQAnswer, answer);
    }

    res.status(201).json({
      message: "MCQ created successfully",
      mcq: {
        id: savedMCQ.id,
        passingScore: savedMCQ.passingScore,
        questions: normalizedQuestions, // Send back normalized questions
      },
    });
  } catch (error) {
    console.error("Error creating MCQ:", error);
    res.status(500).json({ message: "Error creating MCQ" });
  }
};

//  Get MCQ by ID with Quill support
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
    console.error("Error fetching MCQ:", error);
    res.status(500).json({ message: "Error fetching MCQ" });
  }
};

//  Update MCQ with Quill support
export const updateMCQ = async (req: Request, res: Response) => {
  const { mcqId } = req.params;
  const { questions, passingScore } = req.body;

  console.log("📝 [UPDATE MCQ] Updating MCQ");
  console.log("🔍 [UPDATE MCQ] MCQ ID:", mcqId);
  console.log("🔍 [UPDATE MCQ] Request params:", req.params);
  console.log("🔍 [UPDATE MCQ] Has questions:", !!questions);
  console.log("🔍 [UPDATE MCQ] Passing score:", passingScore);

  try {
    if (!mcqId) {
      console.log(" [UPDATE MCQ] No MCQ ID provided");
      return res.status(400).json({ message: "MCQ ID is required" });
    }

    // Check if MCQ exists
    const existingMCQ = await getSingleRecord(ModuleMCQ, {
      where: { id: mcqId },
    });

    if (!existingMCQ) {
      console.log(" [UPDATE MCQ] MCQ not found with ID:", mcqId);
      return res.status(404).json({ message: "MCQ not found" });
    }

    console.log(" [UPDATE MCQ] Found existing MCQ:", existingMCQ.id);

    // Check if any students have already attempted this MCQ
    const existingResponses = await getAllRecordsWithFilter(
      ModuleMCQResponses,
      {
        where: { moduleMCQ: { id: mcqId } },
      },
    );

    if (existingResponses.length > 0) {
      return res.status(400).json({
        message: "Cannot update MCQ as students have already attempted it",
      });
    }

    // Normalize and validate input if provided
    let normalizedQuestions;
    if (questions) {
      console.log(
        "📝 Updating MCQ with raw questions:",
        JSON.stringify(questions, null, 2),
      );
      normalizedQuestions = normalizeMCQQuestions(questions);
      console.log(
        "📝 Normalized questions for update:",
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

    // Prepare update data
    const updateData: any = {};
    if (normalizedQuestions) {
      updateData.questions = normalizedQuestions;
    }
    if (passingScore !== undefined) {
      updateData.passingScore = passingScore;
    }

    await updateRecords(ModuleMCQ, { id: mcqId }, updateData, false);

    // If questions are updated, update the answers as well
    if (normalizedQuestions) {
      // Delete existing answers
      await deleteRecords(ModuleMCQAnswer, { moduleMCQ: { id: mcqId } });

      // Create new answers
      for (let index = 0; index < normalizedQuestions.length; index++) {
        const question = normalizedQuestions[index];
        const answer = ModuleMCQAnswer.create({
          moduleMCQ: existingMCQ,
          questionId: question.id || `q_${index}`,
          correctAnswer: question.correctAnswer,
        });
        await createRecord(ModuleMCQAnswer, answer);
      }
    }

    // Fetch updated MCQ
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
    console.error("Error updating MCQ:", error);
    res.status(500).json({ message: "Error updating MCQ" });
  }
};

//  Delete MCQ
export const deleteMCQ = async (req: Request, res: Response) => {
  const { mcqId } = req.params;

  console.log("🗑️ [DELETE MCQ] Deleting MCQ");
  console.log("🔍 [DELETE MCQ] MCQ ID:", mcqId);
  console.log("🔍 [DELETE MCQ] Request params:", req.params);

  try {
    if (!mcqId) {
      console.log(" [DELETE MCQ] No MCQ ID provided");
      return res.status(400).json({ message: "MCQ ID is required" });
    }

    // Check if MCQ exists
    const existingMCQ = await getSingleRecord(ModuleMCQ, {
      where: { id: mcqId },
    });

    if (!existingMCQ) {
      console.log(" [DELETE MCQ] MCQ not found with ID:", mcqId);
      return res.status(404).json({ message: "MCQ not found" });
    }

    console.log(" [DELETE MCQ] Found MCQ to delete:", existingMCQ.id);

    // Check if any students have already attempted this MCQ
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

    // Delete associated answers first (due to foreign key constraints)
    await deleteRecords(ModuleMCQAnswer, { moduleMCQ: { id: mcqId } });

    // Delete the MCQ
    await deleteRecords(ModuleMCQ, { id: mcqId });

    res.status(200).json({ message: "MCQ deleted successfully" });
  } catch (error) {
    console.error("Error deleting MCQ:", error);
    res.status(500).json({ message: "Error deleting MCQ" });
  }
};

//  Get MCQ by Module ID with Quill support (Fixed relation)
export const getMCQ = async (req: Request, res: Response) => {
  const { courseId, moduleId } = req.params;

  console.log("📝 [GET MCQ] Getting MCQ for module");
  console.log("🔍 [GET MCQ] Course ID:", courseId);
  console.log("🔍 [GET MCQ] Module ID:", moduleId);
  console.log("🔍 [GET MCQ] Full URL:", req.originalUrl);
  console.log("🔍 [GET MCQ] User:", req.user?.username);

  try {
    console.log(`🔍 [GET MCQ] Looking for module: ${moduleId}`);

    // Check if module exists
    const moduleData = await getSingleRecord(Module, {
      where: { id: moduleId },
    });

    if (!moduleData) {
      console.log(` [GET MCQ] Module not found with ID: ${moduleId}`);
      return res.status(404).json({ message: "Module not found" });
    }

    console.log(
      ` [GET MCQ] Module found: ${moduleData.id} - ${moduleData.title}`,
    );

    // Get MCQ for this module (fixed relation name)
    const mcq = await getSingleRecord(ModuleMCQ, {
      where: { module: { id: moduleId } },
      relations: ["module"],
    });

    if (!mcq) {
      console.log(
        `ℹ️ [GET MCQ] No MCQ found for module: ${moduleId} - this is normal if MCQ hasn't been created yet`,
      );
      return res.status(404).json({ message: "No MCQ found for this module" });
    }

    console.log(
      ` [GET MCQ] MCQ found for module: ${moduleId}, MCQ ID: ${mcq.id}`,
    );

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
    console.error(
      ` [GET MCQ] Error fetching MCQ for module ${moduleId}:`,
      error,
    );
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
      await deleteRecords(ModuleMCQResponses, { id: existingResponse.id });
    }

    // Remove correct answers from questions for student view
    const questionsForStudent = mcq.questions.map((question: MCQQuestion) => ({
      id: question.id,
      question: question.question,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
      })),
      explanation: question.explanation,
    }));

    res.status(200).json({
      id: mcq.id,
      passingScore: mcq.passingScore,
      questions: questionsForStudent,
      attempted: false,
    });
  } catch (error) {
    console.error("Error fetching MCQ for student:", error);
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
    console.error("Error checking MCQ retake status:", error);
    res.status(500).json({ message: "Error checking MCQ retake status" });
  }
};
