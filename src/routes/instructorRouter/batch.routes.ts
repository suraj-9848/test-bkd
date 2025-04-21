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
  fetchCoursesInBatch, 
  assigningStudent,
} from "../../controllers/instructorControllers/course.controller";

const router = express.Router();
router.use(authMiddleware, instructorMiddleware);

// ─── Batch CRUD ────────────────────────────────────────────────────────────────
router.post("/", createBatch);
router.get("/", fetchAllBatches);
router.get("/public", fetchPublicBatches);
router.get("/:id", fetchBatch);
router.put("/:id", updateBatch);
router.delete("/:id", deleteBatch);

// Toggle public/private
router.patch("/:id/visibility", toggleBatchVisibility);

// List public courses (student‑facing)
router.get("/:id/public-courses", fetchPublicCoursesInBatch);

// ─── Nested Course CRUD ───────────────────────────────────────────────────────
router.post("/:batchId/courses", createCourse);
router.get("/:batchId/courses", fetchCoursesInBatch);
router.get("/:batchId/courses/:id", fetchCourse);
router.put("/:batchId/courses/:id", updateCourse);
router.delete("/:batchId/courses/:id", deleteCourse);
router.post("/:batchId/courses/:courseId/assign-student", assigningStudent);

export const instructorRouter = router;
