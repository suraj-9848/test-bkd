import { Request, Response } from "express";
import { Batch } from "../../db/mysqlModels/Batch";
import {
  createRecord,
  getSingleRecord,
  deleteRecords,
  updateRecords,
  getAllRecords,
  getAllRecordsWithFilter,
} from "../../lib/dbLib/sqlUtils";
import { Course } from "../../db/mysqlModels/Course";
import { User } from "../../db/mysqlModels/User";
import { UserCourse } from "../../db/mysqlModels/UserCourse";

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

export const fetchAllBatches = async (_: Request, res: Response) => {
  try {
    const batches = await getAllRecords<Batch>(
      Batch,
      "all_batches",
      true,
      10 * 60,
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

// Assign a single student to a batch (with org_id enforcement)
export const assignBatchToStudent = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const { userId } = req.body;
    if (!userId)
      return res.status(400).json({ message: "User ID is required" });
    const batch = await getSingleRecord<Batch, any>(Batch, {
      where: { id: batchId },
    });
    if (!batch) return res.status(404).json({ message: "Batch not found" });
    let user = await getSingleRecord<User, any>(User, {
      where: { id: userId },
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    // enforce or initialize org_id
    if (!user.org_id) {
      await updateRecords(
        User,
        { id: userId },
        { org_id: batch.org_id },
        false,
      );
      user.org_id = batch.org_id;
    } else if (user.org_id !== batch.org_id) {
      return res
        .status(400)
        .json({ message: "User belongs to a different organization" });
    }
    // update user's batch list
    if (!user.batch_id.includes(batchId)) {
      user.batch_id = [...user.batch_id, batchId];
      await updateRecords(
        User,
        { id: userId },
        { batch_id: user.batch_id },
        false,
      );
    }
    // fetch and assign courses
    const courses = await getAllRecordsWithFilter<Course, any>(Course, {
      where: { batch: { id: batchId } },
    });
    const assigned: Course[] = [];
    for (const course of courses) {
      const exists = await getSingleRecord<UserCourse, any>(UserCourse, {
        where: { user: { id: userId }, course: { id: course.id } },
      });
      if (!exists)
        await createRecord(
          UserCourse.getRepository(),
          Object.assign(new UserCourse(), { user, course }),
        );
      assigned.push(course);
    }
    return res.status(200).json({
      message: "Student assigned to batch successfully",
      courses: assigned,
    });
  } catch (err) {
    console.error("Error assigning batch to student:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Assign multiple students to a batch (with org_id enforcement)
export const assignMultipleStudentsToBatch = async (
  req: Request,
  res: Response,
) => {
  try {
    const { batchId } = req.params;
    const { userIds } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: "userIds array is required" });
    }
    const batch = await getSingleRecord<Batch, any>(Batch, {
      where: { id: batchId },
    });
    if (!batch) return res.status(404).json({ message: "Batch not found" });
    const courses = await getAllRecordsWithFilter<Course, any>(Course, {
      where: { batch: { id: batchId } },
    });
    const results: any[] = [];
    for (const uid of userIds) {
      let user = await getSingleRecord<User, any>(User, {
        where: { id: uid },
      });
      if (!user) {
        results.push({ userId: uid, status: "User not found" });
        continue;
      }
      if (!user.org_id) {
        await updateRecords(User, { id: uid }, { org_id: batch.org_id }, false);
        user.org_id = batch.org_id;
      } else if (user.org_id !== batch.org_id) {
        results.push({ userId: uid, status: "Org mismatch" });
        continue;
      }
      if (!user.batch_id.includes(batchId)) {
        user.batch_id = [...user.batch_id, batchId];
        await updateRecords(
          User,
          { id: uid },
          { batch_id: user.batch_id },
          false,
        );
      }
      for (const course of courses) {
        const exists = await getSingleRecord<UserCourse, any>(UserCourse, {
          where: { user: { id: uid }, course: { id: course.id } },
        });
        if (!exists)
          await createRecord(
            UserCourse.getRepository(),
            Object.assign(new UserCourse(), { user, course }),
          );
      }
      results.push({
        userId: uid,
        status: "Assigned",
        coursesAssigned: courses.length,
      });
    }
    return res
      .status(200)
      .json({ message: "Batch assignment completed", results });
  } catch (err) {
    console.error("Error assigning multiple students to batch:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
