import { Request, Response } from "express";
import { Course } from "../../db/mysqlModels/Course";
import { Batch } from "../../db/mysqlModels/Batch";
import { Module } from "../../db/mysqlModels/Module";
import { DayContent } from "../../db/mysqlModels/DayContent";

import {
  createRecord,
  getSingleRecord,
  getAllRecords,
  updateRecords,
  deleteRecords,
} from "../../lib/dbLib/sqlUtils";

interface DayData {
  dayNumber: number;
  content: string;
  completed?: boolean;
}

interface ModuleData {
  title: string;
  order: number;
  isLocked: boolean;
  days: DayData[];
}

interface CourseData {
  title: string;
  logo?: string;
  start_date: string;
  end_date: string;
  batch_id: string;
  modules?: ModuleData[];
}

// ========== CREATE COURSE ==========
export const createCourse = async (req: Request, res: Response) => {
  try {
    const courseData: CourseData = req.body;

    const { title, logo, start_date, end_date, batch_id, modules } = courseData;
    if (!title || !start_date || !end_date || !batch_id) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const batch = await getSingleRecord(Batch, { where: { id: batch_id } });
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    const course = Course.create({
      title,
      logo,
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      batch,
    });

    await course.save();

    // Handle nested modules
    if (modules?.length) {
      course.modules = await Promise.all(
        modules.map(async (modData: ModuleData) => {
          const module = Module.create({
            title: modData.title,
            order: modData.order,
            isLocked: modData.isLocked,
            course,
          });
          await module.save();

          if (modData.days?.length) {
            module.days = await Promise.all(
              modData.days.map(async (dayData: DayData) => {
                const day = DayContent.create({
                  module,
                  dayNumber: dayData.dayNumber,
                  content: dayData.content,
                  completed: dayData.completed || false,
                });
                return day.save();
              }),
            );
          }

          return module;
        }),
      );
    }

    const saved = await createRecord(
      Course,
      course,
      `course_${course.id}`,
      10 * 60,
    );

    return res.status(201).json({
      message: "Course created successfully",
      course: saved,
    });
  } catch (error) {
    console.error("Create course error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ========== FETCH ONE COURSE ==========
export const fetchCourse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const course = await getSingleRecord(
      Course,
      {
        where: { id },
        relations: ["modules", "modules.days"],
      },
      `course_${id}`,
      true,
      10 * 60,
    );

    if (!course) return res.status(404).json({ message: "Course not found" });

    return res.status(200).json({
      message: "Course fetched successfully",
      course,
    });
  } catch (err) {
    console.error("Fetch course error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ========== FETCH ALL COURSES ==========
export const fetchAllCourses = async (_: Request, res: Response) => {
  try {
    const courses = await getAllRecords(Course, "all_courses", true, 10 * 60);
    return res.status(200).json({
      message: "Courses fetched successfully",
      courses,
    });
  } catch (err) {
    console.error("Fetch all courses error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ========== FETCH COURSES BY BATCH ==========
export const fetchAllCoursesinBatch = async (req: Request, res: Response) => {
  try {
    const { batch_id } = req.params;
    const batch = await getSingleRecord(Batch, { where: { id: batch_id } });

    if (!batch) return res.status(404).json({ message: "Batch not found" });

    const courses = await getAllRecords(Course, {
      where: { batch: { id: batch_id } },
      relations: ["modules"],
    });

    return res.status(200).json({
      message: "Courses in batch fetched successfully",
      courses,
    });
  } catch (err) {
    console.error("Fetch batch courses error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ========== UPDATE COURSE ==========
export const updateCourse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, logo, start_date, end_date, batch_id } = req.body;

    const updateData: Partial<Course> = {};
    if (title) updateData.title = title;
    if (logo) updateData.logo = logo;
    if (start_date) updateData.start_date = new Date(start_date);
    if (end_date) updateData.end_date = new Date(end_date);

    if (batch_id) {
      const batch = await getSingleRecord(Batch, { where: { id: batch_id } });
      if (!batch) return res.status(404).json({ message: "Batch not found" });
      updateData.batch = batch;
    }

    const result = await updateRecords(Course, { id }, updateData, false);
    if (!result || result.affected === 0)
      return res.status(404).json({ message: "Course not found" });

    const updated = await getSingleRecord(Course, { where: { id } });
    return res.status(200).json({ message: "Course updated", course: updated });
  } catch (err) {
    console.error("Update course error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ========== DELETE COURSE ==========
export const deleteCourse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await deleteRecords(Course, { id });
    if (!result || result.affected === 0)
      return res.status(404).json({ message: "Course not found" });

    return res.status(200).json({ message: "Course deleted successfully" });
  } catch (err) {
    console.error("Delete course error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
