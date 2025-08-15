// routes/studentRouter/studentRoutes.ts

import express from "express";
import { studentAuthMiddleware } from "../../middleware/authMiddleware";
import { viewAsMiddleware } from "../../middleware/viewAsMiddleware";

// Import your existing controller functions
import {
  getStudentTests,
  getStudentTestById,
  submitTest,
  getTestSubmissions,
  getStudentTestResults,
  getStudentCourses,
  getStudentCourseModules,
  getStudentCourseById,
  getStudentModuleById,
  getStudentDayContentById,
  markDayAsCompleted,
  getStudentModuleMCQ,
  submitMCQResponses,
  getMCQResults,
  getMCQReview,
  getModuleCompletionStatus,
  getGlobalTestLeaderboard,
  getStudentBatches,
  getStudentDashboardStats,
  getMCQRetakeStatus,
  getStudentPublicCourses,
  OptionalStudentAuthMiddleware,
  getStudentBlogs,
  getStudentBlogById,
} from "../../controllers/studentController/studentController";
import { getStudentMeetings } from "../../controllers/meetingControllers/meetingController";

// Import code execution controllers
import {
  executeCode,
  submitCode,
  getQuestionDetails,
  getSupportedLanguages,
} from "../../controllers/studentControllers/codeExecution.controller";

const router = express.Router();

// Public routes (no auth required)
router.get(
  "/courses/public",
  OptionalStudentAuthMiddleware,
  getStudentPublicCourses,
);

// Blog routes (public)
router.get("/blogs", getStudentBlogs);
router.get("/blogs/:blogId", getStudentBlogById);

// Apply middlewares to all protected routes
router.use(viewAsMiddleware);
router.use(studentAuthMiddleware);

// Validation middleware for code execution
const validateCodeExecution = (req: any, res: any, next: any) => {
  const { questionId, code, language } = req.body;

  if (!questionId || typeof questionId !== "string") {
    return res.status(400).json({
      success: false,
      error: "Question ID is required and must be a string",
    });
  }

  if (!code || typeof code !== "string" || code.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: "Code is required and cannot be empty",
    });
  }

  if (!language || typeof language !== "string") {
    return res.status(400).json({
      success: false,
      error: "Programming language is required",
    });
  }

  // Validate testId in params
  const { testId } = req.params;
  if (!testId || typeof testId !== "string") {
    return res.status(400).json({
      success: false,
      error: "Test ID is required in URL parameters",
    });
  }

  // Basic UUID validation for testId
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(testId)) {
    return res.status(400).json({
      success: false,
      error: "Invalid test ID format",
    });
  }

  next();
};

// Validation middleware for question details
const validateQuestionDetails = (req: any, res: any, next: any) => {
  const { testId, questionId } = req.params;

  if (!testId || !questionId) {
    return res.status(400).json({
      success: false,
      error: "Test ID and Question ID are required",
    });
  }

  // Basic UUID validation
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(testId) || !uuidRegex.test(questionId)) {
    return res.status(400).json({
      success: false,
      error: "Invalid ID format",
    });
  }

  next();
};

// ============================================
// CODE EXECUTION ROUTES (NEW)
// ============================================

/**
 * @route POST /api/student/tests/:testId/execute
 * @desc Execute code against visible test cases only (for testing/debugging)
 * @access Private (Student)
 */
router.post("/tests/:testId/execute", validateCodeExecution, executeCode);

/**
 * @route POST /api/student/tests/:testId/submit-code
 * @desc Submit code solution (final submission with all test cases)
 * @access Private (Student)
 */
router.post("/tests/:testId/submit-code", validateCodeExecution, submitCode);

/**
 * @route GET /api/student/tests/:testId/questions/:questionId
 * @desc Get question details with visible test cases
 * @access Private (Student)
 */
router.get(
  "/tests/:testId/questions/:questionId",
  validateQuestionDetails,
  getQuestionDetails,
);

/**
 * @route GET /api/student/code/languages
 * @desc Get supported programming languages
 * @access Private (Student)
 */
router.get("/code/languages", getSupportedLanguages);

// ============================================
// EXISTING ROUTES
// ============================================

// Test routes - specific routes must come before parameterized routes
router.get("/tests", getStudentTests);
router.get("/tests/leaderboard", getGlobalTestLeaderboard);
router.get("/tests/:testId", getStudentTestById);
router.post("/tests/:testId/submit", submitTest);
router.get("/tests/:testId/submissions", getTestSubmissions);
router.get("/tests/:testId/results", getStudentTestResults);

// Course routes
router.get("/courses", getStudentCourses);
router.get("/courses/:courseId", getStudentCourseById);
router.get("/courses/:courseId/modules", getStudentCourseModules);
router.get("/courses/:courseId/meetings", getStudentMeetings);

// Module routes
router.get("/modules/:moduleId", getStudentModuleById);
router.get("/modules/:moduleId/completion", getModuleCompletionStatus);

// MCQ routes
router.get("/modules/:moduleId/mcq", getStudentModuleMCQ);
router.post("/modules/:moduleId/mcq/responses", submitMCQResponses);
router.get("/modules/:moduleId/mcq/results", getMCQResults);
router.get("/modules/:moduleId/mcq/review", getMCQReview);
router.get("/modules/:moduleId/mcq/retake-status", getMCQRetakeStatus);

// Day content routes
router.get("/day-contents/:dayId", getStudentDayContentById);
router.patch("/day-contents/:dayId/complete", markDayAsCompleted);

// Batch routes
router.get("/batches", getStudentBatches);

// Dashboard routes
router.get("/dashboard/stats", getStudentDashboardStats);

// Debug route for authentication troubleshooting
router.get("/auth/debug", (req, res) => {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    authentication: {
      isAuthenticated: !!req.user,
      userId: req.user?.id,
      username: req.user?.username,
      userRole: req.user?.userRole,
      email: req.user?.email,
    },
    viewAs: {
      isViewingAs: req.isViewingAs,
      viewAsRole: req.viewAsRole,
      originalUserRole: req.originalUserRole,
      effectiveRole: req.viewAsRole || req.user?.userRole,
    },
    headers: {
      authorization: req.headers.authorization
        ? "Bearer [TOKEN_PRESENT]"
        : "Not provided",
      "x-view-as-role": req.headers["x-view-as-role"] || "Not set",
      userAgent: req.headers["user-agent"],
    },
    cookies: {
      hasAccessToken: !!req.cookies?.accessToken,
      hasJWT: !!req.cookies?.jwt,
      hasToken: !!req.headers.authorization,
    },
    params: req.params,
    query: req.query,
    body: req.body ? Object.keys(req.body) : [],
  };

  res.json({
    success: true,
    message: "Authentication debug information",
    debug: debugInfo,
  });
});

export { router as studentRouter };
