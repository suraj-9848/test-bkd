import { Request, Response } from "express";
import { In, Like } from "typeorm";
import { Course } from "../../db/mysqlModels/Course";
import { Batch } from "../../db/mysqlModels/Batch";
import { Module } from "../../db/mysqlModels/Module";
import { User } from "../../db/mysqlModels/User";
import { UserCourse } from "../../db/mysqlModels/UserCourse";
import { DayContent } from "../../db/mysqlModels/DayContent";
import { StudentCourseProgress } from "../../db/mysqlModels/StudentCourseProgress";
import { AppDataSource } from "../../db/connect";
import s3Service from "../../utils/s3Service"

import {
  createRecord,
  getSingleRecord,
  getAllRecords,
  updateRecords,
  deleteRecords,
  getAllRecordsWithFilter,
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
  batch_ids: string[]; // Changed from batch_id to batch_ids
  is_public: boolean;
  instructor_name: string;
  modules?: ModuleData[];
}

// ========== CREATE COURSE ==========
export const createCourse = async (req: Request, res: Response) => {
  try {
    const courseData: CourseData = req.body;

    console.log("=== CREATE COURSE DEBUG ===");
    console.log("Received courseData:", JSON.stringify(courseData, null, 2));

    const {
      title,
      logo,
      start_date,
      end_date,
      is_public,
      instructor_name,
      modules,
    } = courseData;

    let { batch_ids } = courseData; // Make batch_ids mutable

    console.log("Extracted batch_ids:", batch_ids);
    console.log("batch_ids type:", typeof batch_ids);
    console.log("batch_ids length:", batch_ids?.length);

    // Validate required fields
    if (
      !title ||
      !start_date ||
      !end_date ||
      is_public === undefined ||
      !instructor_name ||
      (!is_public &&
        (!batch_ids || !Array.isArray(batch_ids) || batch_ids.length === 0))
    ) {
      // Get available batches for error message
      const allBatches = await getAllRecords(Batch, {});
      return res.status(400).json({
        message: is_public
          ? "Missing required fields. Public courses do not require batch_ids."
          : "Missing required fields. batch_ids must be a non-empty array.",
        availableBatches:
          allBatches?.map((b) => ({ id: b.id, name: b.name })) || [],
      });
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

    // If not public, validate batches as before
    let batches = [];
    if (!is_public) {
      // Check if all batches exist
      const allBatches = await getAllRecords(Batch, {});
      // If no batches exist at all, create a default one
      if (!allBatches || allBatches.length === 0) {
        const defaultBatch = new Batch();
        defaultBatch.name = "Default Batch";
        defaultBatch.description =
          "Auto-created default batch for course creation";
        const savedBatch = await AppDataSource.manager.save(
          Batch,
          defaultBatch,
        );
        batch_ids = [savedBatch.id];
      }
      // Validate that batch_ids is not empty after potential default creation
      if (!batch_ids || batch_ids.length === 0) {
        return res.status(400).json({
          message: "No valid batch IDs provided",
          availableBatches:
            allBatches?.map((b) => ({ id: b.id, name: b.name })) || [],
        });
      }
      // Remove duplicates from batch_ids
      const uniqueBatchIds = [...new Set(batch_ids)];
      batches = await getAllRecordsWithFilter(Batch, {
        where: { id: In(uniqueBatchIds) },
      });
      const foundBatchIds = batches?.map((b) => b.id) || [];
      if (!batches || foundBatchIds.length !== uniqueBatchIds.length) {
        const missingBatchIds = uniqueBatchIds.filter(
          (id) => !foundBatchIds.includes(id),
        );
        return res.status(404).json({
          message: "Some batches not found",
          missingBatchIds,
          requestedBatchIds: uniqueBatchIds,
          foundBatchIds: foundBatchIds,
          availableBatches: allBatches?.map((b) => ({
            id: b.id,
            name: b.name,
          })),
        });
      }
    }

    // Use transaction to ensure data consistency
    const result = await AppDataSource.transaction(
      async (transactionalEntityManager) => {
        // Create course first
        const course = new Course();
        course.title = title;
        course.logo = logo || null;
        course.start_date = startDate;
        course.end_date = endDate;
        course.batches = !is_public ? batches : [];
        course.is_public = is_public;
        course.instructor_name = instructor_name;

        const savedCourse = await transactionalEntityManager.save(
          Course,
          course,
        );

        console.log("=== COURSE SAVE DEBUG ===");
        console.log("Saved course ID:", savedCourse.id);
        console.log(
          "Assigned batches before save:",
          batches?.map((b) => ({ id: b.id, name: b.name })),
        );
        console.log(
          "Saved course batches after save:",
          savedCourse.batches?.map((b) => ({ id: b.id, name: b.name })),
        );

        // Additional debugging: Try to reload the course with batches to see if they were saved
        const reloadedCourse = await transactionalEntityManager.findOne(
          Course,
          {
            where: { id: savedCourse.id },
            relations: ["batches"],
          },
        );
        console.log(
          "Reloaded course batches:",
          reloadedCourse?.batches?.map((b) => ({ id: b.id, name: b.name })),
        );

        // If batches weren't saved correctly, try manually setting the relation
        if (!savedCourse.batches || savedCourse.batches.length === 0) {
          console.log(
            "Batches not properly saved, attempting manual assignment...",
          );
          savedCourse.batches = batches;
          const resavedCourse = await transactionalEntityManager.save(
            Course,
            savedCourse,
          );
          console.log(
            "Re-saved course batches:",
            resavedCourse.batches?.map((b) => ({ id: b.id, name: b.name })),
          );
        }

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
        relations: ["modules", "modules.days", "batches"],
      },
      `course_${result.id}`,
      false,
      10 * 60,
    );

    console.log("=== FINAL COURSE DEBUG ===");
    console.log("Complete course ID:", completeCourse?.id);
    console.log(
      "Complete course batches:",
      completeCourse?.batches?.map((b) => ({ id: b.id, name: b.name })),
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
        relations: ["modules", "modules.days", "batches"],
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

// ========== GET ALL COURSES ==========
export const getAllCourses = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    const offset = (pageNumber - 1) * limitNumber;

    let whereCondition: any = {};
    if (search) {
      whereCondition = {
        title: Like(`%${search}%`),
      };
    }

    // Use utility function with caching for courses
    const courses = await getAllRecordsWithFilter(Course, {
      where: whereCondition,
      relations: ["batches"],
      order: { title: "ASC" },
      skip: offset,
      take: limitNumber,
    }, `courses:page:${pageNumber}:limit:${limitNumber}:search:${search}`, true, 10 * 60); // Cache for 10 minutes

    // Get total count for pagination using utility function
    const totalCourses = await getAllRecordsWithFilter(Course, {
      where: whereCondition,
    }, `courses:count:search:${search}`, true, 15 * 60); // Cache for 15 minutes

    const totalCount = totalCourses.length;
    const totalPages = Math.ceil(totalCount / limitNumber);

    return res.status(200).json({
      message: "Courses retrieved successfully",
      data: {
        courses,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalCount,
          hasNextPage: pageNumber < totalPages,
          hasPrevPage: pageNumber > 1,
        },
      },
    });
  } catch (err) {
    console.error("Get all courses error:", err);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// ========== FETCH COURSES BY BATCH ==========
export const fetchAllCoursesinBatch = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      return res.status(400).json({ message: "Batch ID is required" });
    }

    const batch = await getSingleRecord(Batch, { where: { id: batchId } });
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    const courses = await getAllRecordsWithFilter(Course, {
      where: { batches: { id: batchId } },
      relations: ["modules", "batches"],
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

// ========== FETCH ALL COURSES FOR INSTRUCTOR ==========
export const fetchAllCoursesForInstructor = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Fetch all courses - for instructors, we can show all courses or filter by instructor
    // For now, let's fetch all courses with their relations
    const courses = await getAllRecordsWithFilter(Course, {
      relations: ["modules", "batches"],
      order: { title: "ASC" },
    }, `instructor:courses:${user.id}`, true, 10 * 60); // Cache for 10 minutes

    return res.status(200).json({
      message: "Courses fetched successfully",
      courses,
    });
  } catch (err) {
    console.error("Fetch instructor courses error:", err);
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
      batch_ids,
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

    if (batch_ids && Array.isArray(batch_ids) && batch_ids.length > 0) {
      // Use utility function with caching for batches
      const batches = await getAllRecordsWithFilter(Batch, {
        where: { id: In(batch_ids) },
      }, `batches:ids:${batch_ids.join(',')}`, true, 20 * 60); // Cache for 20 minutes

      if (!batches || batches.length !== batch_ids.length) {
        const foundBatchIds = batches?.map((b) => b.id) || [];
        const missingBatchIds = batch_ids.filter(
          (id) => !foundBatchIds.includes(id),
        );
        return res.status(404).json({
          message: "Some batches not found",
          missingBatchIds,
        });
      }
      updateData.batches = batches;
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

    console.log("Updating course with data:", { id, updateData });

    // Find the course first
    const course = await Course.findOne({
      where: { id },
      relations: ["batches"],
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Update basic fields
    if (title) course.title = title;
    if (logo !== undefined) course.logo = logo;
    if (updateData.start_date) course.start_date = updateData.start_date;
    if (updateData.end_date) course.end_date = updateData.end_date;
    if (is_public !== undefined) course.is_public = is_public;
    if (instructor_name) course.instructor_name = instructor_name;

    // Update batches relationship if provided
    if (updateData.batches) {
      course.batches = updateData.batches;
    }

    // Save the updated course
    const savedCourse = await course.save();

    // Fetch the updated course with relations
    const updated = await Course.findOne({
      where: { id },
      relations: ["batches"],
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

    console.log("=== DELETE COURSE DEBUG ===");
    console.log("Deleting course:", id, course.title);

    // Use transaction to ensure all related data is deleted properly
    const result = await AppDataSource.transaction(
      async (transactionalEntityManager) => {
        // Delete in the correct order to avoid foreign key constraint issues

        // 1. Delete course-batch assignments (junction table)
        await transactionalEntityManager
          .createQueryBuilder()
          .delete()
          .from("course_batch_assignments")
          .where("courseId = :courseId", { courseId: id })
          .execute();

        console.log("Deleted course-batch assignments");

        // 2. Delete user course enrollments
        await transactionalEntityManager
          .createQueryBuilder()
          .delete()
          .from("user_course")
          .where("courseId = :courseId", { courseId: id })
          .execute();

        console.log("Deleted user course enrollments");

        // 3. Delete modules and their related data (modules should cascade to day_content)
        await transactionalEntityManager
          .createQueryBuilder()
          .delete()
          .from("module")
          .where("courseId = :courseId", { courseId: id })
          .execute();

        console.log("Deleted modules");

        // 4. Delete tests related to this course (if any)
        await transactionalEntityManager
          .createQueryBuilder()
          .delete()
          .from("test")
          .where("courseId = :courseId", { courseId: id })
          .execute();

        console.log("Deleted tests");

        // 5. Finally delete the course itself
        const deleteResult = await transactionalEntityManager
          .createQueryBuilder()
          .delete()
          .from("course")
          .where("id = :id", { id })
          .execute();

        console.log("Deleted course, affected rows:", deleteResult.affected);

        return deleteResult;
      },
    );

    if (!result || result.affected === 0) {
      return res
        .status(404)
        .json({ message: "Course not found or already deleted" });
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


export const uploadCourseLogo = async (req: Request, res: Response) => {
  try {
     console.log("Received file:", req.file);
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const fileBuffer = req.file.buffer;
    const originalName = req.file.originalname;
    const contentType = req.file.mimetype;
    const fileName = s3Service.generateUniqueFileName(originalName, "course-logo");
    const logoUrl = await s3Service.uploadFile(fileBuffer, fileName, contentType, "course-logos");
    return res.status(201).json({ logoUrl });
  } catch (error) {
    console.error("Logo upload failed:", error);
    return res.status(500).json({ error: "Logo upload failed" });
  }
};