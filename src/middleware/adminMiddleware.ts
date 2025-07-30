import { Request, Response, NextFunction } from "express";
import { UserRole } from "../db/mysqlModels/User";

export const adminMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = req.user;

  console.log("Decoded User:", user);

  if (!user) {
    return res.status(401).json({ 
      message: "Authentication required" 
    });
  }

  // Admin middleware should only allow actual admins, not view-as
  // This is for admin-only functions like user management, system settings, etc.
  if (user.userRole !== UserRole.ADMIN) {
    return res.status(403).json({ 
      message: "Access denied. Administrator access required.",
      error: `Access denied. Required roles: admin`,
      userRole: user.userRole,
      note: "This endpoint requires actual admin privileges"
    });
  }

  console.log(`Admin access granted for user ${user.id}`);
  next();
};
