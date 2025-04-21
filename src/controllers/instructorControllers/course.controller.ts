import { Request, Response } from "express";
import { Course } from "../../db/mysqlModels/Course";
import { Batch } from "../../db/mysqlModels/Batch";
import { User } from "../../db/mysqlModels/User";
import {
  createRecord,
  getSingleRecord,
  deleteRecords,
  updateRecords,
  getAllRecords,
  getAllRecordsWithFilter,
} from "../../lib/dbLib/sqlUtils";

export const createCourse = async (req: Request, res: Response) => {
  try {
    const { title, logo, pages_id, content, start_date, end_date, batch_id } =
      req.body;

    const batch = await getSingleRecord<Batch, any>(
      Batch,
      { where: { id: batch_id } },
      `batch_${batch_id}`,
      true,
      0
    );
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
      10 * 60
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
    const { id, batchId } = req.params;

    const course = await getSingleRecord<Course, any>(
      Course,
      { where: { id }, relations: ["batch"] },
      `course_${id}`,
      true,
      0
    );

    if (!course || course.batch?.id !== batchId) {
      return res.status(403).json({ message: "Course not found in batch" });
    }

    const result = await deleteRecords(Course, { id });
    return res.status(200).json({ message: "Course deleted successfully" });
  } catch (err) {
    console.error("Error deleting course:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateCourse = async (req: Request, res: Response) => {
  try {
    const { id, batchId } = req.params;
    const updateData = req.body;

    const course = await getSingleRecord<Course, any>(
      Course,
      { where: { id }, relations: ["batch"] },
      `course_${id}`,
      true,
      0
    );

    if (!course || course.batch?.id !== batchId) {
      return res.status(403).json({ message: "Course not found in batch" });
    }

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
      10 * 60
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
    const { courseId, batchId } = req.params;

    const course = await getSingleRecord<Course, any>(
      Course,
      { where: { id: courseId }, relations: ["batch"] },
      `course_${courseId}`,
      true,
      10 * 60
    );

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (batchId && course.batch?.id !== batchId) {
      return res.status(403).json({
        message: "Unauthorized: Course does not belong to the specified batch",
      });
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

export const assigningStudent = async (req: Request, res: Response) => {
  try {
    const { user_id, course_id } = req.body;

    const course = await getSingleRecord<Course, any>(
      Course,
      { where: { id: course_id }, relations: ["batch"] }, // include batch
      `course_${course_id}`,
      true,
      0
    );

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (!course.batch) {
      return res
        .status(400)
        .json({ message: "Course is not assigned to any batch" });
    }

    const user = await getSingleRecord<User, any>(User, {
      where: { id: user_id },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.userRole !== "student") {
      return res.status(403).json({
        message: "Only users with student role can be assigned to a course",
      });
    }

    const batchId = course.batch.id;
    const batches: string[] = user.batch_id || [];

    if (!batches.includes(batchId)) {
      batches.push(batchId);
      user.batch_id = batches;
      await user.save();
    }

    return res
      .status(200)
      .json({ message: "Student enrolled and batch assigned" });
  } catch (err) {
    console.error("Error enrolling student:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const fetchCoursesInBatch = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const courses = await getAllRecordsWithFilter<Course, any>(
      Course,
      { where: { batch: { id: batchId } }, relations: ["batch"] },
      `batch_${batchId}_courses`,
      true,
      10 * 60
    );
    return res.status(200).json({ message: "Courses fetched", courses });
  } catch (err) {
    console.error("Error fetching batch courses:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
