import { Request, Response } from "express";
import { StudentCourseProgress } from "../../db/mysqlModels/StudentCourseProgress";
import {
  getSingleRecord,
  updateRecords,
  createRecord,
} from "../../lib/dbLib/sqlUtils";
import { getLogger } from "../../utils/logger";
import { Course } from "../../db/mysqlModels/Course";

const logger = getLogger();

export const updateCourseProgress = async (req: Request, res: Response) => {
  try {
    const { student_id, session_id, current_page, status } = req.body;

    if (!student_id || !session_id || !current_page || !status) {
      logger.warn("Missing required fields in request body");
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
        false,
      );

      logger.info(
        `Updated course progress for student_id: ${student_id}, session_id: ${session_id}`,
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

    logger.info(
      `Created new course progress for student_id: ${student_id}, session_id: ${session_id}`,
    );
    return res.status(201).json({
      message: "Student course progress created successfully",
      progress: created,
    });
  } catch (err) {
    logger.error("Error updating/creating student course progress:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateCourseLogo = async (req: Request, res: Response) => {
  try {
    console.log("req.file:", req.file);

    console.log("Received file:", req.file);
    const { courseId } = req.params;
    const { logoUrl } = req.body;

    if (!courseId || !logoUrl) {
      logger.warn("Missing required fields in request body");
      return res.status(400).json({ message: "Missing required fields" });
    }

    const course = await getSingleRecord(Course, {
      where: { id: courseId },
    });

    if (!course) {
      logger.warn(`Course with ID ${courseId} not found`);
      return res.status(404).json({ message: "Course not found" });
    }

    course.logoUrl = logoUrl;
    const updatedCourse = await updateRecords(
      Course,
      { id: courseId },
      { logoUrl },
      false,
    );

    logger.info(`Updated course logo for course_id: ${courseId}`);
    return res.status(200).json({
      message: "Course logo updated successfully",
      course: updatedCourse,
    });
  } catch (err) {
    logger.error("Error updating course logo:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};