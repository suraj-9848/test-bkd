import { Request, Response } from "express";
import { StudentCourseProgress } from "../../db/mysqlModels/StudentCourseProgress";
import {
  getSingleRecord,
  updateRecords,
  createRecord,
} from "../../lib/dbLib/sqlUtils";

export const updateCourseProgress = async (req: Request, res: Response) => {
  try {
    const { student_id, session_id, current_page, status } = req.body;

    if (!student_id || !session_id || !current_page || !status) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const existingProgress = await getSingleRecord(StudentCourseProgress, {
      where: { student_id, session_id },
    });

    if (existingProgress) {
      const result = await updateRecords(
        StudentCourseProgress,
        { id: existingProgress.id },
        { current_page, status },
        false
      );

      return res.status(200).json({
        message: "Student course progress updated successfully",
        result,
      });
    }

    const newProgress = new StudentCourseProgress();
    newProgress.student_id = student_id;
    newProgress.session_id = session_id;
    newProgress.current_page = current_page;
    newProgress.status = status;

    const created = await createRecord(StudentCourseProgress, newProgress);

    return res.status(201).json({
      message: "Student course progress created successfully",
      progress: created,
    });
  } catch (err) {
    console.error("Error updating/creating student course progress:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
