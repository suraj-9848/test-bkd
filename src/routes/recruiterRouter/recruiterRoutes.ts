import { Router } from "express";
import {
  createSubscription,
  deleteSubscription,
  getSubscriptions,
  updateSubscription,
} from "../../controllers/recruiterControllers/subscriptionController";
import {
  createJob,
  deleteJob,
  getJobById,
  getJobs,
  updateJob,
} from "../../controllers/recruiterControllers/jobController";
import { getApplications } from "../../controllers/recruiterControllers/applicationController";
import { getDashboardData } from "../../controllers/recruiterControllers/dashboardController";
import { authMiddleware, requireRole } from "../../middleware/authMiddleware";
import { UserRole } from "../../db/mysqlModels/User";
import recruiterProPlanRoutes from "../recruiterProPlanRoutes";

const recruiterRouter = Router();

// Apply authentication and recruiter role verification
recruiterRouter.use(
  authMiddleware,
  requireRole([UserRole.RECRUITER, UserRole.ADMIN]),
);

// Recruiter Dashboard
recruiterRouter.get("/dashboard", getDashboardData);

// Subscription Management
recruiterRouter.post("/subscriptions", createSubscription);
recruiterRouter.get("/subscriptions", getSubscriptions);
recruiterRouter.put("/subscriptions/:subscriptionId", updateSubscription);
recruiterRouter.delete("/subscriptions/:subscriptionId", deleteSubscription);

// Job Management
recruiterRouter.post("/jobs", createJob);
recruiterRouter.get("/jobs", getJobs);
recruiterRouter.get("/jobs/:jobId", getJobById);
recruiterRouter.put("/jobs/:jobId", updateJob);
recruiterRouter.delete("/jobs/:jobId", deleteJob);

// Application Management
recruiterRouter.get("/applications", getApplications);

// Mount pro plan routes
recruiterRouter.use("/pro-plans", recruiterProPlanRoutes);

export default recruiterRouter;
