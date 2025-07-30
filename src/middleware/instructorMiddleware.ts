import { Request, Response, NextFunction } from "express";
import { UserRole } from "../db/mysqlModels/User";
import { getEffectiveUserRole } from "./viewAsMiddleware";

export const instructorMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ 
      message: "Authentication required" 
    });
  }

  // Get the effective role (considering view-as functionality)
  const effectiveRole = getEffectiveUserRole(req);
  
  // Allow actual instructors, admins, or admins viewing as instructors
  if (effectiveRole !== UserRole.INSTRUCTOR && user.userRole !== UserRole.ADMIN) {
    return res.status(403).json({ 
      message: "Access denied. Instructor or admin access required.",
      error: `Access denied. Required roles: instructor, admin`,
      userRole: effectiveRole,
      actualRole: user.userRole,
      isViewingAs: req.isViewingAs,
      originalRole: req.originalUserRole
    });
  }

  next();
};
