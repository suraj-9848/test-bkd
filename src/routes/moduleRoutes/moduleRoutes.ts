import express from "express";

import {
  createMCQ,
  deleteMCQ,
  getMCQById,
  updateMCQ,
} from "../../controllers/moduleControllers/moduleMCQControllers";
import { instructorMiddleware } from "../../middleware/instructorMiddleware";
import {
  addDayContent,
  deleteDayContent,
  getDayContent,
  markDayAsCompleted,
  updateDayContent,
} from "../../controllers/moduleControllers/dayContentControllers";
import { authMiddleware } from "../../middleware/authMiddleware";
import {
  createModule,
  deleteModule,
  getAllModules,
  getSingleModule,
  updateModule,
} from "../../controllers/moduleControllers/moduleControllers";

const router = express.Router();

router.use(authMiddleware,instructorMiddleware);

// Day Content Routes
router.post("/modules/:moduleId/day-content", addDayContent);
router.get("/modules/:moduleId/day-content", getDayContent);
router.put("/day-content/:dayId", updateDayContent);
router.delete("/day-content/:dayId", deleteDayContent);
router.patch("/day-content/:dayId/complete", markDayAsCompleted);

router.post("/courses/:courseId/modules", createModule);
router.get("/courses/:courseId/modules", getAllModules);
router.get("/modules/:moduleId", getSingleModule);
router.put("/modules/:moduleId", updateModule);
router.delete("/modules/:moduleId", deleteModule);

// MCQ Routes
router.post("/modules/:moduleId/mcq", createMCQ);
router.get("/mcq/:mcqId", getMCQById);
router.put("/mcq/:mcqId", updateMCQ);
router.delete("/mcq/:mcqId", deleteMCQ);

export const moduleRouter = router;
