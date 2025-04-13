import { Request, Response } from "express";
import { StudentCourseProgress } from "../../db/mysqlModels/StudentCourseProgress";
import { updateRecords, getSingleRecord } from "../../lib/dbLib/sqlUtils";
const logger = require("../../utils/logger").getLoggerByName("CourseProgressController");
const { performance } = require("perf_hooks");

export const updateCourseProgress = async (req: Request, res: Response) => {
  performance.mark("updateCourseProgress-start");

  try {
    const { student_id, session_id, current_page, status } = req.body;

    if (!student_id || !session_id || !current_page || !status) {
      logger.warn("Missing required fields");
      return res.status(400).json({ message: "Missing required fields" });
    }

    const existingProgress = await getSingleRecord(StudentCourseProgress as any, { student_id, session_id });

    if (existingProgress) {
      await updateRecords(StudentCourseProgress as any, { student_id, session_id }, { current_page, status }, false);
      logger.info(`Progress updated for student_id=${student_id}`);
      performance.mark("updateCourseProgress-end");
      performance.measure("updateCourseProgress", "updateCourseProgress-start", "updateCourseProgress-end");
      return res.status(200).json({ message: "Progress updated successfully" });
    }

    // Use updateRecords with upsert: true to insert if not exists
    await updateRecords(StudentCourseProgress as any, [{ student_id, session_id }], {
      student_id,
      session_id,
      current_page,
      status,
    }, true);

    logger.info(`Progress created for student_id=${student_id}`);
    performance.mark("updateCourseProgress-end");
    performance.measure("updateCourseProgress", "updateCourseProgress-start", "updateCourseProgress-end");

    return res.status(201).json({ message: "Progress created successfully" });

  } catch (error) {
    logger.error("Error in updateCourseProgress", error);
    performance.mark("updateCourseProgress-end");
    performance.measure("updateCourseProgress", "updateCourseProgress-start", "updateCourseProgress-end");
    return res.status(500).json({ message: "Internal server error" });
  }
};
