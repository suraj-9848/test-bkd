import { Request, Response, NextFunction } from "express";
import { checkProSubscriptionStatus } from "../controllers/studentControllers/proSubscriptionController";

// Middleware to check if user has active pro subscription
export const checkProSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // If no authenticated user, treat as free user
    if (!req.user) {
      (req as any).isProUser = false;
      return next();
    }

    const userId = (req.user as any).id;
    const hasProSubscription = await checkProSubscriptionStatus(userId);

    (req as any).isProUser = hasProSubscription;
    next();
  } catch (error) {
    console.error("Error checking pro subscription:", error);
    (req as any).isProUser = false;
    next();
  }
};

// Middleware to require pro subscription for certain features
export const requireProSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userId = (req.user as any).id;
    const hasProSubscription = await checkProSubscriptionStatus(userId);

    if (!hasProSubscription) {
      return res.status(403).json({
        success: false,
        message: "Pro subscription required for this feature",
        requiresUpgrade: true,
      });
    }

    (req as any).isProUser = true;
    next();
  } catch (error) {
    console.error("Error checking pro subscription requirement:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify subscription status",
    });
  }
};

// Middleware to add pro status to user object
export const addProStatusToUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (req.user) {
      const userId = (req.user as any).id;
      const hasProSubscription = await checkProSubscriptionStatus(userId);
      (req.user as any).isProUser = hasProSubscription;
    }
    next();
  } catch (error) {
    console.error("Error adding pro status to user:", error);
    if (req.user) {
      (req.user as any).isProUser = false;
    }
    next();
  }
};
