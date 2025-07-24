// Updated MCQ Controller using utility functions with Quill Rich Text Editor support

import { Request, Response } from "express";
import { Module } from "../../db/mysqlModels/Module";
import { ModuleMCQ } from "../../db/mysqlModels/ModuleMCQ";
import { ModuleMCQAnswer } from "../../db/mysqlModels/ModuleMCQAnswer";
import { ModuleMCQResponses } from "../../db/mysqlModels/ModuleMCQResponses";
import { User } from "../../db/mysqlModels/User";
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

// ✅ Create MCQ with Quill support
export const createMCQ = async (req: Request, res: Response) => {
  const { moduleId } = req.params;
  const { questions, passingScore } = req.body;

  try {
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

    // Validate MCQ questions with Quill format
    if (!validateMCQQuestions(questions)) {
      return res.status(400).json({
        message:
          "Invalid questions format. Each question must have valid Quill Delta format for question text and options, with at least 2 options and a valid correct answer.",
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

    // Create the new MCQ with Quill content
    const newMCQ = ModuleMCQ.create({
      module: moduleRecord,
      questions: questions, // Store as JSON (TypeORM will handle serialization)
      passingScore,
    });

    const savedMCQ = (await createRecord(ModuleMCQ, newMCQ)) as ModuleMCQ;

    // Store correct answers separately for evaluation
    for (let index = 0; index < questions.length; index++) {
      const question = questions[index];
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
        questions: savedMCQ.questions,
      },
    });
  } catch (error) {
    console.error("Error creating MCQ:", error);
    res.status(500).json({ message: "Error creating MCQ" });
  }
};

// ✅ Get MCQ by ID with Quill support
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

// ✅ Update MCQ with Quill support
export const updateMCQ = async (req: Request, res: Response) => {
  const { mcqId } = req.params;
  const { questions, passingScore } = req.body;

  try {
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
      return res.status(400).json({
        message: "Cannot update MCQ as students have already attempted it",
      });
    }

    // Validate input if provided
    if (questions && !validateMCQQuestions(questions)) {
      return res.status(400).json({
        message:
          "Invalid questions format. Each question must have valid Quill Delta format for question text and options, with at least 2 options and a valid correct answer.",
      });
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
    if (questions) {
      updateData.questions = questions;
    }
    if (passingScore !== undefined) {
      updateData.passingScore = passingScore;
    }

    await updateRecords(ModuleMCQ, { id: mcqId }, updateData, false);

    // If questions are updated, update the answers as well
    if (questions) {
      // Delete existing answers
      await deleteRecords(ModuleMCQAnswer, { moduleMCQ: { id: mcqId } });

      // Create new answers
      for (let index = 0; index < questions.length; index++) {
        const question = questions[index];
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

// ✅ Delete MCQ
export const deleteMCQ = async (req: Request, res: Response) => {
  const { mcqId } = req.params;

  try {
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

// ✅ Get MCQ by Module ID with Quill support (Fixed relation)
export const getMCQ = async (req: Request, res: Response) => {
  const { courseId, moduleId } = req.params;

  console.log("=== getMCQ Controller Called ===");
  console.log("Course ID:", courseId);
  console.log("Module ID:", moduleId);
  console.log("Full URL:", req.originalUrl);
  console.log("User:", req.user);

  try {
    console.log(`Getting MCQ for Module ID: ${moduleId}`);

    // Check if module exists
    const moduleData = await getSingleRecord(Module, {
      where: { id: moduleId },
    });

    if (!moduleData) {
      console.log(`Module not found with ID: ${moduleId}`);
      return res.status(404).json({ message: "Module not found" });
    }

    console.log(`Module found: ${moduleData.id} - ${moduleData.title}`);

    // Get MCQ for this module (fixed relation name)
    const mcq = await getSingleRecord(ModuleMCQ, {
      where: { module: { id: moduleId } },
      relations: ["module"],
    });

    if (!mcq) {
      console.log(`No MCQ found for module: ${moduleId}`);
      return res.status(404).json({ message: "No MCQ found for this module" });
    }

    console.log(`MCQ found for module: ${moduleId}, MCQ ID: ${mcq.id}`);

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
    console.error(`Error fetching MCQ for module ${moduleId}:`, error);
    res.status(500).json({ message: "Error fetching MCQ" });
  }
};

// ✅ Get MCQ for student (without correct answers)
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
        message: "You can take this MCQ"
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
        : "You can retake this MCQ to improve your score"
    });

  } catch (error) {
    console.error("Error checking MCQ retake status:", error);
    res.status(500).json({ message: "Error checking MCQ retake status" });
  }
};
