import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { config } from "../config";
import { decode } from "punycode";

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
  next: NextFunction,
) => {
  // Look for token in multiple places
  let token: string | undefined;

  // First check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }
  // If not in header, check cookies
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // If no token found in either location
  if (!token) {
    return res.status(401).json({ error: "Unauthorized, Token Missing" });
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
      return res.status(401).json({ error: "Invalid token payload." });
    }

    req.user = {
      ...(decoded as any),
      token,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
};
