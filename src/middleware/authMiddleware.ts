import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { config } from "../config";
import { decode } from "punycode";
import { OAuth2Client } from "google-auth-library";
import { AppDataSource } from "../db/connect";
import { User } from "../db/mysqlModels/User";
import { getSingleRecord } from "../lib/dbLib/sqlUtils";

// Extend Express Request to include `user`
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const userRepository = AppDataSource.getRepository(User);

async function verifyGoogleToken(idToken:string) {
  try {
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    console.log("Google token verified successfully", ticket);

    const payload = ticket.getPayload();
    return payload; // Contains user info
  } catch (error) {
    console.error("Google token verification failed:", error);
    throw error;
  }
}

export const adminAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const idToken = authHeader?.split(" ")[1];

  if (!idToken) {
    return res.status(400).json({ error: "ID token is required" });
  }

  try {
    const payload = await verifyGoogleToken(idToken);

    let user = await getSingleRecord<User, any>(
      User,
      { where: { email: payload.email } },
      `user_email_${payload.email}`,
      true,
      10 * 60
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.userRole.toLowerCase() !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin role required." });
    }

    // Set user info in request object for downstream middleware/routes
    req.user = {
      id: user.id,
      username: user.username,
      userRole: user.userRole,
      email: user.email,
    };

    next();
  } catch (error) {
    console.error("Admin auth error:", error);
    return res.status(401).json({ error: "Authentication failed" });
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
}
