import { Request, Response } from "express";
import { Batch } from "../../db/mysqlModels/Batch";
import {
  createRecord,
  getSingleRecord,
  deleteRecords,
  updateRecords,
  getAllRecords,
} from "../../lib/dbLib/sqlUtils";

export const createBatch = async (req: Request, res: Response) => {
  try {
    const { name, description, org_id, is_public } = req.body;
    const batch = new Batch();
    batch.name = name;
    batch.description = description;
    batch.org_id = org_id;
    batch.is_public = Boolean(is_public);

    const saved = await createRecord<Batch>(
      Batch.getRepository(),
      batch,
      "all_batches",
      10 * 60
    );
    return res.status(201).json({ message: "Batch created", batch: saved });
  } catch (err) {
    console.error("Error creating batch:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const fetchAllBatches = async (_: Request, res: Response) => {
  try {
    const batches = await getAllRecords<Batch>(
      Batch,
      "all_batches",
      true,
      10 * 60
    );
    return res.status(200).json({ message: "Fetched batches", batches });
  } catch (err) {
    console.error("Error fetching batches:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const fetchBatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const batch = await getSingleRecord<Batch, any>(
      Batch,
      { where: { id } },
      `batch_${id}`,
      true,
      10 * 60
    );
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }
    return res.status(200).json({ message: "Batch fetched", batch });
  } catch (err) {
    console.error("Error fetching batch:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateBatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const result = await updateRecords(Batch, { id }, updateData, false);
    return res.status(200).json({ message: "Batch updated", result });
  } catch (err) {
    console.error("Error updating batch:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteBatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deleteRecords(Batch, { id });
    if (result.affected === 0) {
      return res.status(404).json({ message: "Batch not found" });
    }
    return res.status(200).json({ message: "Batch deleted" });
  } catch (err) {
    console.error("Error deleting batch:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const toggleBatchVisibility = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_public } = req.body;
    const result = await updateRecords(
      Batch,
      { id },
      { is_public: Boolean(is_public) },
      false
    );
    return res.status(200).json({ message: "Visibility updated", result });
  } catch (err) {
    console.error("Error toggling visibility:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

import { getAllRecordsWithFilter } from "../../lib/dbLib/sqlUtils";

export const fetchPublicBatches = async (_: Request, res: Response) => {
  try {
    const batches = await getAllRecordsWithFilter<Batch, any>(
      Batch,
      { where: { is_public: true } },
      "public_batches",
      true,
      10 * 60
    );

    return res.status(200).json({ message: "Public batches", batches });
  } catch (err) {
    console.error("Error fetching public batches:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const fetchPublicCoursesInBatch = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    const batch = await getSingleRecord<Batch, any>(Batch, {
      where: { id, is_public: true },
    });
    if (!batch) {
      return res.status(404).json({ message: "Batch not found or private" });
    }
    return res
      .status(200)
      .json({ message: "Public batch courses", courses: batch.courses });
  } catch (err) {
    console.error("Error fetching batch courses:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

