import { Request, Response, NextFunction } from "express";
import { UserRole } from "../db/mysqlModels/User"; // import the enum

export const adminMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = req.user;

  console.log("Decoded User:", user);

  if (!user || user.userRole !== UserRole.ADMIN) {
    return res.status(403).json({ message: "Access denied. Admins only." });
  }

  next();
};
