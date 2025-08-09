import express from "express";
import { studentAuthMiddleware } from "../../middleware/authMiddleware";
import { viewAsMiddleware } from "../../middleware/viewAsMiddleware";
import { withFullUser } from "../../utils/userHelpers";

// Import your controller functions
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
} from "../../controllers/studentController/studentController";
import { getStudentMeetings } from "../../controllers/meetingControllers/meetingController";

const router = express.Router();

router.get(
  "/courses/public",
  OptionalStudentAuthMiddleware, // Use the optional middleware
  getStudentPublicCourses,
);
// Apply middlewares in order:
// 1. View-as middleware (handles admin "view as student" functionality)
// 2. Student auth middleware (validates student access)
router.use(viewAsMiddleware);
router.use(studentAuthMiddleware);

// Test routes - specific routes must come before parameterized routes
router.get("/tests", getStudentTests);
router.get("/tests/leaderboard", getGlobalTestLeaderboard);
router.get("/tests/:testId", getStudentTestById);
router.post("/tests/:testId/submit", submitTest);
router.get("/tests/:testId/submissions", getTestSubmissions);
router.get("/tests/:testId/results", getStudentTestResults);

// Course routes
router.get("/courses", getStudentCourses);
// router.get("/courses/public", getStudentPublicCourses);
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
      hasToken: !!req.cookies?.token,
    },
  };

  console.log("🔍 Student Auth Debug Endpoint Called:", debugInfo);

  res.json({
    message: "Student authentication debug info",
    debug: debugInfo,
    status: "success",
  });
});

export { router as studentRouter };

// Alternative approach: Update individual controller functions
// If you prefer to update your controllers one by one, here's how:

// Example of updating a single controller function:
export const getStudentTestsUpdated = withFullUser(async (req, res) => {
  try {
    // req.user is now properly typed as User
    // ... rest of your existing code

    // Now you can access all User properties without TypeScript errors
    console.log("Student org:", req.user.org_id);
    console.log("Student batches:", req.user.batch_id);

    // Your existing logic here...
  } catch (error) {
    console.error("Error fetching student tests:", error);
    res.status(500).json({ message: "Error fetching tests" });
  }
});
