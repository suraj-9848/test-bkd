import * as jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { config } from "../../config";
import { AppDataSource } from "../../db/connect";
import { User } from "../../db/mysqlModels/User";
import { getSingleRecord } from "../dbLib/sqlUtils";

const logger = require("../../utils/logger").getLoggerByName("Auth Utils");

interface JWTPayload extends jwt.JwtPayload {
  id: string;
  username: string;
  userRole: string;
  email: string;
}

interface AuthUser {
  id: string;
  username: string;
  userRole: string;
  email: string;
  token?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const userProtect = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let token: string;

    if (req.cookies.jwt) {
      token = req.cookies.jwt;
    } else if (req.cookies.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      for (const cookieName of Object.keys(req.cookies)) {
        res.clearCookie(cookieName);
      }
      return res.status(401).json({
        status: "token_is_expired",
        error: "You are not logged in! Please log in with google.",
      });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET) as JWTPayload;

    if (!decoded || !decoded.id || !decoded.username || !decoded.userRole) {
      throw new Error("Invalid token payload structure");
    }

    req.user = {
      id: decoded.id,
      username: decoded.username,
      userRole: decoded.userRole,
      email: decoded.email || "",
      token: token,
    };

    return next();
  } catch (error) {
    for (const cookieName of Object.keys(req.cookies)) {
      res.clearCookie(cookieName);
    }

    logger.error("Auth error:", error);
    return res.status(401).json({
      status: "token_is_expired",
      message: "You are not logged in! Please log in with google.",
    });
  }
};

export const userProtectWithDB = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let token: string;

    if (req.cookies.jwt || req.cookies.accessToken || req.cookies.token) {
      token = req.cookies.jwt || req.cookies.accessToken || req.cookies.token;
    }

    if (!token) {
      for (const cookieName of Object.keys(req.cookies)) {
        res.clearCookie(cookieName);
      }
      return res.status(401).json({
        status: "token_is_expired",
        error: "You are not logged in!",
      });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET) as JWTPayload;

    if (!decoded || !decoded.id || !decoded.username || !decoded.userRole) {
      throw new Error("Invalid token payload structure");
    }

    const user = await getSingleRecord<User, any>(
      User,
      { where: { id: decoded.id } },
      `user_id_${decoded.id}`,
      true,
      5 * 60,
    );

    if (!user) {
      throw new Error("User not found in database");
    }

    req.user = {
      id: user.id,
      username: user.username,
      userRole: user.userRole,
      email: user.email,
      token: token,
    };

    return next();
  } catch (error) {
    for (const cookieName of Object.keys(req.cookies)) {
      res.clearCookie(cookieName);
    }

    logger.error("Auth with DB error:", error);
    return res.status(401).json({
      status: "token_is_expired",
      message: "Authentication failed. Please log in again.",
    });
  }
};

const signToken = (
  id: string,
  role: string,
  profilePicture: string,
  updatedUsername: boolean,
  firstName: string,
): string => {
  return jwt.sign(
    {
      id,
      username: firstName,
      userRole: role,
      email: "",
      profilePicture,
      updatedUsername,
      firstName,
    },
    config.JWT_SECRET,
    {
      expiresIn: config.JWT_EXPIRES_IN,
    },
  );
};
export const generateModernToken = (user: {
  id: string;
  username: string;
  userRole: string;
  email: string;
}): string => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      userRole: user.userRole,
      email: user.email,
    },
    config.JWT_SECRET,
    {
      expiresIn: config.JWT_EXPIRES_IN,
      issuer: "lms-backend",
      audience: "lms-app",
    },
  );
};

interface CookieOptions {
  domain?: string;
  encode?: (val: string) => string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: boolean | "lax" | "strict" | "none";
  secure?: boolean;
  signed?: boolean;
}

export const createTokenAndSend = async (
  user: any,
  statusCode: number,
  res: Response,
  firstLogin?: boolean,
) => {
  try {
    const token: string = signToken(
      user.id,
      user.role || user.userRole,
      user.avatar || "",
      user.userName || false,
      user.name || user.username,
    );

    const cookieOptions: CookieOptions = {
      maxAge: config.JWT_COOKIE_EXPIRES_IN,
      httpOnly: true,
    };

    if (process.env.NODE_ENV === "production") {
      cookieOptions.secure = true;
      cookieOptions.sameSite = "none";
    }

    res.cookie("jwt", token, cookieOptions);

    const userResponse = { ...user };
    delete userResponse.password;
    delete userResponse.tokens;

    logger.info(`Token created for user: ${user.id}`);

    res.status(statusCode).json({
      status: "success",
      token,
      data: {
        user: userResponse,
      },
    });
  } catch (error) {
    logger.error("ERROR In createTokenAndSend", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to create token",
    });
  }
};

export const createModernTokenAndSend = async (
  user: {
    id: string;
    username: string;
    userRole: string;
    email: string;
  },
  statusCode: number,
  res: Response,
) => {
  try {
    const token = generateModernToken(user);

    const cookieOptions: CookieOptions = {
      maxAge: 15 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    };

    res.cookie("accessToken", token, cookieOptions);
    res.cookie("token", token, cookieOptions);
    res.cookie("jwt", token, {
      ...cookieOptions,
      maxAge: config.JWT_COOKIE_EXPIRES_IN,
    });

    res.status(statusCode).json({
      status: "success",
      token,
      accessToken: token,
      user: {
        id: user.id,
        username: user.username,
        userRole: user.userRole,
        email: user.email,
      },
    });
  } catch (error) {
    logger.error("ERROR In createModernTokenAndSend", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to create token",
    });
  }
};
export const getUserFromToken = (token: string): AuthUser | null => {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as JWTPayload;

    if (!decoded || !decoded.id || !decoded.username || !decoded.userRole) {
      return null;
    }

    return {
      id: decoded.id,
      username: decoded.username,
      userRole: decoded.userRole,
      email: decoded.email || "",
      token: token,
    };
  } catch (error) {
    logger.error("Error extracting user from token:", error);
    return null;
  }
};

export const clearAuthCookies = (res: Response) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite:
      process.env.NODE_ENV === "production"
        ? ("none" as const)
        : ("lax" as const),
    expires: new Date(0),
    path: "/",
  };

  res.cookie("jwt", "", cookieOptions);
  res.cookie("token", "", cookieOptions);
  res.cookie("accessToken", "", cookieOptions);
  res.cookie("refreshToken", "", cookieOptions);
};
export type { AuthUser, JWTPayload };
