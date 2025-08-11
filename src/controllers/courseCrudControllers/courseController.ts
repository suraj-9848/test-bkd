import { Request, Response } from "express";
import { In, Like } from "typeorm";
import { Course } from "../../db/mysqlModels/Course";
import { Batch } from "../../db/mysqlModels/Batch";
import { Module } from "../../db/mysqlModels/Module";
import { User } from "../../db/mysqlModels/User";
import { UserCourse } from "../../db/mysqlModels/UserCourse";
import { DayContent } from "../../db/mysqlModels/DayContent";
import { UserDayCompletion } from "../../db/mysqlModels/UserDayCompletion";
import { ModuleMCQ } from "../../db/mysqlModels/ModuleMCQ";
import { ModuleMCQResponses } from "../../db/mysqlModels/ModuleMCQResponses";
import { ModuleMCQAnswer } from "../../db/mysqlModels/ModuleMCQAnswer";
import { AppDataSource } from "../../db/connect";
import s3Service from "../../utils/s3Service";

// const logger = getLoggerByName("Course Controller");

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
// import { getLoggerByName } from "../../utils/logger";

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
        // logger.info("✅ S3 image uploaded for course logo:", logo);
      } else {
        // logger.info("⚠️ S3 image upload failed for course logo.");
      }
      if (trainer_avatar) {
        // logger.info("✅ S3 image uploaded for trainer avatar:", trainer_avatar);
      } else {
        // logger.info("⚠️ S3 image upload failed for trainer avatar.");
      }
    } else if (req.file) {
      if (req.file.fieldname === "logo") {
        logo = await uploadImage(req.file, "course-logo", "course-logos");
        if (logo) {
          // logger.info("✅ S3 image uploaded for course logo:", logo);
        } else {
          // logger.info("⚠️ S3 image upload failed for course logo.");
        }
      } else if (req.file.fieldname === "trainer_avatar") {
        trainer_avatar = await uploadImage(
          req.file,
          "trainer-logo",
          "trainer-logos",
        );
        if (trainer_avatar) {
          // logger.info(
          //   "✅ S3 image uploaded for trainer avatar:",
          //   trainer_avatar,
          // );
        } else {
          // logger.info("⚠️ S3 image upload failed for trainer avatar.");
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

export const getCourseAnalytics = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    if (!courseId)
      return res.status(400).json({ message: "Course ID is required" });

    // Fetch course with modules, days and MCQs
    const course = await getSingleRecord(
      Course,
      { where: { id: courseId }, relations: ["modules.days", "modules.tests"] },
      `course_student_analytics_${courseId}`,
      true,
      10 * 60,
    );
    if (!course) return res.status(404).json({ message: "Course not found" });

    // Fetch all students assigned to this course
    const assignments = await UserCourse.find({
      where: { course: { id: courseId } },
      relations: ["user"],
    });
    const students = assignments.map((a) => a.user);

    // Prepare IDs for batch queries
    const studentIds = students.map((s) => s.id);
    const moduleIds = (course.modules || []).map((m) => m.id);
    // Fix: Properly flatten all day IDs from modules
    const allDayIds = (course.modules || []).flatMap((m) =>
      Array.isArray(m.days) ? m.days.map((d) => d.id) : [],
    );

    // Batch fetch all UserDayCompletion for these students and days
    const allDayCompletions = await UserDayCompletion.find({
      where: {
        user: { id: In(studentIds) },
        completed: true,
        day: In(allDayIds),
      },
      relations: ["user", "day"],
    });

    // Batch fetch all MCQs for these modules
    const allMcqs = await getAllRecordsWithFilter(ModuleMCQ, {
      where: { module: { id: In(moduleIds) } },
    });

    // Build mcqByModuleId Map with validation
    const mcqByModuleId = new Map();
    for (const mcq of allMcqs) {
      if (mcq.module && mcq.module.id) {
        mcqByModuleId.set(mcq.module.id, mcq);
      } else {
        console.warn(
          `[MCQ DEBUG] Skipping MCQ with invalid module or module.id:`,
          mcq,
        );
      }
    }

    const mcqIds = allMcqs.map((mcq) => mcq.id);

    // Batch fetch all MCQ responses for these students and MCQs
    const allMcqResponses = await getAllRecordsWithFilter(ModuleMCQResponses, {
      where: { moduleMCQ: { id: In(mcqIds) }, user: { id: In(studentIds) } },
      relations: ["moduleMCQ", "user"],
    });
    // Store all responses for each MCQ+user combination to find maximum score
    const mcqResponseMap = new Map();
    for (const r of allMcqResponses) {
      if (r.moduleMCQ && r.moduleMCQ.id && r.user && r.user.id) {
        const key = `${r.moduleMCQ.id}_${r.user.id}`;
        if (!mcqResponseMap.has(key)) {
          mcqResponseMap.set(key, []);
        }
        mcqResponseMap.get(key).push(r);
      }
    }

    // Batch fetch all MCQ answers for these MCQs
    const allMcqAnswers = await getAllRecordsWithFilter(ModuleMCQAnswer, {
      where: { moduleMCQ: { id: In(mcqIds) } },
      relations: ["moduleMCQ"],
      order: { createdAt: "ASC" },
    });
    const mcqAnswersMap = new Map();
    for (const ans of allMcqAnswers) {
      if (ans.moduleMCQ && ans.moduleMCQ.id) {
        if (!mcqAnswersMap.has(ans.moduleMCQ.id)) {
          mcqAnswersMap.set(ans.moduleMCQ.id, []);
        }
        mcqAnswersMap.get(ans.moduleMCQ.id).push(ans);
      }
    }

    // Debug: Log MCQ data summary
    console.log(
      `[Course Analytics] MCQ Summary - Total MCQs: ${allMcqs.length}, Total Answers: ${allMcqAnswers.length}, Total Responses: ${allMcqResponses.length}, Students: ${studentIds.length}`,
    );

    // Map: studentId+dayId => completion
    const dayCompletionMap = new Map();
    for (const dc of allDayCompletions) {
      if (dc.user && dc.user.id && dc.day && dc.day.id) {
        dayCompletionMap.set(`${dc.user.id}_${dc.day.id}`, true);
      } else {
        console.warn(
          `[DAY COMPLETION DEBUG] Skipping invalid day completion:`,
          dc,
        );
      }
    }

    // Calculate pass percentage for each student
    const totalModules = course.modules?.length || 0;

    // Handle empty course case
    if (totalModules === 0) {
      console.log(
        `[Course Analytics] Warning: Course ${courseId} has no modules`,
      );
      const emptyAnalytics = students.map((student) => ({
        studentId: student.id,
        studentName: student.username || "",
        modulesCompleted: 0,
        totalModules: 0,
        courseCompleted: true, // Consider empty course as completed
        passPercentage: 100, // 100% for empty course
        modules: [],
      }));

      return res.status(200).json({
        message: "Course student analytics fetched successfully (empty course)",
        courseId,
        courseTitle: course.title,
        analytics: emptyAnalytics,
      });
    }

    const analytics = students.map((student) => {
      let modulesCompleted = 0;
      const modules = (course.modules || []).map((module: Module) => {
        // Day completion
        const dayIds = Array.isArray(module.days)
          ? module.days.map((d: DayContent) => d.id)
          : [];
        const completedDays = dayIds.filter((dayId) =>
          dayCompletionMap.get(`${student.id}_${dayId}`),
        );
        const allDaysCompleted =
          completedDays.length === dayIds.length && dayIds.length > 0;

        // MCQ analytics - Use module.tests directly since it's loaded via relations
        let mcq: ModuleMCQ | null = null;
        let mcqPercentage: number | null = null;
        let mcqPassed: boolean = false;
        let mcqScore: number | null = null;
        let mcqPassedScore: number | null = null;
        let mcqTotalQuestions: number | null = null;
        let mcqAttempted: boolean = false;

        // Use module.tests directly from the loaded relations
        if (Array.isArray(module.tests) && module.tests.length > 0) {
          mcq = module.tests[0];
          const mcqResponses =
            mcqResponseMap.get(`${mcq.id}_${student.id}`) || [];
          const correctAnswers = mcqAnswersMap.get(mcq.id) || [];

          // Get total questions - try from answers first, then from MCQ questions JSON
          mcqTotalQuestions = correctAnswers.length;
          if (mcqTotalQuestions === 0 && mcq.questions) {
            // If no answers found, try to count from MCQ questions JSON
            if (Array.isArray(mcq.questions)) {
              mcqTotalQuestions = mcq.questions.length;
            } else if (typeof mcq.questions === "object") {
              // If questions is an object, count its properties
              mcqTotalQuestions = Object.keys(mcq.questions).length;
            }
          }

          if (mcqResponses.length > 0) {
            mcqAttempted = true;
            let maxScore = 0;

            // Find the response with maximum score
            mcqResponses.forEach((response: any) => {
              if (Array.isArray(response.responses)) {
                let score = 0;
                response.responses.forEach((resp: any) => {
                  const correct = correctAnswers.find(
                    (ans: ModuleMCQAnswer) =>
                      ans.questionId === resp.questionId &&
                      ans.correctAnswer === resp.answer,
                  );
                  if (correct) score++;
                });
                if (score > maxScore) {
                  maxScore = score;
                }
              }
            });

            mcqScore = maxScore;
            mcqPercentage =
              mcqTotalQuestions > 0 ? (maxScore / mcqTotalQuestions) * 100 : 0;
            mcqPassedScore = mcq.passingScore ?? null;
            mcqPassed =
              mcqPercentage !== null &&
              mcqPassedScore !== null &&
              mcqPercentage >= mcqPassedScore;
          } else {
            // MCQ exists but not attempted
            mcqScore = 0;
            mcqPercentage = 0;
            mcqPassedScore = mcq.passingScore ?? null;
            mcqPassed = false;
          }
        } else {
          // Try to get MCQ from the mcqByModuleId map as fallback
          const moduleWiseMcq = mcqByModuleId.get(module.id);
          if (moduleWiseMcq) {
            mcq = moduleWiseMcq;
            const mcqResponses =
              mcqResponseMap.get(`${mcq.id}_${student.id}`) || [];
            const correctAnswers = mcqAnswersMap.get(mcq.id) || [];

            // Get total questions - try from answers first, then from MCQ questions JSON
            mcqTotalQuestions = correctAnswers.length;
            if (mcqTotalQuestions === 0 && mcq.questions) {
              // If no answers found, try to count from MCQ questions JSON
              if (Array.isArray(mcq.questions)) {
                mcqTotalQuestions = mcq.questions.length;
              } else if (typeof mcq.questions === "object") {
                // If questions is an object, count its properties
                mcqTotalQuestions = Object.keys(mcq.questions).length;
              }
            }

            if (mcqResponses.length > 0) {
              mcqAttempted = true;
              let maxScore = 0;

              // Find the response with maximum score
              mcqResponses.forEach((response: any) => {
                if (Array.isArray(response.responses)) {
                  let score = 0;
                  response.responses.forEach((resp: any) => {
                    const correct = correctAnswers.find(
                      (ans: ModuleMCQAnswer) =>
                        ans.questionId === resp.questionId &&
                        ans.correctAnswer === resp.answer,
                    );
                    if (correct) score++;
                  });
                  if (score > maxScore) {
                    maxScore = score;
                  }
                }
              });

              mcqScore = maxScore;
              mcqPercentage =
                mcqTotalQuestions > 0
                  ? (maxScore / mcqTotalQuestions) * 100
                  : 0;
              mcqPassedScore = mcq.passingScore ?? null;
              mcqPassed =
                mcqPercentage !== null &&
                mcqPassedScore !== null &&
                mcqPercentage >= mcqPassedScore;
            } else {
              // MCQ exists but not attempted
              mcqScore = 0;
              mcqPercentage = 0;
              mcqPassedScore = mcq.passingScore ?? null;
              mcqPassed = false;
            }
          }
        }

        // Module completion logic:
        // 1. All days must be completed
        // 2. If MCQ exists and has been attempted, it must be passed
        // 3. If MCQ exists but not attempted, module is still complete if days are done
        const moduleFullyCompleted =
          allDaysCompleted && (mcq ? (mcqAttempted ? mcqPassed : true) : true);
        if (moduleFullyCompleted) modulesCompleted++;

        return {
          moduleId: module.id,
          moduleTitle: module.title,
          completedDays: completedDays.length,
          totalDays: dayIds.length,
          allDaysCompleted,
          mcq: mcq
            ? {
                id: mcq.id,
                passingScore: mcq.passingScore,
                totalQuestions: mcqTotalQuestions,
                attempted: mcqAttempted,
                score: mcqScore,
                percentage: mcqPercentage,
                passed: mcqPassed,
              }
            : null,
          moduleFullyCompleted,
        };
      });

      const courseCompleted =
        modules.length > 0 && modules.every((m) => m.moduleFullyCompleted);
      const completionPercentage =
        totalModules > 0 ? (modulesCompleted / totalModules) * 100 : 0;

      return {
        studentId: student.id,
        studentName: student.username || "",
        modulesCompleted,
        totalModules,
        courseCompleted,
        completionPercentage,
        modules,
      };
    });

    return res.status(200).json({
      message: "Course student analytics fetched successfully",
      courseId,
      courseTitle: course.title,
      analytics,
    });
  } catch (error) {
    console.error("Error fetching course student analytics:", error);
    return res
      .status(500)
      .json({ message: "Error fetching course student analytics" });
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

// ========== HELPER FUNCTION ==========
async function areAllDaysCompleted(
  userId: string,
  module: Module,
): Promise<boolean> {
  try {
    // Get all days for this module
    const days = await getAllRecordsWithFilter(DayContent, {
      where: { module: { id: module.id } },
    });

    if (days.length === 0) return true; // No days means module is complete

    // Check if user has completed all days
    const completedDays = await getAllRecordsWithFilter(UserDayCompletion, {
      where: {
        user: { id: userId },
        day: { id: In(days.map((d) => d.id)) },
        completed: true,
      },
    });

    return completedDays.length === days.length;
  } catch (error) {
    console.error("Error checking day completions:", error);
    return false;
  }
}

// ========== GET MODULE COMPLETION STATUS ==========
export const getModuleCompletionStatus = async (
  req: Request,
  res: Response,
) => {
  const { moduleId } = req.params;
  const student = req.user as User;

  try {
    const module = await getSingleRecord(Module, { where: { id: moduleId } });
    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    const allDaysCompleted = await areAllDaysCompleted(student.id, module);

    const mcq = await getSingleRecord(ModuleMCQ, {
      where: { module: { id: moduleId } },
    });
    let mcqAttempted = false;
    let mcqPassed = false;
    let mcqScore = 0;
    let mcqPercentage = 0;

    if (mcq) {
      // Get all MCQ responses for this user and MCQ
      const mcqResponses = await getAllRecordsWithFilter(ModuleMCQResponses, {
        where: { moduleMCQ: { id: mcq.id }, user: { id: student.id } },
      });

      if (mcqResponses.length > 0) {
        mcqAttempted = true;
        const correctAnswers = await getAllRecordsWithFilter(ModuleMCQAnswer, {
          where: { moduleMCQ: { id: mcq.id } },
          order: { createdAt: "ASC" },
        });

        let maxScore = 0;

        // Find the maximum score from all attempts
        mcqResponses.forEach((mcqResponse: any) => {
          if (Array.isArray(mcqResponse.responses)) {
            let score = 0;
            mcqResponse.responses.forEach((response: any) => {
              const correct = correctAnswers.find(
                (ans: ModuleMCQAnswer) =>
                  ans.questionId === response.questionId &&
                  ans.correctAnswer === response.answer,
              );
              if (correct) {
                score++;
              }
            });
            if (score > maxScore) {
              maxScore = score;
            }
          }
        });

        mcqScore = maxScore;
        mcqPercentage =
          correctAnswers.length > 0
            ? (maxScore / correctAnswers.length) * 100
            : 0;
        mcqPassed = mcqPercentage >= mcq.passingScore;
      }
    }

    const moduleFullyCompleted = allDaysCompleted && (mcq ? mcqPassed : true);

    res.status(200).json({
      moduleId,
      allDaysCompleted,
      mcqAttempted,
      mcqPassed,
      mcqScore,
      mcqPercentage,
      moduleFullyCompleted,
    });
  } catch (error) {
    console.error("Error checking module completion:", error);
    res.status(500).json({ message: "Error checking module completion" });
  }
};
