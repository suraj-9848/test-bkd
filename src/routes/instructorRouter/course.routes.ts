import express from "express";
import {
  createCourse,
  fetchCourse,
  updateCourse,
  deleteCourse,
  fetchAllCoursesAcrossBatches,
  assignCourseToStudent,
  getCourseAnalytics,
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
} from "../../controllers/moduleControllers/moduleMCQControllers";

import { authMiddleware } from "../../middleware/authMiddleware";
import { instructorMiddleware } from "../../middleware/instructorMiddleware";

const courseRouter = express.Router();

// Apply middleware
courseRouter.use(authMiddleware, instructorMiddleware);

// Direct course routes (not nested under batch)
courseRouter.get("/courses", fetchAllCoursesAcrossBatches);
courseRouter.get("/courses/:id", fetchCourse);
courseRouter.put("/courses/:id", updateCourse);
courseRouter.delete("/courses/:id", deleteCourse);
courseRouter.post("/courses/:courseId/assign-student", assignCourseToStudent);
courseRouter.get("/courses/:id/analytics", getCourseAnalytics);

// Module routes for direct course access
courseRouter.get("/courses/:courseId/modules", getAllModules);
courseRouter.post("/courses/:courseId/modules", createModule);
courseRouter.get("/courses/:courseId/modules/:moduleId", getSingleModule);
courseRouter.put("/courses/:courseId/modules/:moduleId", updateModule);
courseRouter.delete("/courses/:courseId/modules/:moduleId", deleteModule);

// MCQ routes for direct course access
courseRouter.get("/courses/:courseId/modules/:moduleId/mcq", getMCQ);
courseRouter.post("/courses/:courseId/modules/:moduleId/mcq", createMCQ);
courseRouter.put("/courses/:courseId/modules/:moduleId/mcq/:mcqId", updateMCQ);
courseRouter.delete("/courses/:courseId/modules/:moduleId/mcq/:mcqId", deleteMCQ);

export default courseRouter;
