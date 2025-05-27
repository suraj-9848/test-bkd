import express from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { adminMiddleware } from "../../middleware/adminMiddleware";
import {
  validateJobBody,
  validateApplicationBody,
} from "../../middleware/hiringMiddleware";
import multer from "multer";

import {
  createJob,
  updateJob,
  deleteJob,
  getAllJobs,
  getJobById,
  updateApplicationStatus,
  getOpenJobs,
  applyForJob,
  getUserApplications,
} from "../../controllers/hiringControllers/hiringController";

export const hiringAdminRouter = express.Router();
export const hiringUserRouter = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow PDF files
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(null, false);
      return cb(new Error("Only PDF files are allowed"));
    }
  },
});

// Admin routes
hiringAdminRouter.use(authMiddleware, adminMiddleware);

hiringAdminRouter.post("/jobs", validateJobBody, createJob);
hiringAdminRouter.put("/jobs/:jobId", updateJob);
hiringAdminRouter.delete("/jobs/:jobId", deleteJob);
hiringAdminRouter.get("/jobs", getAllJobs);
hiringAdminRouter.get("/jobs/:jobId", getJobById);
hiringAdminRouter.put(
  "/applications/:applicationId/status",
  updateApplicationStatus,
);

// User routes
hiringUserRouter.use(authMiddleware);

hiringUserRouter.get("/jobs", getOpenJobs);
hiringUserRouter.post(
  "/jobs/:jobId/apply",
  upload.single("resume"),
  validateApplicationBody,
  applyForJob,
);
hiringUserRouter.get("/applications", getUserApplications);
