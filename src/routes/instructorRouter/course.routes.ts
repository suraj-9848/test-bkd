import express from "express";
import {
  createCourse,
  fetchCourse,
  updateCourse,
  deleteCourse,
  fetchAllCoursesinBatch,
  fetchAllCoursesForInstructor,
  assignCourseToStudent,
} from "../../controllers/courseCrudControllers/courseController";

import {
  createModule,
  getAllModules,
  getSingleModule,
  updateModule,
  deleteModule,
} from "../../controllers/moduleControllers/moduleController";

import {
  createMCQ,
  updateMCQ,
  deleteMCQ,
  getMCQ,
  getMCQById,
  getMCQRetakeStatus,
} from "../../controllers/moduleControllers/moduleMCQControllers";

import {
  addDayContent,
  getDayContent,
  updateDayContent,
  deleteDayContent,
  markDayAsCompleted,
} from "../../controllers/moduleControllers/dayContentControllers";

import {
  getInstructorDashboardStats,
  getInstructorStudents,
  getAllStudentsForAssignment,
  getSystemWideStudentAnalytics,
  getBatchCourseProgress,
  getBatchCourseTests,
  getBatchCourseTestStats,
  getBatchCourseLeaderboard,
  getBatchCourses,
  getInstructorBatches,
} from "../../controllers/instructorControllers/dashboard.controller";

import { authMiddleware } from "../../middleware/authMiddleware";
import { instructorMiddleware } from "../../middleware/instructorMiddleware";
import { viewAsMiddleware } from "../../middleware/viewAsMiddleware";
import { validateCourseBody } from "../../middleware/courseCrudPipes/coursePipe";

const courseRouter = express.Router();

// Apply middleware chain: auth -> viewAs -> instructor
courseRouter.use(authMiddleware, viewAsMiddleware, instructorMiddleware);

// Dashboard stats route
courseRouter.get("/dashboard-stats", getInstructorDashboardStats);

// Student management routes
courseRouter.get("/students", getAllStudentsForAssignment);
courseRouter.get("/analytics/students", getSystemWideStudentAnalytics);

// Course routes
courseRouter.post("/courses", validateCourseBody, createCourse);
courseRouter.get("/courses", fetchAllCoursesForInstructor); // Get all courses - must be before parameterized routes
courseRouter.get("/fetch-all-courses", fetchAllCoursesForInstructor); // Keep legacy endpoint for compatibility
courseRouter.get("/courses/:courseId", fetchCourse);
courseRouter.put("/courses/:courseId", validateCourseBody, updateCourse);
courseRouter.delete("/courses/:courseId", deleteCourse);
courseRouter.post("/courses/:courseId/assign", assignCourseToStudent);

// Module routes
courseRouter.post("/courses/:courseId/modules", createModule);
courseRouter.get("/courses/:courseId/modules", getAllModules);
courseRouter.get("/modules/:moduleId", getSingleModule);
courseRouter.put("/modules/:moduleId", updateModule);
courseRouter.delete("/modules/:moduleId", deleteModule);

// MCQ routes
courseRouter.post("/courses/:courseId/modules/:moduleId/mcq", createMCQ);
courseRouter.get("/courses/:courseId/modules/:moduleId/mcq", getMCQ);
courseRouter.get("/courses/:courseId/modules/:moduleId/mcq/:mcqId", getMCQById);
courseRouter.put("/courses/:courseId/modules/:moduleId/mcq/:mcqId", updateMCQ);
courseRouter.delete(
  "/courses/:courseId/modules/:moduleId/mcq/:mcqId",
  deleteMCQ,
);
courseRouter.get(
  "/courses/:courseId/modules/:moduleId/mcq/retake",
  getMCQRetakeStatus,
);

// Day content routes
courseRouter.post("/modules/:moduleId/day/:dayId/content", addDayContent);
courseRouter.get("/modules/:moduleId/day/:dayId", getDayContent);
courseRouter.put("/modules/:moduleId/day/:dayId/content", updateDayContent);
courseRouter.delete("/modules/:moduleId/day/:dayId/content", deleteDayContent);
courseRouter.patch(
  "/modules/:moduleId/day/:dayId/complete",
  markDayAsCompleted,
);

// Analytics routes
courseRouter.get("/batches", getInstructorBatches);
courseRouter.get("/batches/:batchId/courses", getBatchCourses);
courseRouter.get(
  "/batches/:batchId/courses/:courseId/progress",
  getBatchCourseProgress,
);
courseRouter.get(
  "/batches/:batchId/courses/:courseId/tests",
  getBatchCourseTests,
);
courseRouter.get(
  "/batches/:batchId/courses/:courseId/test-stats",
  getBatchCourseTestStats,
);
courseRouter.get(
  "/batches/:batchId/courses/:courseId/leaderboard",
  getBatchCourseLeaderboard,
);

// General analytics endpoints that components expect
courseRouter.get("/analytics/students", getSystemWideStudentAnalytics);
courseRouter.get("/analytics/progress", getSystemWideStudentAnalytics); // Reuse for now
courseRouter.get("/analytics/tests", getBatchCourseTests); // Reuse for now
courseRouter.get("/analytics/batches", getInstructorBatches); // Reuse for now

export default courseRouter;
