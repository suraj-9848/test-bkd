import { Router } from "express";
import {
  connectCPTracker,
  getMyCPTracker,
  getCPTrackerLeaderboard,
  getCPTrackerByUserId,
  updateCPTrackerByUserId,
  getAllCPTrackers,
  deleteCPTracker,
  getCPTrackerStats,
  refreshCPTrackerData,
  triggerManualUpdateAll,
  triggerManualUpdateBatch,
  getCronJobStatus,
  manageCronJob,
  getUpdateStats,
  createBatchCronJob,
  removeBatchCronJob,
  requestEdit,
  getAllEditRequests,
  approveEditRequest,
  rejectEditRequest,
  getEditRequestById,
} from "../controllers/cpTrackerControllers/cpTrackerController";
import {
  authMiddleware,
  requireRole,
  studentAuthMiddleware,
} from "../middleware/authMiddleware";
import { viewAsMiddleware } from "../middleware/viewAsMiddleware";
import { UserRole } from "../db/mysqlModels/User";

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Student routes
router.post(
  "/connect",
  viewAsMiddleware,
  studentAuthMiddleware,
  connectCPTracker,
);
router.get(
  "/my-profile",
  viewAsMiddleware,
  studentAuthMiddleware,
  getMyCPTracker,
);
router.get("/leaderboard", viewAsMiddleware, getCPTrackerLeaderboard);

// Edit request routes (Student)
router.post(
  "/edit-request",
  viewAsMiddleware,
  studentAuthMiddleware,
  requestEdit,
);

// Admin/Instructor routes
router.get(
  "/users/:userId",
  requireRole([UserRole.ADMIN, UserRole.INSTRUCTOR]),
  getCPTrackerByUserId,
);
router.put(
  "/users/:userId",
  requireRole([UserRole.ADMIN, UserRole.INSTRUCTOR]),
  updateCPTrackerByUserId,
);
router.get(
  "/all",
  requireRole([UserRole.ADMIN, UserRole.INSTRUCTOR]),
  getAllCPTrackers,
);
router.get(
  "/stats",
  requireRole([UserRole.ADMIN, UserRole.INSTRUCTOR]),
  getCPTrackerStats,
);
router.post(
  "/users/:userId/refresh",
  requireRole([UserRole.ADMIN, UserRole.INSTRUCTOR]),
  refreshCPTrackerData,
);

// Edit request management routes (Admin/Instructor)
router.get(
  "/edit-requests",
  requireRole([UserRole.ADMIN, UserRole.INSTRUCTOR]),
  getAllEditRequests,
);
router.get(
  "/edit-requests/:requestId",
  requireRole([UserRole.ADMIN, UserRole.INSTRUCTOR]),
  getEditRequestById,
);
router.post(
  "/edit-requests/:requestId/approve",
  requireRole([UserRole.ADMIN, UserRole.INSTRUCTOR]),
  approveEditRequest,
);
router.post(
  "/edit-requests/:requestId/reject",
  requireRole([UserRole.ADMIN, UserRole.INSTRUCTOR]),
  rejectEditRequest,
);

// Cron Job Management Routes (Admin/Instructor)
router.post(
  "/admin/update-all",
  requireRole([UserRole.ADMIN, UserRole.INSTRUCTOR]),
  triggerManualUpdateAll,
);
router.post(
  "/admin/update-batch/:batchId",
  requireRole([UserRole.ADMIN, UserRole.INSTRUCTOR]),
  triggerManualUpdateBatch,
);
router.get(
  "/admin/cron-status",
  requireRole([UserRole.ADMIN, UserRole.INSTRUCTOR]),
  getCronJobStatus,
);
router.post(
  "/admin/cron/:jobName",
  requireRole([UserRole.ADMIN, UserRole.INSTRUCTOR]),
  manageCronJob,
);
router.get(
  "/admin/update-stats",
  requireRole([UserRole.ADMIN, UserRole.INSTRUCTOR]),
  getUpdateStats,
);

// Custom Batch Cron Jobs (Admin only)
router.post(
  "/admin/batch-cron/:batchId",
  requireRole([UserRole.ADMIN]),
  createBatchCronJob,
);
router.delete(
  "/admin/batch-cron/:batchId",
  requireRole([UserRole.ADMIN]),
  removeBatchCronJob,
);

// Admin only routes
router.delete("/users/:userId", requireRole([UserRole.ADMIN]), deleteCPTracker);

export default router;
