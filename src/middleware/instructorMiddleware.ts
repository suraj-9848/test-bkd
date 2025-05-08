import { Request, Response, NextFunction } from "express";
import { UserRole } from "../db/mysqlModels/User"; // Import the enum

export const instructorMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = req.user;

  console.log("Decoded User:", user);

  if (!user || user.userRole !== UserRole.INSTRUCTOR) {
    return res
      .status(403)
      .json({ message: "Access denied. Instructors only." });
  }

  next();
};
