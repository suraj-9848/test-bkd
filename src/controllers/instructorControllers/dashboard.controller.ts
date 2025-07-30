import { Request, Response } from "express";
import { AppDataSource } from "../../db/connect";
import { getAllRecordsWithFilter } from "../../lib/dbLib/sqlUtils";
import { User } from "../../db/mysqlModels/User";
import { UserRole } from "../../db/mysqlModels/User";

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

// Get all students for course assignment (simpler version)
export const getAllStudentsForAssignment = async (req: Request, res: Response) => {
  try {
    console.log("=== Getting all students for course assignment ===");

    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Fetch all students using utility function with caching
    const students = await getAllRecordsWithFilter(User, {
      where: { userRole: UserRole.STUDENT },
      select: ["id", "username", "email", "userRole"],
      order: { username: "ASC" },
    }, "all_students_for_assignment", true, 5 * 60); // Cache for 5 minutes

    console.log(`=== Found ${students.length} students for course assignment ===`);

    return res.json({ 
      message: "Students fetched successfully",
      students: students.map(student => ({
        id: student.id,
        username: student.username,
        email: student.email,
        courses: [] // Empty courses array for course assignment interface
      }))
    });
  } catch (err: any) {
    console.error("=== Error getting students for assignment:", err);
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

// Mock function to get instructor batches
export const getInstructorBatches = async (req: Request, res: Response) => {
  try {
    console.log("=== Getting instructor batches (MOCK) ===");
    
    // Mock batches data
    const mockBatches = [
      {
        id: "batch-1",
        name: "Web Development Batch 2024",
        description: "Full stack web development batch",
        org_id: "org-1",
        created_at: "2024-01-01T00:00:00Z",
        student_count: 25
      },
      {
        id: "batch-2", 
        name: "Data Science Batch 2024",
        description: "Data science and ML batch",
        org_id: "org-1",
        created_at: "2024-01-15T00:00:00Z",
        student_count: 20
      },
      {
        id: "batch-3",
        name: "Mobile App Development 2024",
        description: "React Native and Flutter batch", 
        org_id: "org-1",
        created_at: "2024-02-01T00:00:00Z",
        student_count: 18
      }
    ];

    res.json({
      success: true,
      batches: mockBatches,
      total: mockBatches.length
    });

  } catch (error) {
    console.error("Error getting instructor batches:", error);
    res.status(500).json({ 
      error: "Failed to fetch batches",
      details: error.message 
    });
  }
};

// Mock function to get courses for a specific batch
export const getBatchCourses = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    console.log(`=== Getting courses for batch: ${batchId} (MOCK) ===`);
    
    // Mock courses data based on batch
    const mockCourses = {
      "batch-1": [
        {
          id: "course-1",
          title: "HTML & CSS Fundamentals",
          description: "Basic web development",
          duration: "4 weeks",
          enrolled_students: 25,
          completion_rate: 85
        },
        {
          id: "course-2", 
          title: "JavaScript Essentials",
          description: "Core JavaScript concepts",
          duration: "6 weeks",
          enrolled_students: 23,
          completion_rate: 78
        },
        {
          id: "course-3",
          title: "React.js Development", 
          description: "Modern React development",
          duration: "8 weeks",
          enrolled_students: 20,
          completion_rate: 65
        }
      ],
      "batch-2": [
        {
          id: "course-4",
          title: "Python for Data Science",
          description: "Python programming for data analysis",
          duration: "6 weeks", 
          enrolled_students: 20,
          completion_rate: 90
        },
        {
          id: "course-5",
          title: "Machine Learning Basics",
          description: "Introduction to ML algorithms",
          duration: "10 weeks",
          enrolled_students: 18,
          completion_rate: 72
        }
      ],
      "batch-3": [
        {
          id: "course-6",
          title: "React Native Development",
          description: "Cross-platform mobile apps",
          duration: "12 weeks",
          enrolled_students: 18,
          completion_rate: 68
        }
      ]
    };

    const courses = mockCourses[batchId] || [];

    res.json({
      success: true,
      courses: courses,
      total: courses.length,
      batchId: batchId
    });

  } catch (error) {
    console.error("Error getting batch courses:", error);
    res.status(500).json({ 
      error: "Failed to fetch courses for batch",
      details: error.message 
    });
  }
};

