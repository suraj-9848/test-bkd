import { Request, Response, NextFunction } from "express";
import { getSingleRecord } from "../lib/dbLib/sqlUtils";
import {
  Subscription,
  SubscriptionStatus,
  SubscriptionPlan,
} from "../db/mysqlModels/Subscription";

// Middleware to set isProUser flag based on active pro subscription
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
    const subscription = await getSingleRecord(Subscription, {
      where: {
        user_id: userId,
        status: SubscriptionStatus.ACTIVE,
        plan: SubscriptionPlan.PRO,
      },
    });
    (req as any).isProUser = !!subscription;
    next();
  } catch (error) {
    console.error("Error checking subscription:", error);
    (req as any).isProUser = false;
    next();
  }
};
