import { Request, Response, NextFunction } from "express";

export const instructorMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user || req.user.userRole !== "instructor") {
    return res.status(403).json({ error: "Access Denied, Only Instructors" });
  }
  next();
};
