import { Request, Response, NextFunction } from "express";
import { UserRole } from "../db/mysqlModels/User";
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from "../db/mysqlModels/Subscription";

// Middleware to check if user is authenticated and has recruiter role
export const recruiterMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Ensure authentication middleware has set req.user
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  // Case-insensitive role check
  const role = (user.userRole || "").toLowerCase();
  if (role !== UserRole.RECRUITER.toLowerCase()) {
    return res
      .status(403)
      .json({ message: "Access denied. Recruiter role required." });
  }
  next();
};

// Middleware to check if a user has a pro subscription
export const checkProSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    // Check for active pro subscription
    const subscriptionExists = await Subscription.count({
      where: {
        user_id: user.id,
        status: SubscriptionStatus.ACTIVE,
        plan: SubscriptionPlan.PRO,
      },
    });
    if (!subscriptionExists) {
      return res.status(403).json({ message: "Pro subscription required" });
    }
    next();
  } catch (error) {
    console.error("Error checking pro subscription:", error);
    res.status(500).json({ message: "Server error" });
  }
};
