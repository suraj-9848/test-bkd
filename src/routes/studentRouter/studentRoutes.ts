import express from "express";
import {
  getStudentCourses,
  getStudentCourseById,
  getStudentModuleById,
  getStudentDayContentById,
  markDayAsCompleted,
  getStudentModuleMCQ,
  submitMCQResponses,
  getMCQResults,
  getMCQReview,
  getMCQRetakeStatus,
  getStudentCourseModules,
  getModuleCompletionStatus,
  getStudentTestById,
  getTestSubmissions,
  getStudentTestResults,
  submitTest,
  getStudentTests,
  getGlobalTestLeaderboard,
  getStudentBatches,
  getStudentDashboardStats,
} from "../../controllers/studentController/studentController";
import { authMiddleware } from "../../middleware/authMiddleware";

const router = express.Router();

router.use(authMiddleware);

// Dashboard stats route
router.get("/dashboard/stats", getStudentDashboardStats);

router.get("/batches", getStudentBatches);
router.get("/courses", getStudentCourses);
router.get("/tests/leaderboard", getGlobalTestLeaderboard);
router.get("/courses/:courseId", getStudentCourseById);
router.get("/courses/:courseId/modules", getStudentCourseModules);
router.get("/modules/:moduleId", getStudentModuleById);
router.get("/day-contents/:dayId", getStudentDayContentById);
router.patch("/day-contents/:dayId/complete", markDayAsCompleted);
router.get("/modules/:moduleId/mcq", getStudentModuleMCQ);
router.post("/modules/:moduleId/mcq/responses", submitMCQResponses);
router.get("/modules/:moduleId/mcq/results", getMCQResults);
router.get("/modules/:moduleId/mcq/review", getMCQReview);
router.get("/modules/:moduleId/mcq/retake-status", getMCQRetakeStatus);
router.get("/modules/:moduleId/completion", getModuleCompletionStatus);

router.get("/tests/:testId", getStudentTestById);
router.get("/tests/:testId/attempt", getStudentTestById);
router.get("/tests", getStudentTests);
router.get("/tests/:testId/submissions", getTestSubmissions);
router.get("/tests/:testId/results", getStudentTestResults);
router.post("/tests/:testId/submit", submitTest);

export { router as studentRouter };
