import { Request, Response } from "express";
import { Course } from "../../db/mysqlModels/Course";
import { Batch } from "../../db/mysqlModels/Batch";
import {
  createRecord,
  getSingleRecord,
  deleteRecords,
  updateRecords,
  getAllRecords,
} from "../../lib/dbLib/sqlUtils";

export const createCourse = async (req: Request, res: Response) => {
  try {
    const { title, logo, pages_id, content, start_date, end_date, batch_id } =
      req.body;

    const batch = await getSingleRecord(Batch, { where: { id: batch_id } });
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    const course = new Course();
    course.title = title;
    course.logo = logo;
    course.pages = pages_id;
    course.content = content;
    course.start_date = new Date(start_date);
    course.end_date = new Date(end_date);
    course.batch = batch;

    const savedCourse = await createRecord<Course>(
      Course.getRepository(),
      course,
      "all_courses",
      10 * 60,
    );

    return res.status(201).json({
      message: "Course created successfully",
      course: savedCourse,
    });
  } catch (err) {
    console.error("Error creating course:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteCourse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await deleteRecords(Course, { id });

    if (result.affected === 0) {
      return res.status(404).json({ message: "Course not found" });
    }

    return res.status(200).json({ message: "Course deleted successfully" });
  } catch (err) {
    console.error("Error deleting course:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateCourse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const result = await updateRecords(Course, { id }, updateData, false);

    return res.status(200).json({
      message: "Course updated successfully",
      result,
    });
  } catch (err) {
    console.error("Error updating course:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const fetchAllCourses = async (req: Request, res: Response) => {
  try {
    const courses = await getAllRecords<Course>(
      Course,
      "all_courses",
      true,
      10 * 60,
    );

    return res.status(200).json({
      message: "Courses fetched successfully",
      courses,
    });
  } catch (err) {
    console.error("Error fetching all courses:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const fetchCourse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const course = await getSingleRecord<Course, any>(
      Course,
      { where: { id } },
      `course_${id}`, // Unique cache key
      true,
      10 * 60,
    );

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    return res.status(200).json({
      message: "Course fetched successfully",
      course,
    });
  } catch (err) {
    console.error("Error fetching course:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