// Mock function to get batch course progress (student analytics)
export const getBatchCourseProgress = async (req: Request, res: Response) => {
  try {
    const { batchId, courseId } = req.params;
    console.log(`=== Getting progress for batch: ${batchId}, course: ${courseId} (MOCK) ===`);
    
    // Mock student progress data
    const mockStudentProgress = [
      {
        student_id: "student-1",
        student_name: "Alice Johnson",
        email: "alice@example.com",
        progress_percentage: 85,
        modules_completed: 8,
        total_modules: 10,
        last_activity: "2024-01-20T10:30:00Z",
        time_spent_hours: 45,
        quiz_scores: [85, 92, 78, 88],
        average_score: 85.75
      },
      {
        student_id: "student-2", 
        student_name: "Bob Smith",
        email: "bob@example.com",
        progress_percentage: 72,
        modules_completed: 7,
        total_modules: 10,
        last_activity: "2024-01-19T14:15:00Z",
        time_spent_hours: 38,
        quiz_scores: [78, 85, 69, 82],
        average_score: 78.5
      },
      {
        student_id: "student-3",
        student_name: "Carol Davis", 
        email: "carol@example.com",
        progress_percentage: 94,
        modules_completed: 9,
        total_modules: 10,
        last_activity: "2024-01-21T09:45:00Z",
        time_spent_hours: 52,
        quiz_scores: [92, 88, 95, 91],
        average_score: 91.5
      },
      {
        student_id: "student-4",
        student_name: "David Wilson",
        email: "david@example.com", 
        progress_percentage: 63,
        modules_completed: 6,
        total_modules: 10,
        last_activity: "2024-01-18T16:20:00Z",
        time_spent_hours: 32,
        quiz_scores: [72, 68, 75, 70],
        average_score: 71.25
      },
      {
        student_id: "student-5",
        student_name: "Eva Martinez",
        email: "eva@example.com",
        progress_percentage: 88,
        modules_completed: 8,
        total_modules: 10, 
        last_activity: "2024-01-20T12:00:00Z",
        time_spent_hours: 47,
        quiz_scores: [89, 87, 92, 85],
        average_score: 88.25
      }
    ];

    res.json({
      success: true,
      report: mockStudentProgress,
      batch_id: batchId,
      course_id: courseId,
      total_students: mockStudentProgress.length,
      average_progress: mockStudentProgress.reduce((sum, s) => sum + s.progress_percentage, 0) / mockStudentProgress.length
    });

  } catch (error) {
    console.error("Error getting batch course progress:", error);
    res.status(500).json({ 
      error: "Failed to fetch student progress",
      details: error.message 
    });
  }
};

// Mock function to get batch course tests
export const getBatchCourseTests = async (req: Request, res: Response) => {
  try {
    const { batchId, courseId } = req.params;
    console.log(`=== Getting tests for batch: ${batchId}, course: ${courseId} (MOCK) ===`);
    
    // Mock test data
    const mockTests = [
      {
        test_id: "test-1",
        test_name: "HTML Fundamentals Quiz",
        total_questions: 20,
        duration_minutes: 30,
        attempts: 25,
        average_score: 82.5,
        pass_rate: 88,
        created_at: "2024-01-10T00:00:00Z"
      },
      {
        test_id: "test-2",
        test_name: "CSS Styling Assessment", 
        total_questions: 15,
        duration_minutes: 25,
        attempts: 23,
        average_score: 78.2,
        pass_rate: 82,
        created_at: "2024-01-15T00:00:00Z"
      },
      {
        test_id: "test-3",
        test_name: "JavaScript Basics Test",
        total_questions: 30,
        duration_minutes: 45,
        attempts: 20,
        average_score: 75.8,
        pass_rate: 75,
        created_at: "2024-01-20T00:00:00Z"
      }
    ];

    res.json({
      success: true,
      tests: mockTests,
      batch_id: batchId,
      course_id: courseId,
      total_tests: mockTests.length
    });

  } catch (error) {
    console.error("Error getting batch course tests:", error);
    res.status(500).json({ 
      error: "Failed to fetch tests",
      details: error.message 
    });
  }
};

