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
    const { name, description, org_id } = req.body;
    const batch = new Batch();
    batch.name = name;
    batch.description = description;
    batch.org_id = org_id;

    const saved = await createRecord<Batch>(
      Batch.getRepository(),
      batch,
      "all_batches",
      10 * 60,
    );
    return res.status(201).json({ message: "Batch created", batch: saved });
  } catch (err) {
    console.error("Error creating batch:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const fetchAllBatches = async (req: Request, res: Response) => {
  try {
    console.log("=== FETCH ALL BATCHES DEBUG ===");
    const batches = await getAllRecords(Batch, {
      relations: ["courses"],
    });
    console.log("Found batches count:", batches?.length);
    console.log("Batches:", JSON.stringify(batches, null, 2));
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
      10 * 60,
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
