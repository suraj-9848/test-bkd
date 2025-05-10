// src/routes/studentRoutes.ts
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
} from "../../controllers/studentController/studentController";
import { authMiddleware } from "../../middleware/authMiddleware";
 

const studentRouter = express.Router();

// Apply student authentication middleware to all routes
studentRouter.use(authMiddleware);

// Get all courses available to the student
studentRouter.get("/courses", getStudentCourses);

// Get details of a specific course, including module lock status
studentRouter.get("/courses/:courseId", getStudentCourseById);

// Get details of a specific module, including day contents and MCQ accessibility
studentRouter.get("/modules/:moduleId", getStudentModuleById);

// Get content for a specific day
studentRouter.get("/day-contents/:dayId", getStudentDayContentById);

// Mark a day’s content as completed
studentRouter.patch("/day-contents/:dayId/complete", markDayAsCompleted);

// Get the MCQ questions for a module
studentRouter.get("/modules/:moduleId/mcq", getStudentModuleMCQ);

// Submit responses to a module’s MCQ
studentRouter.post("/modules/:moduleId/mcq/responses", submitMCQResponses);

// Get the latest MCQ results for a module
studentRouter.get("/modules/:moduleId/mcq/results", getMCQResults);

export default studentRouter;