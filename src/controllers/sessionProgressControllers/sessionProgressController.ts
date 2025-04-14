import { Request, Response } from "express";
import { StudentSessionProgress } from "../../db/mysqlModels/StudentSessionProgress";
import {
  getSingleRecord,
  updateRecords,
  createRecord,
} from "../../lib/dbLib/sqlUtils";

export const updateSessionProgress = async (req: Request, res: Response) => {
  try {
    const { student_id, session_id, question_id, status } = req.body;

    if (!student_id || !session_id || !question_id || !status) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const existingProgress = await getSingleRecord(StudentSessionProgress, {
      where: { student_id, session_id, question_id },
    });

    if (existingProgress) {
      const result = await updateRecords(
        StudentSessionProgress,
        { id: existingProgress.id },
        { status },
        false
      );

      return res.status(200).json({
        message: "Student session progress updated successfully",
        result,
      });
    }

    const newProgress = new StudentSessionProgress();
    newProgress.student_id = student_id;
    newProgress.session_id = session_id;
    newProgress.question_id = question_id;
    newProgress.status = status;

    const created = await createRecord(
      StudentSessionProgress,
      newProgress
    );

    return res.status(201).json({
      message: "Student session progress created successfully",
      progress: created,
    });
  } catch (err) {
    console.error("Error updating/creating student session progress:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
