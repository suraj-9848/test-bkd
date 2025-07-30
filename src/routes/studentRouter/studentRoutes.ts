
import express from "express";
import {
  studentAuthMiddleware,
} from "../../middleware/authMiddleware";
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
} from "../../controllers/studentController/studentController";

const router = express.Router();

// Apply student auth middleware to all routes
// This ensures req.user is a full User entity and user has student role
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
router.get("/courses/:courseId", getStudentCourseById);
router.get("/courses/:courseId/modules", getStudentCourseModules);

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

export { router as studentRouter };

// Alternative approach: Update individual controller functions
// If you prefer to update your controllers one by one, here's how:

// Example of updating a single controller function:
export const getStudentTestsUpdated = withFullUser(async (req, res) => {
  try {
    const studentId = req.user.id; // req.user is now properly typed as User
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
