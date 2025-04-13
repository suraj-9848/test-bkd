import { Request, Response } from "express";
import { StudentSessionProgress } from "../../db/mysqlModels/StudentSessionProgress";
import { getSingleRecord, updateRecords } from "../../lib/dbLib/sqlUtils";

const logger = require("../../utils/logger").getLoggerByName("SessionProgressController");
const { performance } = require("perf_hooks");

export const updateSessionProgress = async (req: Request, res: Response) => {
  performance.mark("updateSessionProgress-start");

  try {
    const { student_id, session_id, question_id, status } = req.body;

    if (!student_id || !session_id || !question_id || !status) {
      logger.warn("Missing required fields in session progress");
      return res.status(400).json({ message: "Missing required fields" });
    }

    const existingProgress = await getSingleRecord(StudentSessionProgress as any, {
      student_id,
      session_id,
      question_id,
    });

    if (existingProgress) {
      await updateRecords(
        StudentSessionProgress as any,
        { student_id, session_id, question_id },
        { status },
        false
      );
      logger.info(`Session progress updated for student_id=${student_id}, session_id=${session_id}`);
      performance.mark("updateSessionProgress-end");
      performance.measure("updateSessionProgress", "updateSessionProgress-start", "updateSessionProgress-end");

      return res.status(200).json({ message: "Session progress updated successfully" });
    }

    await updateRecords(
      StudentSessionProgress as any,
      [{ student_id, session_id, question_id }],
      { student_id, session_id, question_id, status },
      true
    );

    logger.info(`Session progress created for student_id=${student_id}, session_id=${session_id}`);
    performance.mark("updateSessionProgress-end");
    performance.measure("updateSessionProgress", "updateSessionProgress-start", "updateSessionProgress-end");

    return res.status(201).json({ message: "Session progress created successfully" });

  } catch (error) {
    logger.error("Error in updateSessionProgress", error);
    performance.mark("updateSessionProgress-end");
    performance.measure("updateSessionProgress", "updateSessionProgress-start", "updateSessionProgress-end");

    return res.status(500).json({ message: "Internal server error" });
  }
};
