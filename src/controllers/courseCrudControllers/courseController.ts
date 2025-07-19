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

    const {
      title,
      logo,
      start_date,
      end_date,
      batch_ids,
      is_public,
      instructor_name,
      modules,
    } = courseData;

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
      return res.status(400).json({ message: "Missing required fields. batch_ids must be a non-empty array." });
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
    const batches = await getAllRecords(Batch, {
      where: batch_ids.map(id => ({ id })),
    });
    
    if (!batches || batches.length !== batch_ids.length) {
      const foundBatchIds = batches?.map(b => b.id) || [];
      const missingBatchIds = batch_ids.filter(id => !foundBatchIds.includes(id));
      return res.status(404).json({ 
        message: "Some batches not found", 
        missingBatchIds 
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
    const courses = await getAllRecords<Course>(Course, {
      relations: ["batches", "userCourses"],
      order: { createdAt: "DESC" }
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

    const courses = await getAllRecords(Course, {
      where: { batches: { id: batchId } },
      relations: ["modules", "batches"],
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

// ========== GET COURSE ANALYTICS ==========
export const getCourseAnalytics = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Get the course with its basic info
    const course = await getSingleRecord<Course, any>(
      Course,
      { 
        where: { id },
        relations: ["modules"]
      },
      `course_${id}`,
      true,
      60
    );

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Use raw SQL to get students assigned to this course
    const { AppDataSource } = await import("../../db/connect");
    const connection = AppDataSource;

    // Get all students directly assigned to this course via user_course table
    const courseStudentsQuery = `
      SELECT uc.userId, u.username, u.email, uc.completed, uc.assignedAt
      FROM user_course uc
      JOIN user u ON uc.userId = u.id
      WHERE uc.courseId = ? AND u.userRole = 'student'
    `;
    const courseStudents = await connection.query(courseStudentsQuery, [id]);

    // Get batches assigned to this course
    const courseBatchesQuery = `
      SELECT cba.batchId, b.name as batchName
      FROM course_batch_assignments cba
      JOIN batch b ON cba.batchId = b.id
      WHERE cba.courseId = ?
    `;
    const courseBatches = await connection.query(courseBatchesQuery, [id]);

    // Get course progress data for these students
    const studentIds = courseStudents.map((s: any) => s.userId);
    let progressData = [];
    
    if (studentIds.length > 0) {
      const progressQuery = `
        SELECT student_id, current_page, status, updated_at
        FROM student_course_progress
        WHERE student_id IN (${studentIds.map(() => '?').join(',')}) AND session_id = ?
      `;
      progressData = await connection.query(progressQuery, [...studentIds, id]);
    }

    // Calculate total pages/modules
    const totalPages = course.modules?.reduce((sum, module) => {
      return sum + (module.days?.length || 0);
    }, 0) || 0;

    // Map students to their progress
    const studentsWithProgress = courseStudents.map((student: any) => {
      const progressRecord = progressData.find(
        (p: any) => p.student_id === student.userId
      );
      
      return {
        studentId: student.userId,
        username: student.username,
        email: student.email,
        currentPage: progressRecord?.current_page || 0,
        totalPages,
        progressPercentage: totalPages > 0 
          ? Math.round(((progressRecord?.current_page || 0) / totalPages) * 100) 
          : 0,
        status: progressRecord?.status || "not-started"
      };
    });

    // Create batch breakdown
    const batchesProgress = courseBatches.map((batch: any) => {
      // For now, distribute students evenly across batches
      // In a real scenario, you'd have proper student-batch relationships
      const batchStudentCount = Math.floor(courseStudents.length / courseBatches.length) || courseStudents.length;
      
      return {
        batchId: batch.batchId,
        batchName: batch.batchName,
        studentCount: batchStudentCount,
        averageProgress: studentsWithProgress.length > 0
          ? Math.round(
              studentsWithProgress.reduce((sum, s) => sum + s.progressPercentage, 0) / 
              studentsWithProgress.length
            )
          : 0,
        students: studentsWithProgress
      };
    });

    // If no batches, create a default entry
    if (batchesProgress.length === 0) {
      batchesProgress.push({
        batchId: "default",
        batchName: "All Students",
        studentCount: courseStudents.length,
        averageProgress: studentsWithProgress.length > 0
          ? Math.round(
              studentsWithProgress.reduce((sum, s) => sum + s.progressPercentage, 0) / 
              studentsWithProgress.length
            )
          : 0,
        students: studentsWithProgress
      });
    }

    // Calculate overall metrics
    const totalStudents = courseStudents.length;
    const moduleCount = course.modules?.length || 0;
    const averageProgress = studentsWithProgress.length > 0
      ? Math.round(
          studentsWithProgress.reduce((sum, s) => sum + s.progressPercentage, 0) / 
          studentsWithProgress.length
        )
      : 0;

    // Construct analytics response
    const analytics = {
      courseId: course.id,
      courseTitle: course.title,
      isPublic: course.is_public,
      startDate: course.start_date,
      endDate: course.end_date,
      totalStudents,
      moduleCount,
      averageProgress,
      batchesProgress
    };
    
    return res.json({ analytics });
  } catch (err) {
    console.error("Error getting course analytics:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
