import { Request, Response } from "express";
import { In } from "typeorm";
import { Course } from "../../db/mysqlModels/Course";
import { Batch } from "../../db/mysqlModels/Batch";
import { Module } from "../../db/mysqlModels/Module";
import { User } from "../../db/mysqlModels/User";
import { UserCourse } from "../../db/mysqlModels/UserCourse";
import { DayContent } from "../../db/mysqlModels/DayContent";
import { StudentCourseProgress } from "../../db/mysqlModels/StudentCourseProgress";
import { AppDataSource } from "../../db/connect";

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
      !batch_ids ||
      !Array.isArray(batch_ids) ||
      batch_ids.length === 0 ||
      is_public === undefined ||
      !instructor_name
    ) {
      // Get available batches for error message
      const allBatches = await getAllRecords(Batch, {});
      return res.status(400).json({ 
        message: "Missing required fields. batch_ids must be a non-empty array.",
        availableBatches: allBatches?.map(b => ({ id: b.id, name: b.name })) || []
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

    // Check if all batches exist
    console.log("=== BATCH VALIDATION ===");
    console.log("batch_ids received:", batch_ids);
    console.log("batch_ids type:", typeof batch_ids);
    console.log("batch_ids length:", batch_ids.length);
    
    // First, let's check if there are any batches at all
    const allBatches = await getAllRecords(Batch, {});
    console.log("Total batches in database:", allBatches?.length);
    console.log("All available batches:", allBatches?.map(b => ({ id: b.id, name: b.name })));
    
    // If no batches exist at all, create a default one
    if (!allBatches || allBatches.length === 0) {
      console.log("No batches found, creating default batch...");
      const defaultBatch = new Batch();
      defaultBatch.name = "Default Batch";
      defaultBatch.description = "Auto-created default batch for course creation";
      const savedBatch = await AppDataSource.manager.save(Batch, defaultBatch);
      console.log("Created default batch:", { id: savedBatch.id, name: savedBatch.name });
      
      // Update batch_ids to use the default batch
      batch_ids = [savedBatch.id];
      console.log("Updated batch_ids to:", batch_ids);
    }
    
    // Validate that batch_ids is not empty after potential default creation
    if (!batch_ids || batch_ids.length === 0) {
      return res.status(400).json({ 
        message: "No valid batch IDs provided",
        availableBatches: allBatches?.map(b => ({ id: b.id, name: b.name })) || []
      });
    }
    
    // Remove duplicates from batch_ids to avoid confusion
    const uniqueBatchIds = [...new Set(batch_ids)];
    console.log("Original batch_ids:", batch_ids);
    console.log("Unique batch_ids:", uniqueBatchIds);
    
    const batches = await getAllRecordsWithFilter(Batch, {
      where: { id: In(uniqueBatchIds) },
    });
    
    console.log("Found batches:", batches?.length);
    console.log("Found batch IDs:", batches?.map(b => b.id));
    console.log("Expected batch count:", uniqueBatchIds.length);
    
    // Fix validation logic - check if batches is null/undefined or if we found fewer batches than expected
    const foundBatchIds = batches?.map(b => b.id) || [];
    const actualFoundCount = foundBatchIds.length;
    
    console.log("Actual found count:", actualFoundCount);
    console.log("Expected count:", uniqueBatchIds.length);
    console.log("Batches is null/undefined:", !batches);
    
    if (!batches || actualFoundCount !== uniqueBatchIds.length) {
      const missingBatchIds = uniqueBatchIds.filter(id => !foundBatchIds.includes(id));
      console.log("Missing batch IDs:", missingBatchIds);
      console.log("Found batch IDs:", foundBatchIds);
      console.log("Detailed comparison:");
      uniqueBatchIds.forEach(id => {
        console.log(`  Requested: "${id}" (type: ${typeof id}) - Found: ${foundBatchIds.includes(id)}`);
      });
      foundBatchIds.forEach(id => {
        console.log(`  Database: "${id}" (type: ${typeof id})`);
      });
      
      // Only return error if there are actually missing batches
      if (missingBatchIds.length > 0) {
        return res.status(404).json({ 
          message: "Some batches not found", 
          missingBatchIds,
          requestedBatchIds: uniqueBatchIds,
          foundBatchIds: foundBatchIds,
          availableBatches: allBatches?.map(b => ({ id: b.id, name: b.name }))
        });
      }
      
      // If we reach here, batches is null but no batches are actually missing
      // This suggests an issue with the getAllRecords function
      console.log("WARNING: batches is null but no missing batch IDs found. This suggests a database issue.");
      return res.status(500).json({ 
        message: "Database error: Unable to fetch batches", 
        debug: {
          batchesIsNull: !batches,
          uniqueBatchIds,
          foundBatchIds,
          actualFoundCount
        }
      });
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
        course.batches = batches; // Assign multiple batches
        course.is_public = is_public;
        course.instructor_name = instructor_name;

        const savedCourse = await transactionalEntityManager.save(
          Course,
          course,
        );

        console.log("=== COURSE SAVE DEBUG ===");
        console.log("Saved course ID:", savedCourse.id);
        console.log("Assigned batches before save:", batches?.map(b => ({ id: b.id, name: b.name })));
        console.log("Saved course batches after save:", savedCourse.batches?.map(b => ({ id: b.id, name: b.name })));

        // Additional debugging: Try to reload the course with batches to see if they were saved
        const reloadedCourse = await transactionalEntityManager.findOne(Course, {
          where: { id: savedCourse.id },
          relations: ["batches"]
        });
        console.log("Reloaded course batches:", reloadedCourse?.batches?.map(b => ({ id: b.id, name: b.name })));

        // If batches weren't saved correctly, try manually setting the relation
        if (!savedCourse.batches || savedCourse.batches.length === 0) {
          console.log("Batches not properly saved, attempting manual assignment...");
          savedCourse.batches = batches;
          const resavedCourse = await transactionalEntityManager.save(Course, savedCourse);
          console.log("Re-saved course batches:", resavedCourse.batches?.map(b => ({ id: b.id, name: b.name })));
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
    console.log("Complete course batches:", completeCourse?.batches?.map(b => ({ id: b.id, name: b.name })));

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

// ========== FETCH ALL COURSES (Not batch specific) ==========
export const fetchAllCoursesAcrossBatches = async (req: Request, res: Response) => {
  try {
    // Get all courses with their batches
    const courses = await getAllRecordsWithFilter<Course, any>(Course, {
      relations: ["batches", "userCourses"]
    });
    
    // Process courses to include student count
    const processedCourses = courses.map(course => {
      return {
        ...course,
        studentCount: course.userCourses?.length || 0
      };
    });
    
    return res.json({ 
      message: "Courses fetched successfully",
      courses: processedCourses 
    });
  } catch (err) {
    console.error("Error fetching all courses:", err);
    return res.status(500).json({ message: "Internal server error" });
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
      relations: ["modules", "batches"]
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
      const batches = await Batch.find({
        where: { id: In(batch_ids) }
      });
      
      if (!batches || batches.length !== batch_ids.length) {
        const foundBatchIds = batches?.map(b => b.id) || [];
        const missingBatchIds = batch_ids.filter(id => !foundBatchIds.includes(id));
        return res.status(404).json({ 
          message: "Some batches not found", 
          missingBatchIds 
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
      relations: ["batches"]
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
    const result = await AppDataSource.transaction(async (transactionalEntityManager) => {
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
    });

    if (!result || result.affected === 0) {
      return res.status(404).json({ message: "Course not found or already deleted" });
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

// ========== GET COURSE ANALYTICS ==========
export const getCourseAnalytics = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    console.log("=== Getting analytics for course ID:", id);
    
    if (!id) {
      return res.status(400).json({ message: "Course ID is required" });
    }

    // Get the course basic info first using a simple query
    const { AppDataSource } = await import("../../db/connect");
    const connection = AppDataSource;

    if (!connection || !connection.isInitialized) {
      console.error("Database connection not available");
      return res.status(500).json({ message: "Database connection error" });
    }

    console.log("=== Database connection established");

    // Get course basic info
    const courseQuery = `
      SELECT id, title, instructor_name, start_date, end_date, is_public
      FROM course
      WHERE id = ?
    `;
    
    console.log("=== Executing courseQuery with courseId:", id);
    const courseResult = await connection.query(courseQuery, [id]);
    
    if (!courseResult || courseResult.length === 0) {
      console.log("=== Course not found for ID:", id);
      return res.status(404).json({ message: "Course not found" });
    }

    const course = courseResult[0];
    console.log("=== Course found:", course.title);

    // Get module count for this course
    const moduleCountQuery = `
      SELECT COUNT(*) as moduleCount
      FROM module
      WHERE courseId = ?
    `;
    
    console.log("=== Executing moduleCountQuery");
    const moduleCountResult = await connection.query(moduleCountQuery, [id]);
    const moduleCount = moduleCountResult[0]?.moduleCount || 0;
    console.log("=== Module count found:", moduleCount);

    // Get student count for this course
    const studentCountQuery = `
      SELECT COUNT(*) as studentCount
      FROM user_course uc
      JOIN user u ON uc.userId = u.id
      WHERE uc.courseId = ? AND u.userRole = 'student'
    `;
    
    console.log("=== Executing studentCountQuery");
    const studentCountResult = await connection.query(studentCountQuery, [id]);
    const totalStudents = studentCountResult[0]?.studentCount || 0;
    console.log("=== Student count found:", totalStudents);

    // Get batch count for this course
    const batchCountQuery = `
      SELECT COUNT(*) as batchCount
      FROM course_batch_assignments
      WHERE courseId = ?
    `;
    
    console.log("=== Executing batchCountQuery");
    const batchCountResult = await connection.query(batchCountQuery, [id]);
    const batchCount = batchCountResult[0]?.batchCount || 0;
    console.log("=== Batch count found:", batchCount);

    // Construct a simple analytics response
    const analytics = {
      courseId: course.id,
      courseTitle: course.title,
      instructorName: course.instructor_name || "Not assigned",
      isPublic: Boolean(course.is_public),
      startDate: course.start_date,
      endDate: course.end_date,
      totalStudents,
      moduleCount,
      batchCount,
      averageProgress: 0, // Default to 0 for now
      batchesProgress: [
        {
          batchId: "default",
          batchName: "All Students",
          studentCount: totalStudents,
          averageProgress: 0,
          students: []
        }
      ]
    };
    
    console.log("=== Analytics response:", JSON.stringify(analytics, null, 2));
    return res.json({ analytics });

  } catch (err: any) {
    console.error("=== Error getting course analytics - Full error:", err);
    console.error("=== Error stack:", err?.stack);
    console.error("=== Error message:", err?.message);
    
    return res.status(500).json({ 
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err?.message : "Analytics temporarily unavailable"
    });
  }
};
