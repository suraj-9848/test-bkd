import { AppDataSource } from "../../db/connect"; 
import { StudentSessionProgress } from "../../db/mysqlModels/StudentSessionProgress";
import { Request, Response } from "express";

export const updateSessionProgress = async (req: Request, res: Response) => {
  try {
    const { student_id, session_id, question_id, status } = req.body;

    if (!student_id || !session_id || !question_id || !status) {
      return res.status(400).json({ message: "Missing required fields" });
    }


    const repo = AppDataSource.getRepository(StudentSessionProgress);


    const existingProgress = await repo.findOneBy({ student_id, session_id, question_id });

    if (existingProgress) {

      existingProgress.status = status;

      const updated = await repo.save(existingProgress);

      return res.status(200).json({
        message: "Student session progress updated successfully",
        data: updated,
      });
    } else {
      
      const newProgress = repo.create({
        student_id,
        session_id,
        question_id,
        status,
      });

      const saved = await repo.save(newProgress);

      return res.status(201).json({
        message: "Student session progress created successfully",
        data: saved,
      });
    }
  } catch (error) {
    console.error("Error updating session progress:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
