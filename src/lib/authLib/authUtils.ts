import * as jwt from "jsonwebtoken";
import { Request, Response } from "express";
import { config } from "../../config";
const logger = require("../../utils/logger").getLoggerByName("Auth Utils");

export const userProtect = async (req: Request, res: Response, next: any) => {
  try {
    let token: string;

    if (req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      for (let i of Object.keys(req.cookies)) {
        res.clearCookie(i);
      }
      return res.status(401).json({
        status: "token_is_expired",
        error: "You are not logged in! Please log in with google.",
      });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET) as jwt.JwtPayload;
    req["user"] = { ...decoded, token };
    return next();
  } catch (error) {
    for (let i of Object.keys(req.cookies)) {
      res.clearCookie(i);
    }
    logger.error(error);
    return res.status(401).json({
      status: "token_is_expired",
      message: "You are not logged in! Please log in with google.",
    });
  }
};

const signToken = (
  id: string,
  role: string,
  profilePicture: string,
  updatedUsername: boolean,
  firstName: string,
) => {
  return jwt.sign(
    { id, role, profilePicture, updatedUsername, firstName },
    config.JWT_SECRET,
    {
      expiresIn: config.JWT_EXPIRES_IN,
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
      user.role,
      user.avatar,
      user.userName,
      user.name,
    );

    const cookieOptions: CookieOptions = {
      maxAge: config.JWT_COOKIE_EXPIRES_IN,
      httpOnly: true,
    };

    if (process.env.NODE_ENV === "production") cookieOptions.secure = true;

    res.cookie("jwt", token, cookieOptions);

    user.tokens = undefined;
    logger.info(user, token);
    res.status(statusCode).json({
      status: "success",
      token,
      data: {
        user,
      },
    });
  } catch (error) {
    logger.error("ERROR In createTokenAndSend", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
