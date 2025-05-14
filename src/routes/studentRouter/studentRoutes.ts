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
  getModuleCompletionStatus,
} from "../../controllers/studentController/studentController";
import { authMiddleware } from "../../middleware/authMiddleware";

const router = express.Router();

router.use(authMiddleware);

router.get("/courses", getStudentCourses);
router.get("/courses/:courseId", getStudentCourseById);
router.get("/courses/:courseId/modules", getStudentCourseModules);
router.get("/modules/:moduleId", getStudentModuleById);
router.get("/day-contents/:dayId", getStudentDayContentById);
router.patch("/day-contents/:dayId/complete", markDayAsCompleted);
router.get("/modules/:moduleId/mcq", getStudentModuleMCQ);
router.post("/modules/:moduleId/mcq/responses", submitMCQResponses);
router.get("/modules/:moduleId/mcq/results", getMCQResults);
router.get("/modules/:moduleId/completion", getModuleCompletionStatus);

export { router as studentRouter };
