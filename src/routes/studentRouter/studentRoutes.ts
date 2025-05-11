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
  getStudentCourseModules,
} from "../../controllers/studentController/studentController";
import { authMiddleware } from "../../middleware/authMiddleware";

const router = express.Router();

// Apply student authentication middleware to all routes
router.use(authMiddleware);

// Get all courses available to the student
router.get("/courses", getStudentCourses);

// Get details of a specific course, including module lock status
router.get("/courses/:courseId", getStudentCourseById);
router.get("/courses/:courseId/modules", getStudentCourseModules);

// Get details of a specific module, including day contents and MCQ accessibility
router.get("/modules/:moduleId", getStudentModuleById);

// Get content for a specific day
router.get("/day-contents/:dayId", getStudentDayContentById);

// Mark a day’s content as completed
router.patch("/day-contents/:dayId/complete", markDayAsCompleted);

// Get the MCQ questions for a module
router.get("/modules/:moduleId/mcq", getStudentModuleMCQ);

// Submit responses to a module’s MCQ
router.post("/modules/:moduleId/mcq/responses", submitMCQResponses);

// Get the latest MCQ results for a module
router.get("/modules/:moduleId/mcq/results", getMCQResults);

export { router as studentRouter };
