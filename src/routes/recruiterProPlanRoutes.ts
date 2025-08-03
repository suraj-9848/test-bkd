import { Router } from "express";
import {
  createProPlan,
  getProPlans,
  getProPlan,
  updateProPlan,
  togglePlanStatus,
  deleteProPlan,
  getProPlanAnalytics,
} from "../controllers/recruiterControllers/proPlanController";
import { authMiddleware, requireRole } from "../middleware/authMiddleware";
import { UserRole } from "../db/mysqlModels/User";

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Apply recruiter role requirement to all routes
router.use(requireRole([UserRole.RECRUITER, UserRole.ADMIN]));

// Get all pro plans
router.get("/", getProPlans);

// Create new pro plan
router.post("/", createProPlan);

// Get specific pro plan
router.get("/:id", getProPlan);

// Update pro plan
router.put("/:id", updateProPlan);

// Toggle plan active status
router.post("/:id/toggle-status", togglePlanStatus);

// Delete pro plan
router.delete("/:id", deleteProPlan);

// Get plan analytics
router.get("/:id/analytics", getProPlanAnalytics);

export default router;
