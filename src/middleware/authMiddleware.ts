import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config"; // Ensure this points to your config file

// Extend Express Request to include `user`
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  // Check if header exists and starts with "Bearer"
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized. No token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error: any) {
    console.error("Token verification failed:", error.message);
    return res.status(401).json({ error: "Invalid token" });
  }
};
