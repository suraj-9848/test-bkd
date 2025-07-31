// src/middleware/authMiddleware.ts - Enhanced version with full User entity support
import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { config } from "../config";
import { OAuth2Client } from "google-auth-library";

import { User, UserRole } from "../db/mysqlModels/User";
import { getSingleRecord } from "../lib/dbLib/sqlUtils";
import { getLogger } from "../utils/logger";

const logger = getLogger();

// Basic auth user interface (from token)
interface AuthUser {
  id: string;
  username: string;
  userRole: string;
  email: string;
  token?: string;
}

// Extend Express Request to include both basic and full user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      fullUser?: User; // Full database user entity
    }
  }
}

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyGoogleToken(idToken: string) {
  try {
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    logger.info("Google token verified successfully");
    return payload;
  } catch (error) {
    logger.error("Google token verification failed:", error);
    throw error;
  }
}

/**
 * Enhanced Auth Middleware - Compatible with both old and new token systems
 * Sets req.user with basic info and optionally req.fullUser with complete entity
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let token: string | undefined;

  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }
  // Check cookies - support both new and legacy cookie names
  else if (req.cookies) {
    token = req.cookies.accessToken || req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: "Unauthorized - Token Missing" });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;

    if (
      !decoded ||
      typeof decoded !== "object" ||
      !decoded.id ||
      !decoded.userRole ||
      !decoded.username
    ) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    // Set basic user info
    req.user = {
      id: decoded.id,
      username: decoded.username,
      userRole: decoded.userRole,
      email: decoded.email || "",
      token,
    };

    // Fetch full user entity from database
    try {
      const fullUser = await getSingleRecord<User, any>(
        User,
        { where: { id: decoded.id } },
        `user_id_${decoded.id}`,
        true,
        5 * 60, // 5 minute cache
      );

      if (fullUser) {
        req.fullUser = fullUser;
        // Also update req.user with fresh data from DB
        req.user = {
          id: fullUser.id,
          username: fullUser.username,
          userRole: fullUser.userRole,
          email: fullUser.email,
          token,
        };
      }
    } catch (dbError) {
      logger.error("Error fetching full user:", dbError);
      // Continue with basic user info if DB fetch fails
    }

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token expired",
        code: "TOKEN_EXPIRED",
      });
    }
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

/**
 * Auth middleware that requires full user entity
 * Use this when you need the complete User object with all relations
 */
export const authMiddlewareWithFullUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // First run standard auth
  await new Promise<void>((resolve, reject) => {
    authMiddleware(req, res, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  // Check if we have the full user
  if (!req.fullUser) {
    // Try to fetch it if not already available
    if (req.user) {
      try {
        const fullUser = await getSingleRecord<User, any>(
          User,
          { where: { id: req.user.id } },
          `user_id_${req.user.id}`,
          false, // Don't cache for this critical fetch
          5 * 60,
        );

        if (!fullUser) {
          return res.status(404).json({ error: "User not found in database" });
        }

        req.fullUser = fullUser;
      } catch (error) {
        logger.error("Error fetching full user entity:", error);
        return res.status(500).json({ error: "Failed to fetch user data" });
      }
    } else {
      return res.status(401).json({ error: "Authentication required" });
    }
  }

  next();
};

/**
 * Utility middleware to ensure req.user is a full User entity
 * This modifies req.user to be the full database entity
 */
export const ensureFullUserEntity = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const fullUser = await getSingleRecord<User, any>(
      User,
      { where: { id: req.user.id } },
      `user_id_${req.user.id}`,
      true,
      5 * 60,
    );

    if (!fullUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Replace req.user with the full entity
    req.user = fullUser as any;
    req.fullUser = fullUser;

    next();
  } catch (error) {
    logger.error("Error ensuring full user entity:", error);
    return res.status(500).json({ error: "Failed to fetch user data" });
  }
};

/**
 * Admin Auth Middleware - For Google OAuth
 */
export const adminAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  const idToken = authHeader?.split(" ")[1];

  if (!idToken) {
    return res.status(400).json({ error: "ID token is required" });
  }

  try {
    const payload = await verifyGoogleToken(idToken);

    const user = await getSingleRecord<User, any>(
      User,
      { where: { email: payload.email } },
      `user_email_${payload.email}`,
      true,
      5 * 60,
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const allowedRoles = [
      UserRole.ADMIN,
      UserRole.RECRUITER,
      UserRole.INSTRUCTOR,
    ];
    if (!allowedRoles.includes(user.userRole)) {
      return res.status(403).json({
        error: "Access denied. Admin or recruiter role required.",
        userRole: user.userRole,
      });
    }

    // Set both basic and full user
    req.user = {
      id: user.id,
      username: user.username,
      userRole: user.userRole,
      email: user.email,
    };
    req.fullUser = user;

    logger.info(`Admin authenticated: ${user.email} (${user.userRole})`);
    next();
  } catch (error) {
    logger.error("Admin auth error:", error);
    return res.status(401).json({ error: "Authentication failed" });
  }
};

/**
 * Role-based Authorization Middleware Factory
 */
export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    if (!allowedRoles.includes(req.user.userRole as UserRole)) {
      return res.status(403).json({
        error: `Access denied. Required roles: ${allowedRoles.join(", ")}`,
        userRole: req.user.userRole,
      });
    }

    next();
  };
};

