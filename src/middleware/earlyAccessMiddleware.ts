import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { config } from "../config";
import { User, UserRole } from "../db/mysqlModels/User";
import { Job } from "../db/mysqlModels/Job";
import { getSingleRecord } from "../lib/dbLib/sqlUtils";
import { ProSubscriptionService } from "../utils/proSubscriptionService";
import { getLogger } from "../utils/logger";

interface AuthUser {
  id: string;
  username: string;
  userRole: string;
  email: string;
  token?: string;
}

// Extend Express Request to include Pro access properties
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      isProStudent?: boolean;
      isAuthenticated?: boolean;
    }
  }
}

const logger = getLogger();

/**
 * Optional auth middleware that populates req.user if token exists
 * but doesn't fail if no token is provided
 */
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  let token: string | undefined;

  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }
  // Check cookies
  else if (req.cookies) {
    token = req.cookies.accessToken || req.cookies.token;
  }

  if (!token) {
    // No token provided, continue without setting req.user
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;

    if (
      decoded &&
      typeof decoded === "object" &&
      decoded.id &&
      decoded.userRole &&
      decoded.username
    ) {
      // Set basic user info
      req.user = {
        id: decoded.id,
        username: decoded.username,
        userRole: decoded.userRole,
        email: decoded.email || "",
        token,
      };
    }
  } catch (error) {
    // Token is invalid, but don't fail - just continue without setting req.user
    logger.warn("Invalid token in optional auth middleware:", error);
  }

  next();
};

/**
 * Middleware to check if a job is available for early access by Pro students
 * Used for job viewing and application endpoints
 */
export const checkJobEarlyAccess = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { jobId } = req.params;
    const userId = req.user?.id;

    if (!jobId) {
      res.status(400).json({
        message: "Job ID is required",
        success: false,
      });
      return;
    }

    // Fetch the job
    const job = await getSingleRecord(Job, {
      where: { id: jobId },
      relations: ["organization"],
    });

    if (!job) {
      res.status(404).json({
        message: "Job not found",
        success: false,
      });
      return;
    }

    // Calculate if job is in early access period (first 24 hours)
    const jobCreatedAt = new Date(job.createdAt);
    const now = new Date();
    const earlyAccessPeriodEnd = new Date(
      jobCreatedAt.getTime() + 24 * 60 * 60 * 1000,
    ); // 24 hours
    const isInEarlyAccessPeriod = now < earlyAccessPeriodEnd;

    // If not in early access period, allow access to everyone
    if (!isInEarlyAccessPeriod) {
      next();
      return;
    }

    // If in early access period, check if user is a Pro student
    if (!userId) {
      res.status(403).json({
        message: "Early Access Required",
        details:
          "This job posting is currently in early access period (first 24 hours). Only Pro subscribers can view and apply to jobs during this period.",
        earlyAccessUntil: earlyAccessPeriodEnd.toISOString(),
        success: false,
      });
      return;
    }

    // Check if user is a student
    const user = await getSingleRecord(User, {
      where: { id: userId },
    });

    if (!user || user.userRole !== UserRole.STUDENT) {
      res.status(403).json({
        message: "Student Access Required",
        details:
          "Only students can access job postings during early access period.",
        success: false,
      });
      return;
    }

    // Check if student has active Pro subscription
    const isProStudent = await ProSubscriptionService.isProStudent(userId);

    if (!isProStudent) {
      res.status(403).json({
        message: "Pro Subscription Required",
        details:
          "This job posting is currently in early access period (first 24 hours). Upgrade to Pro to access jobs immediately when they're posted!",
        earlyAccessUntil: earlyAccessPeriodEnd.toISOString(),
        upgradeUrl: "/pro/subscribe",
        success: false,
      });
      return;
    }

    // User has active Pro subscription, allow access
    logger.info(
      `Pro student ${userId} accessing job ${jobId} during early access period`,
    );
    next();
  } catch (error) {
    logger.error("Error in checkJobEarlyAccess middleware:", error);
    res.status(500).json({
      message: "Failed to check job access permissions",
      success: false,
    });
  }
};

/**
 * Middleware to filter jobs based on Pro subscription status for job listings
 * This is used for the getOpenJobs endpoint
 */
export const filterJobsByProAccess = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.id;

    // Determine if user is a Pro student
    let isProStudent = false;

    if (userId) {
      const user = await getSingleRecord(User, {
        where: { id: userId },
      });

      if (user && user.userRole === UserRole.STUDENT) {
        isProStudent = await ProSubscriptionService.isProStudent(userId);
      }
    }

    // Add Pro status to request for use in controller
    req.isProStudent = isProStudent;
    req.isAuthenticated = !!userId;

    next();
  } catch (error) {
    logger.error("Error in filterJobsByProAccess middleware:", error);
    res.status(500).json({
      message: "Failed to determine user access level",
      success: false,
    });
  }
};

/**
 * Helper function to determine if a job is in early access period
 */
export const isJobInEarlyAccess = (jobCreatedAt: Date): boolean => {
  const now = new Date();
  const earlyAccessPeriodEnd = new Date(
    jobCreatedAt.getTime() + 24 * 60 * 60 * 1000,
  ); // 24 hours
  return now < earlyAccessPeriodEnd;
};

/**
 * Helper function to get early access end time for a job
 */
export const getEarlyAccessEndTime = (jobCreatedAt: Date): Date => {
  return new Date(jobCreatedAt.getTime() + 24 * 60 * 60 * 1000); // 24 hours
};
