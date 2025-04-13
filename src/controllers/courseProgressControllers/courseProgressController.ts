import { AppDataSource } from "../../db/connect"; 
import { StudentCourseProgress } from "../../db/mysqlModels/StudentCourseProgress";
import { Request, Response } from "express";

export const updateCourseProgress = async (req: Request, res: Response) => {
  try {
    const { student_id, session_id, current_page, status } = req.body;

    if (!student_id || !session_id || !current_page || !status) {
      return res.status(400).json({ message: "Missing required fields" });
    }


    const repo = AppDataSource.getRepository(StudentCourseProgress);


    const existingProgress = await repo.findOneBy({ student_id, session_id });

    if (existingProgress) {
      existingProgress.current_page = current_page;
      existingProgress.status = status;

      const updated = await repo.save(existingProgress);

      return res.status(200).json({
        message: "Student course progress updated successfully",
        data: updated,
      });
    } else {

      const newProgress = repo.create({
        student_id,
        session_id,
        current_page,
        status,
      });

      const saved = await repo.save(newProgress);

      return res.status(201).json({
        message: "Student course progress created successfully",
        data: saved,
      });
    }
  } catch (error) {
    console.error("Error updating course progress:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
