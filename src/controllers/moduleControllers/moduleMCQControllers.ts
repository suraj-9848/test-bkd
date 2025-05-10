// Updated MCQ Controller using utility functions

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

// ✅ Create MCQ
export const createMCQ = async (req: Request, res: Response) => {
  const { moduleId, questions, passingScore } = req.body;

  try {
    // Check if the module exists
    const module = await getSingleRecord(Module, { id: moduleId });
    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    // Check if an MCQ already exists for this module
    const existingMCQ = await getSingleRecord(ModuleMCQ, { module: { id: moduleId } });
    if (existingMCQ) {
      return res.status(400).json({
        message: "An MCQ test already exists for this module. Use update to modify it.",
      });
    }

    // Create the new MCQ
    const newMCQ = ModuleMCQ.create({
      module,
      questions,
      passingScore,
    });

    const savedMCQ = await createRecord(ModuleMCQ, newMCQ);
    res.status(201).json(savedMCQ);
  } catch (error) {
    console.error("Error creating MCQ:", error);
    res.status(500).json({ message: "Error creating MCQ" });
  }
};

// ✅ Get MCQ by ID
export const getMCQById = async (req: Request, res: Response) => {
  const { mcqId } = req.params;

  try {
    const mcq = await getSingleRecord(ModuleMCQ, { id: mcqId });

    if (!mcq) {
      return res.status(404).json({ message: "MCQ not found" });
    }

    res.status(200).json(mcq);
  } catch (error) {
    console.error("Error fetching MCQ:", error);
    res.status(500).json({ message: "Error fetching MCQ" });
  }
};

// ✅ Update MCQ
export const updateMCQ = async (req: Request, res: Response) => {
  const { mcqId } = req.params;
  const { questions, passingScore } = req.body;

  try {
    const updatedMCQ = await updateRecords(
      ModuleMCQ,
      { id: mcqId },
      { questions, passingScore },
      false,
    );
    res.status(200).json(updatedMCQ);
  } catch (error) {
    console.error("Error updating MCQ:", error);
    res.status(500).json({ message: "Error updating MCQ" });
  }
};

// ✅ Delete MCQ
export const deleteMCQ = async (req: Request, res: Response) => {
  const { mcqId } = req.params;

  try {
    await deleteRecords(ModuleMCQ, { id: mcqId });
    res.status(200).json({ message: "MCQ deleted successfully" });
  } catch (error) {
    console.error("Error deleting MCQ:", error);
    res.status(500).json({ message: "Error deleting MCQ" });
  }
};
