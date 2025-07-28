import jwt from "jsonwebtoken";
import { config } from "../config";
import { AppDataSource } from "../db/connect";
import { RefreshToken } from "../db/mysqlModels/RefreshToken";

const logger = require("./logger").getLoggerByName("Auth Utils");
const refreshTokenRepository = AppDataSource.getRepository(RefreshToken);

/**
 * Token generation utilities
 */
export const generateAccessToken = (user: any): string => {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      userRole: user.userRole,
      email: user.email 
    },
    config.JWT_SECRET,
    { 
      expiresIn: "15m", // Short-lived access token
      issuer: "lms-backend",
      audience: "lms-app"
    }
  );
};

export const generateRefreshToken = (user: any): string => {
  return jwt.sign(
    { 
      id: user.id,
      type: "refresh"
    },
    config.JWT_SECRET,
    { 
      expiresIn: "7d", // Long-lived refresh token
      issuer: "lms-backend",
      audience: "lms-app"
    }
  );
};

/**
 * Cookie configuration functions
 */
export const getAccessTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" as const : "lax" as const,
  maxAge: 15 * 60 * 1000, // 15 minutes
  path: "/",
});

export const getRefreshTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" as const : "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/",
});

/**
 * Refresh token database operations
 */
export const saveRefreshTokenToDB = async (userId: string, token: string, expiresAt: Date) => {
  try {
    // Remove any existing refresh tokens for this user
    await refreshTokenRepository.delete({ user_id: userId });
    
    // Create new refresh token record
    const refreshTokenRecord = refreshTokenRepository.create({
      user_id: userId,
      token,
      expires_at: expiresAt,
    });
    
    await refreshTokenRepository.save(refreshTokenRecord);
    logger.info(`Refresh token saved for user: ${userId}`);
  } catch (error) {
    logger.error("Error saving refresh token:", error);
    throw error;
  }
};

export const getRefreshTokenFromDB = async (token: string): Promise<any> => {
  try {
    return await refreshTokenRepository.findOne({
      where: { token },
      relations: ["user"]
    });
  } catch (error) {
    logger.error("Error getting refresh token:", error);
    return null;
  }
};

export const deleteRefreshTokenFromDB = async (token: string) => {
  try {
    await refreshTokenRepository.delete({ token });
    logger.info("Refresh token deleted from database");
  } catch (error) {
    logger.error("Error deleting refresh token:", error);
  }
};

export const deleteAllUserRefreshTokens = async (userId: string) => {
  try {
    await refreshTokenRepository.delete({ user_id: userId });
    logger.info(`All refresh tokens deleted for user: ${userId}`);
  } catch (error) {
    logger.error("Error deleting user refresh tokens:", error);
  }
};

export const cleanExpiredTokens = async () => {
  try {
    const result = await refreshTokenRepository
      .createQueryBuilder()
      .delete()
      .where("expires_at < :now", { now: new Date() })
      .execute();
    
    if (result.affected && result.affected > 0) {
      logger.info(`Cleaned ${result.affected} expired refresh tokens`);
    }
  } catch (error) {
    logger.error("Error cleaning expired tokens:", error);
  }
};

/**
 * Token validation utilities
 */
export const verifyAccessToken = (token: string): any => {
  try {
    return jwt.verify(token, config.JWT_SECRET);
  } catch (error) {
    throw error;
  }
};

export const verifyRefreshToken = (token: string): any => {
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as any;
    
    if (payload.type !== "refresh") {
      throw new Error("Invalid token type");
    }
    
    return payload;
  } catch (error) {
    throw error;
  }
};

/**
 * Clear authentication cookies
 */
export const clearAuthCookies = (res: any) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" as const : "lax" as const,
    expires: new Date(0),
    path: "/",
  };

  res.cookie("accessToken", "", cookieOptions);
  res.cookie("refreshToken", "", cookieOptions);
  
  // Clear legacy cookies as well
  res.cookie("token", "", cookieOptions);
  res.cookie("jwt", "", cookieOptions);
};

/**
 * Extract token from request
 */
export const extractTokenFromRequest = (req: any): string | null => {
  // Try Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  
  // Try cookies
  if (req.cookies) {
    return req.cookies.accessToken || req.cookies.token || req.cookies.jwt || null;
  }
  
  return null;
};

/**
 * Token refresh utility
 */
export const refreshTokens = async (refreshToken: string) => {
  try {
    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);
    
    // Get token from database
    const tokenRecord = await getRefreshTokenFromDB(refreshToken);
    
    if (!tokenRecord) {
      throw new Error("Refresh token not found");
    }
    
    // Check if token is expired
    if (tokenRecord.expires_at < new Date()) {
      await deleteRefreshTokenFromDB(refreshToken);
      throw new Error("Refresh token expired");
    }
    
    // Get user
    const user = tokenRecord.user;
    if (!user) {
      await deleteRefreshTokenFromDB(refreshToken);
      throw new Error("User not found");
    }
    
    // Generate new tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    const newRefreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    // Replace old refresh token with new one
    await deleteRefreshTokenFromDB(refreshToken);
    await saveRefreshTokenToDB(user.id, newRefreshToken, newRefreshTokenExpiresAt);
    
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        userRole: user.userRole,
      }
    };
  } catch (error) {
    logger.error("Error refreshing tokens:", error);
    throw error;
  }
};

if (process.env.NODE_ENV !== "test") {
  setInterval(() => {
    cleanExpiredTokens();
  }, 60 * 60 * 1000);
}