import { Router } from "express";
import {
  getAvailablePlans,
  createSubscriptionOrder,
  verifyPayment,
  getCurrentSubscription,
  cancelSubscription,
  getSubscriptionHistory,
} from "../controllers/studentControllers/proSubscriptionController";
import { authMiddleware } from "../middleware/authMiddleware";
import { checkProSubscription } from "../middleware/proSubscriptionMiddleware";

const router = Router();

// Get available pro plans for students (public endpoint)
router.get("/plans", getAvailablePlans);

// Apply authentication middleware to routes that require authentication
router.use(authMiddleware);

// Create Razorpay order for subscription
router.post("/create-order", createSubscriptionOrder);

// Verify payment and activate subscription
router.post("/verify-payment", verifyPayment);

// Get current subscription status
router.get("/current", checkProSubscription, getCurrentSubscription);

// Cancel subscription
router.post("/:subscription_id/cancel", cancelSubscription);

// Get subscription history
router.get("/history", getSubscriptionHistory);

export default router;
