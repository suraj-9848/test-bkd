import { Request, Response } from "express";
import { Course } from "../../db/mysqlModels/Course";
import { Batch } from "../../db/mysqlModels/Batch";
import { Module } from "../../db/mysqlModels/Module";
import { User } from "../../db/mysqlModels/User";
import { UserCourse } from "../../db/mysqlModels/UserCourse";
import { DayContent } from "../../db/mysqlModels/DayContent";
import { getManager } from "typeorm"; // Add this import for transaction

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
  title?: string; // Add title field as it exists in DayContent model
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
  is_public: boolean;
  instructor_name: string;
  modules?: ModuleData[];
}

// ========== CREATE COURSE ==========
export const createCourse = async (req: Request, res: Response) => {
  try {
    const courseData: CourseData = req.body;

    const {
      title,
      logo,
      start_date,
      end_date,
      batch_id,
      is_public,
      instructor_name,
      modules,
    } = courseData;

    // Validate required fields
    if (
      !title ||
      !start_date ||
      !end_date ||
      !batch_id ||
      is_public === undefined ||
      !instructor_name
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate dates
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    if (startDate >= endDate) {
      return res
        .status(400)
        .json({ message: "End date must be after start date" });
    }

    // Check if batch exists
    const batch = await getSingleRecord(Batch, { where: { id: batch_id } });
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    // Use transaction to ensure data consistency
    const result = await getManager().transaction(
      async (transactionalEntityManager) => {
        // Create course first
        const course = new Course();
        course.title = title;
        course.logo = logo || null;
        course.start_date = startDate;
        course.end_date = endDate;
        course.batch = batch;
        course.is_public = is_public;
        course.instructor_name = instructor_name;

        const savedCourse = await transactionalEntityManager.save(
          Course,
          course,
        );

        // Create modules if provided
        if (modules && modules.length > 0) {
          const savedModules = [];

          for (const modData of modules) {
            // Validate module data
            if (!modData.title || typeof modData.order !== "number") {
              throw new Error(
                `Invalid module data: title and order are required`,
              );
            }

            // Create module
            const module = new Module();
            module.title = modData.title;
            module.order = modData.order;
            module.isLocked =
              modData.isLocked !== undefined
                ? modData.isLocked
                : modData.order !== 1;
            module.course = savedCourse;

            const savedModule = await transactionalEntityManager.save(
              Module,
              module,
            );

            // Create day contents if provided
            if (modData.days && modData.days.length > 0) {
              const savedDays = [];

              for (const dayData of modData.days) {
                // Validate day data
                if (typeof dayData.dayNumber !== "number" || !dayData.content) {
                  throw new Error(
                    `Invalid day data: dayNumber and content are required`,
                  );
                }

                const day = new DayContent();
                day.module = savedModule;
                day.dayNumber = dayData.dayNumber;
                day.title = dayData.title || `Day ${dayData.dayNumber}`;
                day.content = dayData.content;
                day.completed = dayData.completed || false;

                const savedDay = await transactionalEntityManager.save(
                  DayContent,
                  day,
                );
                savedDays.push(savedDay);
              }

              savedModule.days = savedDays;
            }

            savedModules.push(savedModule);
          }

          savedCourse.modules = savedModules;
        }

        return savedCourse;
      },
    );

    // Fetch the complete course with relations for response
    const completeCourse = await getSingleRecord(
      Course,
      {
        where: { id: result.id },
        relations: ["modules", "modules.days", "batch"],
      },
      `course_${result.id}`,
      false,
      10 * 60,
    );

    return res.status(201).json({
      message: "Course created successfully",
      course: completeCourse,
    });
  } catch (error) {
    console.error("Create course error:", error);

    // Provide more specific error messages
    if (error.message.includes("Invalid")) {
      return res.status(400).json({
        message: "Validation error",
        details: error.message,
      });
    }

    return res.status(500).json({
      message: "Internal server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ========== FETCH ONE COURSE ==========
export const fetchCourse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Course ID is required" });
    }

    const course = await getSingleRecord(
      Course,
      {
        where: { id },
        relations: ["modules", "modules.days", "batch"],
        order: {
          modules: {
            order: "ASC",
            days: {
              dayNumber: "ASC",
            },
          },
        },
      },
      `course_${id}`,
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
    console.error("Fetch course error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ========== FETCH ALL COURSES ==========
export const fetchAllCourses = async (_: Request, res: Response) => {
  try {
    const courses = await getAllRecords(Course, {
      relations: ["batch"],
      order: { createdAt: "DESC" },
    });

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
    const { batchId } = req.params; // Changed from batch_id to batchId

    if (!batchId) {
      return res.status(400).json({ message: "Batch ID is required" });
    }

    const batch = await getSingleRecord(Batch, { where: { id: batchId } }); // Changed batch_id to batchId
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    const courses = await getAllRecords(Course, {
      where: { batch: { id: batchId } }, // Changed batch_id to batchId
      relations: ["modules", "batch"],
      order: { createdAt: "DESC" },
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
    const {
      title,
      logo,
      start_date,
      end_date,
      batch_id,
      is_public,
      instructor_name,
    } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Course ID is required" });
    }

    const updateData: Partial<Course> = {};

    if (title) updateData.title = title;
    if (logo !== undefined) updateData.logo = logo;
    if (start_date) {
      const startDate = new Date(start_date);
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({ message: "Invalid start date format" });
      }
      updateData.start_date = startDate;
    }
    if (end_date) {
      const endDate = new Date(end_date);
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({ message: "Invalid end date format" });
      }
      updateData.end_date = endDate;
    }
    if (is_public !== undefined) updateData.is_public = is_public;
    if (instructor_name) updateData.instructor_name = instructor_name;

    if (batch_id) {
      const batch = await getSingleRecord(Batch, { where: { id: batch_id } });
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }
      updateData.batch = batch;
    }

    // Validate date combination if both are provided
    if (
      updateData.start_date &&
      updateData.end_date &&
      updateData.start_date >= updateData.end_date
    ) {
      return res
        .status(400)
        .json({ message: "End date must be after start date" });
    }

    const result = await updateRecords(Course, { id }, updateData, false);
    if (!result || result.affected === 0) {
      return res.status(404).json({ message: "Course not found" });
    }

    const updated = await getSingleRecord(Course, {
      where: { id },
      relations: ["batch"],
    });

    return res.status(200).json({
      message: "Course updated successfully",
      course: updated,
    });
  } catch (err) {
    console.error("Update course error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ========== DELETE COURSE ==========
export const deleteCourse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Course ID is required" });
    }

    // Check if course exists first
    const course = await getSingleRecord(Course, { where: { id } });
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const result = await deleteRecords(Course, { id });
    if (!result || result.affected === 0) {
      return res.status(404).json({ message: "Course not found" });
    }

    return res.status(200).json({ message: "Course deleted successfully" });
  } catch (err) {
    console.error("Delete course error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ========== ASSIGNING COURSE TO STUDENT =========
export const assignCourseToStudent = async (req: Request, res: Response) => {
  try {
    const { userId, courseId } = req.body;

    // Validate input
    if (!userId || !courseId) {
      return res.status(400).json({
        message: "userId and courseId are required",
      });
    }

    // Fetch user and course
    const [user, course] = await Promise.all([
      getSingleRecord(User, { where: { id: userId } }),
      getSingleRecord(Course, { where: { id: courseId } }),
    ]);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Check for existing assignment
    const existingAssignment = await UserCourse.findOne({
      where: { user: { id: userId }, course: { id: courseId } },
      relations: ["user", "course"],
    });

    if (existingAssignment) {
      return res.status(400).json({
        message: "Course already assigned to this student",
        assignment: existingAssignment,
      });
    }

    // Create and save new assignment
    const userCourse = UserCourse.create({
      user,
      course,
      completed: false,
      assignedAt: new Date(),
    });

    await userCourse.save();

    // Fetch the created assignment with relations
    const createdAssignment = await UserCourse.findOne({
      where: { id: userCourse.id },
      relations: ["user", "course"],
    });

    return res.status(201).json({
      message: "Course assigned to student successfully",
      assignment: createdAssignment,
    });
  } catch (err) {
    console.error("Assign course error:", err);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
