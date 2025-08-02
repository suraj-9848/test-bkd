import { Request, Response } from "express";
import { In, Like } from "typeorm";
import { Course } from "../../db/mysqlModels/Course";
import { Batch } from "../../db/mysqlModels/Batch";
import { Module } from "../../db/mysqlModels/Module";
import { User } from "../../db/mysqlModels/User";
import { UserCourse } from "../../db/mysqlModels/UserCourse";
import { DayContent } from "../../db/mysqlModels/DayContent";
import { AppDataSource } from "../../db/connect";
import s3Service from "../../utils/s3Service";

const logger = getLoggerByName("Course Controller");

// Helper function for image upload
async function uploadImage(
  file: Express.Multer.File | undefined,
  type: "course-logo" | "trainer-logo",
  folder: string,
): Promise<string> {
  if (!file) return "";
  return await s3Service.uploadFile(
    file.buffer,
    s3Service.generateUniqueFileName(file.originalname, type),
    file.mimetype,
    folder,
  );
}

import {
  getSingleRecord,
  getAllRecordsWithFilter,
} from "../../lib/dbLib/sqlUtils";
import { getLoggerByName } from "../../utils/logger";

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
  overview?: string;
  trainer_name?: string;
  trainer_bio?: string;
  trainer_avatar?: string;
  trainer_linkedin?: string;
  price?: number;
  duration?: string;
  image?: string;
  features?: string[];
  curriculum?: string[];
  prerequisites?: string[];
  tags?: string[];
  mode?: string;
  what_you_will_learn?: string[];
}

// ========== CREATE COURSE ==========
export const createCourse = async (req: Request, res: Response) => {
  try {
    const {
      title,
      start_date,
      end_date,
      batch_ids,
      is_public,
      instructor_name,
      modules = [],
      overview,
      trainer_name,
      trainer_bio,
      trainer_linkedin,
      price = 0,
      duration = "0",
      // image, // removed unused variable
      features,
      curriculum,
      prerequisites,
      tags,
      mode = "online",
      what_you_will_learn,
    }: CourseData = req.body;

    let logo = "";
    let trainer_avatar = "";
    if (
      req.files &&
      typeof req.files === "object" &&
      !Array.isArray(req.files)
    ) {
      const filesObj = req.files as {
        [fieldname: string]: Express.Multer.File[];
      };
      logo = await uploadImage(
        filesObj.logo?.[0],
        "course-logo",
        "course-logos",
      );
      trainer_avatar = await uploadImage(
        filesObj.trainer_avatar?.[0],
        "trainer-logo",
        "trainer-logos",
      );
      if (logo) {
        logger.info("✅ S3 image uploaded for course logo:", logo);
      } else {
        logger.info("⚠️ S3 image upload failed for course logo.");
      }
      if (trainer_avatar) {
        logger.info("✅ S3 image uploaded for trainer avatar:", trainer_avatar);
      } else {
        logger.info("⚠️ S3 image upload failed for trainer avatar.");
      }
    } else if (req.file) {
      if (req.file.fieldname === "logo") {
        logo = await uploadImage(req.file, "course-logo", "course-logos");
        if (logo) {
          logger.info("✅ S3 image uploaded for course logo:", logo);
        } else {
          logger.info("⚠️ S3 image upload failed for course logo.");
        }
      } else if (req.file.fieldname === "trainer_avatar") {
        trainer_avatar = await uploadImage(
          req.file,
          "trainer-logo",
          "trainer-logos",
        );
        if (trainer_avatar) {
          logger.info(
            "✅ S3 image uploaded for trainer avatar:",
            trainer_avatar,
          );
        } else {
          logger.info("⚠️ S3 image upload failed for trainer avatar.");
        }
      }
    }
    if (!logo) logo = req.body.logo || "";
    if (!trainer_avatar) trainer_avatar = req.body.trainer_avatar || "";

    console.log("Course logo:", logo);
    console.log("Trainer avatar:", trainer_avatar);

    const safeFeatures = Array.isArray(features) ? features : [];
    const safeCurriculum = Array.isArray(curriculum) ? curriculum : [];
    const safePrerequisites = Array.isArray(prerequisites) ? prerequisites : [];
    const safeTags = Array.isArray(tags) ? tags : [];
    const safeWhatYouWillLearn = Array.isArray(what_you_will_learn)
      ? what_you_will_learn
      : [];

    // Validate required fields
    if (!title || !start_date || !end_date || !instructor_name) {
      return res.status(400).json({
        message:
          "Title, start date, end date, and instructor name are required",
      });
    }

    // Validate date combination
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

    // Validate batch IDs if provided
    let batches: Batch[] | undefined;
    if (batch_ids && Array.isArray(batch_ids) && batch_ids.length > 0) {
      batches = await getAllRecordsWithFilter(
        Batch,
        { where: { id: In(batch_ids) } },
        `batches:ids:${batch_ids.join(",")}`,
        true,
        20 * 60, // Cache for 20 minutes
      );
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
    }

    // Create course instance
    const course = Course.create({
      title,
      logo,
      start_date: startDate,
      end_date: endDate,
      is_public,
      instructor_name,
      overview,
      trainer_name,
      trainer_bio,
      trainer_avatar,
      trainer_linkedin,
      price,
      duration,
      features: safeFeatures,
      curriculum: safeCurriculum,
      prerequisites: safePrerequisites,
      tags: safeTags,
      mode,
      what_you_will_learn: safeWhatYouWillLearn,
    });

    // Save course
    await course.save();

    // Assign course to batches
    if (batches && batches.length > 0) {
      await Promise.all(
        batches.map(async (batch) => {
          if (!Array.isArray(batch.courses)) {
            batch.courses = [];
          }
          batch.courses.push(course);
          await batch.save();
        }),
      );
    }
    console.log("Course created successfully:", course.id);
    // Handle modules and days
    if (modules && modules.length > 0) {
      for (const moduleData of modules) {
        const module = Module.create({
          title: moduleData.title,
          order: moduleData.order,
          isLocked: moduleData.isLocked,
          course,
        });

        // Save module
        await module.save();

        // Handle days in the module
        if (moduleData.days && moduleData.days.length > 0) {
          for (const dayData of moduleData.days) {
            const day = DayContent.create({
              dayNumber: dayData.dayNumber,
              content: dayData.content,
              completed: dayData.completed || false,
              title: dayData.title, // Include title if provided
              module,
            });
            await day.save();
          }
        }
      }
    }

    return res
      .status(201)
      .json({ message: "Course created successfully", course });
  } catch (error) {
    console.error("Error creating course:", error);
    return res.status(500).json({ message: "Error creating course" });
  }
};

