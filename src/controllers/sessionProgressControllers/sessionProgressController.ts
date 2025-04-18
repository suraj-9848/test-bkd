import { Request, Response } from "express";
import { StudentSessionProgress } from "../../db/mysqlModels/StudentSessionProgress";
import { getSingleRecord, updateRecords } from "../../lib/dbLib/sqlUtils";
import { getLogger } from "../../utils/logger";

const logger = getLogger();

export const updateSessionProgress = async (req: Request, res: Response) => {
  try {
    const { student_id, session_id, question_id, status } = req.body;

    // Validate required fields
    if (!student_id || !session_id || !question_id || !status) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const existingProgress = await getSingleRecord(StudentSessionProgress, {
      where: { student_id, session_id, question_id },
    });

    if (!existingProgress) {
      return res.status(404).json({ message: "Session progress not found" });
    }

    const result = await updateRecords(
      StudentSessionProgress,
      { id: existingProgress.id },
      { status },
      false
    );

    logger.info("Session progress updated", { student_id, session_id, question_id });

    return res.status(200).json({
      message: "Session progress updated successfully",
      result,
    });
  } catch (err) {
    logger.error("Error updating session progress", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