// Mock function to get batch course test statistics
export const getBatchCourseTestStats = async (req: Request, res: Response) => {
  try {
    const { batchId, courseId } = req.params;
    console.log(`=== Getting test stats for batch: ${batchId}, course: ${courseId} (MOCK) ===`);
    
    // Mock test statistics
    const mockTestStats = {
      total_tests: 3,
      total_attempts: 68,
      average_score_across_all_tests: 78.8,
      overall_pass_rate: 81.7,
      highest_scoring_test: {
        test_name: "HTML Fundamentals Quiz",
        average_score: 82.5
      },
      lowest_scoring_test: {
        test_name: "JavaScript Basics Test", 
        average_score: 75.8
      },
      score_distribution: {
        "90-100": 15,
        "80-89": 20,
        "70-79": 18,
        "60-69": 10,
        "below-60": 5
      },
      monthly_performance: [
        { month: "January", average_score: 78.8, attempts: 68 }
      ]
    };

    res.json({
      success: true,
      stats: mockTestStats,
      batch_id: batchId,
      course_id: courseId
    });

  } catch (error) {
    console.error("Error getting batch course test stats:", error);
    res.status(500).json({ 
      error: "Failed to fetch test statistics",
      details: error.message 
    });
  }
};

// Mock function to get batch course leaderboard
export const getBatchCourseLeaderboard = async (req: Request, res: Response) => {
  try {
    const { batchId, courseId } = req.params;
    console.log(`=== Getting leaderboard for batch: ${batchId}, course: ${courseId} (MOCK) ===`);
    
    // Mock leaderboard data
    const mockLeaderboard = [
      {
        rank: 1,
        student_id: "student-3",
        student_name: "Carol Davis",
        email: "carol@example.com",
        total_score: 367,
        average_score: 91.75,
        tests_completed: 4,
        progress_percentage: 94,
        badges: ["Top Performer", "Quick Learner"]
      },
      {
        rank: 2,
        student_id: "student-5", 
        student_name: "Eva Martinez",
        email: "eva@example.com",
        total_score: 353,
        average_score: 88.25,
        tests_completed: 4,
        progress_percentage: 88,
        badges: ["Consistent Performer"]
      },
      {
        rank: 3,
        student_id: "student-1",
        student_name: "Alice Johnson",
        email: "alice@example.com", 
        total_score: 343,
        average_score: 85.75,
        tests_completed: 4,
        progress_percentage: 85,
        badges: ["Regular Participant"]
      },
      {
        rank: 4,
        student_id: "student-2",
        student_name: "Bob Smith",
        email: "bob@example.com",
        total_score: 314,
        average_score: 78.5,
        tests_completed: 4,
        progress_percentage: 72,
        badges: []
      },
      {
        rank: 5,
        student_id: "student-4",
        student_name: "David Wilson", 
        email: "david@example.com",
        total_score: 285,
        average_score: 71.25,
        tests_completed: 4,
        progress_percentage: 63,
        badges: []
      }
    ];

    res.json({
      success: true,
      leaderboard: mockLeaderboard,
      batch_id: batchId,
      course_id: courseId,
      total_participants: mockLeaderboard.length
    });

  } catch (error) {
    console.error("Error getting batch course leaderboard:", error);
    res.status(500).json({ 
      error: "Failed to fetch leaderboard",
      details: error.message 
    });
  }
};
