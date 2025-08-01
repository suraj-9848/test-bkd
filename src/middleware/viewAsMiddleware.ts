import { Request, Response, NextFunction } from "express";
import { UserRole } from "../db/mysqlModels/User";
import { getLoggerByName } from "../utils/logger";

const logger = getLoggerByName("viewAsMiddleware");

/**
 * Interface to extend the Request object with viewAs functionality
 */
declare global {
  namespace Express {
    interface Request {
      viewAsRole?: UserRole;
      originalUserRole?: UserRole;
      isViewingAs?: boolean;
    }
  }
}

/**
 * Middleware to handle "view as" functionality for admin users
 * Allows admins to view the system from different role perspectives
 */
export const viewAsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return next(); // Let auth middleware handle this
    }

    // Get the view-as role from request headers or query params
    const viewAsRole = req.headers["x-view-as-role"] || req.query.viewAs;

    // Store original user role
    req.originalUserRole = req.user.userRole as UserRole;

    // Only allow admins to use view-as functionality
    if (req.user.userRole === UserRole.ADMIN && viewAsRole) {
      const requestedRole = viewAsRole as string;

      // Validate the requested role
      const validRoles = Object.values(UserRole);
      if (validRoles.includes(requestedRole as UserRole)) {
        req.viewAsRole = requestedRole as UserRole;
        req.isViewingAs = true;

        // Temporarily change the user role for downstream middleware/controllers
        req.user.userRole = requestedRole as UserRole;

        logger.info(`Admin ${req.user.id} viewing as ${requestedRole}`);
      } else {
        logger.warn(
          `Invalid view-as role requested: ${requestedRole} by user ${req.user.id}`,
        );
      }
    } else if (viewAsRole && req.user.userRole !== UserRole.ADMIN) {
      // Non-admin users cannot use view-as functionality
      logger.warn(
        `Non-admin user ${req.user.id} attempted to use view-as functionality`,
      );
    }

    // Set default values if not viewing as another role
    if (!req.isViewingAs) {
      req.viewAsRole = req.user.userRole as UserRole;
      req.isViewingAs = false;
    }

    next();
  } catch (error) {
    logger.error("Error in viewAsMiddleware:", error);
    next(error);
  }
};

/**
 * Role-based Authorization Middleware that respects view-as functionality
 * This replaces the original requireRole middleware
 */
export const requireRoleWithViewAs = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    // Use the effective role (which might be the view-as role for admins)
    const effectiveRole = req.viewAsRole || (req.user.userRole as UserRole);

    if (!allowedRoles.includes(effectiveRole)) {
      return res.status(403).json({
        error: `Access denied. Required roles: ${allowedRoles.join(", ")}`,
        userRole: effectiveRole,
        isViewingAs: req.isViewingAs,
        originalRole: req.originalUserRole,
      });
    }

    // Log view-as usage for audit purposes
    if (req.isViewingAs) {
      logger.info(
        `Admin ${req.user.id} (${req.originalUserRole}) accessing ${req.method} ${req.path} as ${effectiveRole}`,
      );
    }

    next();
  };
};

/**
 * Middleware to ensure only admins can use view-as functionality
 */
export const adminOnlyViewAs = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // If viewing as another role, ensure the original user is admin
  if (req.isViewingAs && req.originalUserRole !== UserRole.ADMIN) {
    return res.status(403).json({
      error: "Only administrators can use view-as functionality",
      originalRole: req.originalUserRole,
    });
  }

  next();
};

/**
 * Utility function to get effective user role (respects view-as)
 */
export const getEffectiveUserRole = (req: Request): UserRole => {
  return req.viewAsRole || (req.user?.userRole as UserRole);
};

/**
 * Utility function to check if user is currently viewing as another role
 */
export const isCurrentlyViewingAs = (req: Request): boolean => {
  return req.isViewingAs || false;
};

/**
 * Middleware to add view-as information to response headers (for debugging)
 */
export const addViewAsHeaders = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.isViewingAs) {
    res.setHeader("X-Viewing-As", req.viewAsRole || "");
    res.setHeader("X-Original-Role", req.originalUserRole || "");
    res.setHeader("X-Is-Viewing-As", "true");
  }

  next();
};

/**
 * Enhanced instructor middleware that respects view-as functionality
 */
export const instructorMiddlewareWithViewAs = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const effectiveRole = getEffectiveUserRole(req);

  if (effectiveRole !== UserRole.INSTRUCTOR) {
    return res.status(403).json({
      message: "Access denied. Instructors only.",
      effectiveRole,
      isViewingAs: req.isViewingAs,
      originalRole: req.originalUserRole,
    });
  }

  next();
};

/**
 * Enhanced admin middleware that respects view-as functionality
 */
export const adminMiddlewareWithViewAs = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const effectiveRole = getEffectiveUserRole(req);

  if (effectiveRole !== UserRole.ADMIN) {
    return res.status(403).json({
      message: "Access denied. Admins only.",
      effectiveRole,
      isViewingAs: req.isViewingAs,
      originalRole: req.originalUserRole,
    });
  }

  next();
};

/**
 * Student middleware with view-as support
 */
export const studentMiddlewareWithViewAs = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const effectiveRole = getEffectiveUserRole(req);

  if (effectiveRole !== UserRole.STUDENT) {
    return res.status(403).json({
      message: "Access denied. Students only.",
      effectiveRole,
      isViewingAs: req.isViewingAs,
      originalRole: req.originalUserRole,
    });
  }

  next();
};

/**
 * Recruiter middleware with view-as support
 */
export const recruiterMiddlewareWithViewAs = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const effectiveRole = getEffectiveUserRole(req);

  if (effectiveRole !== UserRole.RECRUITER) {
    return res.status(403).json({
      message: "Access denied. Recruiters only.",
      effectiveRole,
      isViewingAs: req.isViewingAs,
      originalRole: req.originalUserRole,
    });
  }

  next();
};
