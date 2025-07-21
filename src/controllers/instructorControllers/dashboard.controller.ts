import { Request, Response } from "express";
import { AppDataSource } from "../../db/connect";

// Get instructor dashboard statistics (system-wide stats for dashboard overview)
export const getInstructorDashboardStats = async (
  req: Request,
  res: Response,
) => {
  try {
    console.log("=== Getting system-wide dashboard stats ===");

    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Get database connection
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Get total courses across all instructors
      const coursesResult = await queryRunner.query(`
        SELECT COUNT(*) as count 
        FROM course
      `);
      const totalCourses = parseInt(coursesResult[0]?.count || "0");

      // Get total batches across all instructors
      const batchesResult = await queryRunner.query(`
        SELECT COUNT(*) as count 
        FROM batch
      `);
      const totalBatches = parseInt(batchesResult[0]?.count || "0");

      // Get total students across all courses
      const studentsResult = await queryRunner.query(`
        SELECT COUNT(DISTINCT uc.userId) as count
        FROM user_course uc
      `);
      const totalStudents = parseInt(studentsResult[0]?.count || "0");

      // Get average completion across all courses
      const completionResult = await queryRunner.query(`
        SELECT AVG(uc.completed * 100) as avg_completion
        FROM user_course uc
      `);
      const averageProgress = Math.round(
        parseFloat(completionResult[0]?.avg_completion || "0"),
      );

      // Get recent activity (last 30 days) across all courses
      const recentActivityResult = await queryRunner.query(`
        SELECT COUNT(*) as count
        FROM user_course uc
        WHERE uc.assignedAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `);
      const recentActivity = parseInt(recentActivityResult[0]?.count || "0");

      // Get public vs private courses across all instructors
      const publicCoursesResult = await queryRunner.query(`
        SELECT COUNT(*) as count 
        FROM course 
        WHERE is_public = 1
      `);
      const publicCourses = parseInt(publicCoursesResult[0]?.count || "0");

      const stats = {
        totalCourses,
        totalBatches,
        totalStudents,
        averageProgress,
        recentActivity,
        publicCourses,
        privateCourses: totalCourses - publicCourses,
      };

      console.log(
        "=== System-wide dashboard stats:",
        JSON.stringify(stats, null, 2),
      );

      return res.json({ stats });
    } finally {
      await queryRunner.release();
    }
  } catch (err: any) {
    console.error("=== Error getting dashboard stats:", err);
    return res.status(500).json({
      error: "Failed to fetch dashboard statistics",
      details:
        process.env.NODE_ENV === "development"
          ? err?.message
          : "Internal server error",
    });
  }
};

// Get general dashboard statistics (for landing page)
export const getGeneralDashboardStats = async (req: Request, res: Response) => {
  try {
    console.log("=== Getting general dashboard stats ===");

    // Get database connection
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Get total courses
      const coursesResult = await queryRunner.query(`
        SELECT COUNT(*) as count 
        FROM course
      `);
      const totalCourses = parseInt(coursesResult[0]?.count || "0");

      // Get total students
      const studentsResult = await queryRunner.query(`
        SELECT COUNT(*) as count 
        FROM user 
        WHERE role = 'STUDENT'
      `);
      const totalStudents = parseInt(studentsResult[0]?.count || "0");

      // Get total instructors
      const instructorsResult = await queryRunner.query(`
        SELECT COUNT(*) as count 
        FROM user 
        WHERE role = 'INSTRUCTOR'
      `);
      const totalInstructors = parseInt(instructorsResult[0]?.count || "0");

      const stats = {
        totalCourses,
        totalStudents,
        totalInstructors,
      };

      console.log(
        "=== General dashboard stats:",
        JSON.stringify(stats, null, 2),
      );

      return res.json({ stats });
    } finally {
      await queryRunner.release();
    }
  } catch (err: any) {
    console.error("=== Error getting general dashboard stats:", err);
    return res.status(500).json({
      error: "Failed to fetch dashboard statistics",
      details:
        process.env.NODE_ENV === "development"
          ? err?.message
          : "Internal server error",
    });
  }
};

// Get students enrolled in instructor's courses
export const getInstructorStudents = async (req: Request, res: Response) => {
  try {
    console.log("=== Getting instructor students ===");

    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const username = user.username;
    console.log("=== Fetching students for instructor:", username);

    // Get database connection
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Get students enrolled in this instructor's courses with course details
      const studentsResult = await queryRunner.query(
        `
        SELECT DISTINCT 
          u.id as userId,
          u.username,
          u.email,
          u.userRole,
          c.id as courseId,
          c.title as courseName,
          uc.assignedAt,
          uc.completed,
          uc.progress
        FROM user_course uc
        INNER JOIN course c ON uc.courseId = c.id
        INNER JOIN user u ON uc.userId = u.id
        WHERE c.instructor_name = ? AND u.userRole = 'student'
        ORDER BY u.username, c.title
      `,
        [username],
      );

      // Group students by user
      const studentsMap = new Map();
      studentsResult.forEach((row: any) => {
        const studentId = row.userId;
        if (!studentsMap.has(studentId)) {
          studentsMap.set(studentId, {
            id: studentId,
            username: row.username,
            email: row.email,
            courses: [],
          });
        }

        studentsMap.get(studentId).courses.push({
          courseId: row.courseId,
          courseName: row.courseName,
          assignedAt: row.assignedAt,
          completed: row.completed,
          progress: row.progress || 0,
        });
      });

      const students = Array.from(studentsMap.values());

      console.log(
        `=== Found ${students.length} students for instructor ${username} ===`,
      );

      return res.json({ students });
    } finally {
      await queryRunner.release();
    }
  } catch (err: any) {
    console.error("=== Error getting instructor students:", err);
    return res.status(500).json({
      error: "Failed to fetch students",
      details:
        process.env.NODE_ENV === "development"
          ? err?.message
          : "Internal server error",
    });
  }
};

// Get system-wide student analytics (for StudentAnalytics component)
export const getSystemWideStudentAnalytics = async (
  req: Request,
  res: Response,
) => {
  try {
    console.log("=== Getting system-wide student analytics ===");

    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Get database connection
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Get all students across all courses with course details
      const studentsResult = await queryRunner.query(`
        SELECT DISTINCT 
          u.id as userId,
          u.username,
          u.email,
          u.userRole,
          c.id as courseId,
          c.title as courseName,
          uc.assignedAt,
          uc.completed,
          uc.progress
        FROM user_course uc
        INNER JOIN course c ON uc.courseId = c.id
        INNER JOIN user u ON uc.userId = u.id
        WHERE u.userRole = 'student'
        ORDER BY u.username, c.title
      `);

      // Group students by user
      const studentsMap = new Map();
      studentsResult.forEach((row: any) => {
        const studentId = row.userId;
        if (!studentsMap.has(studentId)) {
          studentsMap.set(studentId, {
            id: studentId,
            username: row.username,
            email: row.email,
            courses: [],
          });
        }

        studentsMap.get(studentId).courses.push({
          courseId: row.courseId,
          courseName: row.courseName,
          assignedAt: row.assignedAt,
          completed: row.completed,
          progress: row.progress || 0,
        });
      });

      const students = Array.from(studentsMap.values());

      console.log(`=== Found ${students.length} students system-wide ===`);

      return res.json({ students });
    } finally {
      await queryRunner.release();
    }
  } catch (err: any) {
    console.error("=== Error getting system-wide student analytics:", err);
    return res.status(500).json({
      error: "Failed to fetch system-wide student analytics",
      details:
        process.env.NODE_ENV === "development"
          ? err?.message
          : "Internal server error",
    });
  }
};
