import { Request, Response } from "express";
import { Course } from "../../db/mysqlModels/Course";
import { Batch } from "../../db/mysqlModels/Batch";
import { Module } from "../../db/mysqlModels/Module";
import {
  createRecord,
  getSingleRecord,
  deleteRecords,
  updateRecords,
  getAllRecords,
} from "../../lib/dbLib/sqlUtils";

// Create Course
export const createCourse = async (req: Request, res: Response) => {
  try {
    const { title, logo, start_date, end_date, batch_id, modules } = req.body;

    // Validate required fields
    if (!title || !start_date || !end_date || !batch_id) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check if batch exists
    const batch = await getSingleRecord(Batch, { where: { id: batch_id } });
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    // Create course
    const course = Course.create({
      title,
      logo,
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      batch,
    });

    // Handle modules if provided
    if (modules && Array.isArray(modules)) {
      course.modules = await Promise.all(
        modules.map(async (moduleData: any, index: number) => {
          const module = Module.create({
            title: moduleData.title,
            order: moduleData.order || index + 1,
            isLocked: moduleData.order === 1 ? false : true,
            course,
          });
          return module;
        })
      );
    }

    // Save course with modules
    const savedCourse = await createRecord(Course, course, `course_${course.id}`, 10 * 60);

    return res.status(201).json({
      message: "Course created successfully",
      course: savedCourse,
    });
  } catch (err) {
    console.error("Error creating course:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Delete Course
export const deleteCourse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await deleteRecords(Course, { id });

    // Check if any course was deleted
    if (!result || result.affected === 0) {
      return res.status(404).json({ message: "Course not found" });
    }

    return res.status(200).json({ message: "Course deleted successfully" });
  } catch (err) {
    console.error("Error deleting course:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Update Course
export const updateCourse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, logo, start_date, end_date, batch_id } = req.body;

    // Validate input
    const updateData: any = {};
    if (title) updateData.title = title;
    if (logo) updateData.logo = logo;
    if (start_date) updateData.start_date = new Date(start_date);
    if (end_date) updateData.end_date = new Date(end_date);
    if (batch_id) {
      const batch = await getSingleRecord(Batch, { where: { id: batch_id } });
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }
      updateData.batch = batch;
    }

    // Update course
    const result = await updateRecords(Course, { id }, updateData, false);

    // Check if course was updated
    if (!result || result.affected === 0) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Fetch updated course
    const updatedCourse = await getSingleRecord(Course, { where: { id } });
    return res.status(200).json({
      message: "Course updated successfully",
      course: updatedCourse,
    });
  } catch (err) {
    console.error("Error updating course:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Fetch All Courses
export const fetchAllCourses = async (req: Request, res: Response) => {
  try {
    const courses = await getAllRecords(Course, "all_courses", true, 10 * 60);

    return res.status(200).json({
      message: "Courses fetched successfully",
      courses,
    });
  } catch (err) {
    console.error("Error fetching all courses:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Fetch Single Course
export const fetchCourse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const course = await getSingleRecord(Course, { 
      where: { id },
      relations: ["modules"],
    }, `course_${id}`, true, 10 * 60);

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