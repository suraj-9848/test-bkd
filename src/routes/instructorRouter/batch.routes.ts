// src/routes/instructor/batch.routes.ts
import express from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { instructorMiddleware } from "../../middleware/instructorMiddleware";

import {
  createBatch,
  deleteBatch,
  updateBatch,
  fetchAllBatches,
  fetchBatch,
  toggleBatchVisibility,
  fetchPublicBatches,
  fetchPublicCoursesInBatch,
} from "../../controllers/instructorControllers/batch.controller";

import {
  createCourse,
  fetchCourse,
  updateCourse,
  deleteCourse,
  fetchAllCoursesinBatch,
  assignCourseToStudent,
} from "../../controllers/courseCrudControllers/courseController";

import {
  createTest,
  fetchTestById,
  updateTest,
  deleteTest,
  fetchTestsInCourse,
} from "../../controllers/instructorControllers/test.controller";

const router = express.Router();
router.use(authMiddleware, instructorMiddleware);

router.post("/", createBatch);
router.get("/", fetchAllBatches);
router.get("/public", fetchPublicBatches);
router.get("/:id", fetchBatch);
router.put("/:id", updateBatch);
router.delete("/:id", deleteBatch);

router.patch("/:id/visibility", toggleBatchVisibility);

router.get("/:id/public-courses", fetchPublicCoursesInBatch);

router.post("/:batchId/courses", createCourse);
router.get("/:batchId/courses", fetchAllCoursesinBatch);
router.get("/:batchId/courses/:id", fetchCourse);
router.put("/:batchId/courses/:id", updateCourse);
router.delete("/:batchId/courses/:id", deleteCourse);
router.post(
  "/:batchId/courses/:courseId/assign-student",
  assignCourseToStudent
);
// router.post("/:batchId/courses/:courseId/assign-student", assigningStudent);

router.post("/:batchId/courses/:courseId/tests", createTest);
router.get("/:batchId/courses/:courseId/tests", fetchTestsInCourse);
router.get("/:batchId/courses/:courseId/tests/:testId", fetchTestById);
router.put("/:batchId/courses/:courseId/tests/:testId", updateTest);
router.delete("/:batchId/courses/:courseId/tests/:testId", deleteTest);

export const instructorRouter = router;