/**
 * Student-specific middleware that ensures full User entity
 * Supports both direct student access and admin "view as" functionality
 */
export const studentAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // First authenticate
    await new Promise<void>((resolve, reject) => {
      authMiddleware(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    // Get effective user role (considering "view as" functionality)
    const effectiveRole = req.viewAsRole || req.user.userRole;
    const originalRole = req.originalUserRole || req.user.userRole;

    console.log("🔍 Student Auth Debug:", {
      userId: req.user.id,
      originalRole,
      effectiveRole,
      isViewingAs: req.isViewingAs,
      userRoleFromToken: req.user.userRole,
      headers: {
        "x-view-as-role": req.headers["x-view-as-role"],
        authorization: req.headers.authorization
          ? "Bearer [REDACTED]"
          : "Not provided",
      },
    });

    // Allow access if:
    // 1. User is actually a student, OR
    // 2. User is an admin viewing as a student
    const isStudentAccess = effectiveRole === UserRole.STUDENT;
    const isAdminViewingAsStudent =
      originalRole === UserRole.ADMIN && effectiveRole === UserRole.STUDENT;

    if (!isStudentAccess && !isAdminViewingAsStudent) {
      console.log("❌ Student access denied:", {
        userId: req.user.id,
        originalRole,
        effectiveRole,
        reason: "Neither student nor admin viewing as student",
      });

      return res.status(403).json({
        error: "Access denied. Student role required.",
        userRole: req.user.userRole,
        effectiveRole,
        originalRole,
        isViewingAs: req.isViewingAs,
        debug: "User must be a student or admin viewing as student",
      });
    }

    // Ensure we have full user entity
    await new Promise<void>((resolve, reject) => {
      ensureFullUserEntity(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    console.log("✅ Student access granted:", {
      userId: req.user.id,
      originalRole,
      effectiveRole,
      isViewingAs: req.isViewingAs,
    });

    next();
  } catch (error) {
    console.error("❌ Error in studentAuthMiddleware:", error);
    return res.status(500).json({
      error: "Internal authentication error",
      details: error.message,
    });
  }
};

/**
 * Optional Authentication Middleware
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.cookies) {
      token = req.cookies.accessToken || req.cookies.token;
    }

    if (!token) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as any;

      if (decoded && decoded.id) {
        const user = await getSingleRecord<User, any>(
          User,
          { where: { id: decoded.id } },
          `user_id_${decoded.id}`,
          true,
          5 * 60,
        );

        if (user) {
          req.user = {
            id: user.id,
            username: user.username,
            userRole: user.userRole,
            email: user.email,
            token,
          };
          req.fullUser = user;
        }
      }
    } catch (error) {
      logger.debug("Optional auth token invalid:", error.message);
    }

    next();
  } catch (error) {
    logger.error("Optional auth error:", error);
    next();
  }
};

export const userProtect = authMiddleware;