// ========== FETCH ONE COURSE ==========
export const fetchCourse = async (req: Request, res: Response) => {
  try {
    console.log("📚 [FETCH COURSE] Fetching individual course");
    console.log("🔍 [FETCH COURSE] Request params:", req.params);
    console.log("🔍 [FETCH COURSE] Request URL:", req.originalUrl);

    // Handle both 'id' and 'courseId' parameter names for compatibility
    const courseId = req.params.courseId || req.params.id;

    if (!courseId) {
      console.log(" [FETCH COURSE] No course ID provided");
      return res.status(400).json({ message: "Course ID is required" });
    }

    console.log("🔍 [FETCH COURSE] Looking for course ID:", courseId);

    // Only allow students to fetch if they are enrolled

    const course = await getSingleRecord(
      Course,
      {
        where: { id: courseId },
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
      `course_${courseId}`,
      true,
      10 * 60,
    );

    if (!course) {
      console.log(" [FETCH COURSE] Course not found with ID:", courseId);
      return res.status(404).json({ message: "Course not found" });
    }

    console.log(" [FETCH COURSE] Course found:", {
      id: course.id,
      title: course.title,
      modulesCount: course.modules?.length || 0,
    });

    return res.status(200).json({
      message: "Course fetched successfully",
      course,
    });
  } catch (err) {
    console.error(" [FETCH COURSE] Fetch course error:", err);
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

    const whereCondition: Record<string, unknown> = {};
    if (search) {
      whereCondition.title = Like(`%${search}%`);
    }

    // Only allow students to see their enrolled courses
    const user = req.user;
    let courses = [];
    let totalCourses = [];
    if (user && user.userRole === "student") {
      // Get all UserCourse assignments for this student
      const assignments = await UserCourse.find({
        where: { user: { id: user.id } },
        relations: ["course"],
      });
      const courseIds = assignments.map((a) => a.course.id);
      if (courseIds.length === 0) {
        return res.status(200).json({
          message: "Courses retrieved successfully",
          data: {
            courses: [],
            pagination: {
              currentPage: pageNumber,
              totalPages: 0,
              totalCount: 0,
              hasNextPage: false,
              hasPrevPage: false,
            },
          },
        });
      }
      whereCondition.id = In(courseIds);
      courses = await getAllRecordsWithFilter(
        Course,
        {
          where: whereCondition,
          relations: ["batches"],
          order: { title: "ASC" },
          skip: offset,
          take: limitNumber,
        },
        `student:${user.id}:courses:page:${pageNumber}:limit:${limitNumber}:search:${search}`,
        true,
        10 * 60,
      );
      totalCourses = await getAllRecordsWithFilter(
        Course,
        {
          where: {
            id: In(courseIds),
            ...(search ? { title: Like(`%${search}%`) } : {}),
          },
        },
        `student:${user.id}:courses:count:search:${search}`,
        true,
        15 * 60,
      );
    } else {
      // Admins/instructors see all courses
      courses = await getAllRecordsWithFilter(
        Course,
        {
          where: whereCondition,
          relations: ["batches"],
          order: { title: "ASC" },
          skip: offset,
          take: limitNumber,
        },
        `courses:page:${pageNumber}:limit:${limitNumber}:search:${search}`,
        true,
        10 * 60,
      );
      totalCourses = await getAllRecordsWithFilter(
        Course,
        {
          where: whereCondition,
        },
        `courses:count:search:${search}`,
        true,
        15 * 60,
      );
    }

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
export const fetchAllCoursesForInstructor = async (
  req: Request,
  res: Response,
) => {
  try {
    console.log("📚 [INSTRUCTOR COURSES] Fetching all courses for instructor");
    const user = req.user;
    if (!user) {
      console.log(" [INSTRUCTOR COURSES] User not authenticated");
      return res.status(401).json({ message: "User not authenticated" });
    }

    console.log("👨‍🏫 [INSTRUCTOR COURSES] User:", {
      id: user.id,
      username: user.username,
      role: user.userRole,
    });

    // Fetch all courses - for instructors, we can show all courses or filter by instructor
    // For now, let's fetch all courses with their relations
    const courses = await getAllRecordsWithFilter(
      Course,
      {
        relations: ["modules", "batches"],
        order: { title: "ASC" },
      },
      `instructor:courses:${user.id}`,
      true,
      10 * 60,
    ); // Cache for 10 minutes

    console.log(" [INSTRUCTOR COURSES] Fetched courses count:", courses.length);
    console.log(
      "📋 [INSTRUCTOR COURSES] Course titles:",
      courses.map((c) => c.title),
    );

    return res.status(200).json({
      message: "Courses fetched successfully",
      courses,
    });
  } catch (err) {
    console.error(" [INSTRUCTOR COURSES] Fetch instructor courses error:", err);
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
      const batches = await getAllRecordsWithFilter(
        Batch,
        {
          where: { id: In(batch_ids) },
        },
        `batches:ids:${batch_ids.join(",")}`,
        true,
        20 * 60,
      ); // Cache for 20 minutes

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
    await course.save();

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
    const { courseId, id } = req.params;
    const courseIdToDelete = courseId || id; // Support both parameter names

    if (!courseIdToDelete) {
      return res.status(400).json({ message: "Course ID is required" });
    }

    // Check if course exists first
    const course = await getSingleRecord(Course, {
      where: { id: courseIdToDelete },
    });
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    console.log("=== DELETE COURSE DEBUG ===");
    console.log("Deleting course:", courseIdToDelete, course.title);

    // Use transaction to ensure all related data is deleted properly
    const result = await AppDataSource.transaction(
      async (transactionalEntityManager) => {
        // Delete in the correct order to avoid foreign key constraint issues

        // 1. Delete course-batch assignments (junction table)
        await transactionalEntityManager
          .createQueryBuilder()
          .delete()
          .from("course_batch_assignments")
          .where("courseId = :courseId", { courseId: courseIdToDelete })
          .execute();

        console.log("Deleted course-batch assignments");

        // 2. Delete user course enrollments
        await transactionalEntityManager
          .createQueryBuilder()
          .delete()
          .from("user_course")
          .where("courseId = :courseId", { courseId: courseIdToDelete })
          .execute();

        console.log("Deleted user course enrollments");

        // 3. Delete modules and their related data (modules should cascade to day_content)
        await transactionalEntityManager
          .createQueryBuilder()
          .delete()
          .from("module")
          .where("courseId = :courseId", { courseId: courseIdToDelete })
          .execute();

        console.log("Deleted modules");

        // 4. Delete tests related to this course (if any)
        await transactionalEntityManager
          .createQueryBuilder()
          .delete()
          .from("test")
          .where("courseId = :courseId", { courseId: courseIdToDelete })
          .execute();

        console.log("Deleted tests");

        // 5. Finally delete the course itself
        const deleteResult = await transactionalEntityManager
          .createQueryBuilder()
          .delete()
          .from("course")
          .where("id = :id", { id: courseIdToDelete })
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
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const logoUrl = await s3Service.uploadFile(
      req.file.buffer,
      s3Service.generateUniqueFileName(req.file.originalname, "course-logo"),
      req.file.mimetype,
      "course-logos",
    );
    return res.status(201).json({ logoUrl });
  } catch {
    return res.status(500).json({ error: "Logo upload failed" });
  }
};

export const uploadTrainerLogo = async (req: Request, res: Response) => {
  try {
    console.log("Received file:", req.file);
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const fileBuffer = req.file.buffer;
    const originalName = req.file.originalname;
    const contentType = req.file.mimetype;
    const fileName = s3Service.generateUniqueFileName(
      originalName,
      "trainer-logo",
    );
    const trainerUrl = await s3Service.uploadFile(
      fileBuffer,
      fileName,
      contentType,
      "trainer-logos",
    );
    return res.status(201).json({ trainerUrl });
  } catch (error) {
    console.error("Logo upload failed:", error);
    return res.status(500).json({ error: "Logo upload failed" });
  }
};
