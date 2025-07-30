import jwt from "jsonwebtoken";
import { config } from "../config";
import { AppDataSource } from "../db/connect";
import { RefreshToken } from "../db/mysqlModels/RefreshToken";
import { User } from "../db/mysqlModels/User";
import { v4 as uuidv4 } from "uuid";

const logger = require("./logger").getLoggerByName("Auth Utils");

/**
 * Token generation utilities with refresh token support
 */
export const generateAccessToken = (user: any): string => {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      userRole: user.userRole,
      email: user.email,
      profile_picture: user.profile_picture
    },
    config.JWT_SECRET,
    { 
      expiresIn: "30m", // Back to 30 minutes with refresh token support
      issuer: "lms-backend",
      audience: "lms-app"
    }
  );
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (): string => {
  return jwt.sign(
    { 
      tokenId: uuidv4(),
      type: "refresh" 
    },
    config.JWT_SECRET,
    { 
      expiresIn: "7d", // 7 days
      issuer: "lms-backend",
      audience: "lms-app"
    }
  );
};

/**
 * Save refresh token to database
 */
export const saveRefreshTokenToDB = async (userId: string, refreshToken: string): Promise<RefreshToken> => {
  try {
    const refreshTokenRepository = AppDataSource.getRepository(RefreshToken);
    
    // Calculate expiry date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    // Clean up old refresh tokens for this user (keep only latest 5)
    const existingTokens = await refreshTokenRepository.find({
      where: { user_id: userId },
      order: { created_at: "DESC" }
    });
    
    if (existingTokens.length >= 5) {
      const tokensToDelete = existingTokens.slice(4); // Keep latest 4, delete rest
      for (const token of tokensToDelete) {
        await refreshTokenRepository.remove(token);
      }
    }
    
    // Create new refresh token
    const newRefreshToken = refreshTokenRepository.create({
      user_id: userId,
      token: refreshToken,
      expires_at: expiresAt,
    });
    
    const savedToken = await refreshTokenRepository.save(newRefreshToken);
    logger.info(`Refresh token saved for user: ${userId}`);
    
    return savedToken;
  } catch (error) {
    logger.error("Error saving refresh token:", error);
    throw new Error("Failed to save refresh token");
  }
};

/**
 * Get refresh token from database
 */
export const getRefreshTokenFromDB = async (refreshToken: string): Promise<RefreshToken | null> => {
  try {
    const refreshTokenRepository = AppDataSource.getRepository(RefreshToken);
    
    const tokenRecord = await refreshTokenRepository.findOne({
      where: { token: refreshToken },
      relations: ["user"]
    });
    
    if (!tokenRecord) {
      logger.warn("Refresh token not found in database");
      return null;
    }
    
    // Check if token is expired
    if (new Date() > tokenRecord.expires_at) {
      logger.warn("Refresh token expired, removing from database");
      await refreshTokenRepository.remove(tokenRecord);
      return null;
    }
    
    return tokenRecord;
  } catch (error) {
    logger.error("Error getting refresh token from DB:", error);
    return null;
  }
};

/**
 * Delete refresh token from database
 */
export const deleteRefreshTokenFromDB = async (refreshToken: string): Promise<boolean> => {
  try {
    const refreshTokenRepository = AppDataSource.getRepository(RefreshToken);
    
    const tokenRecord = await refreshTokenRepository.findOne({
      where: { token: refreshToken }
    });
    
    if (tokenRecord) {
      await refreshTokenRepository.remove(tokenRecord);
      logger.info("Refresh token deleted from database");
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error("Error deleting refresh token:", error);
    return false;
  }
};

/**
 * Delete all refresh tokens for a user
 */
export const deleteAllUserRefreshTokens = async (userId: string): Promise<boolean> => {
  try {
    const refreshTokenRepository = AppDataSource.getRepository(RefreshToken);
    
    const result = await refreshTokenRepository.delete({ user_id: userId });
    logger.info(`Deleted ${result.affected} refresh tokens for user: ${userId}`);
    
    return true;
  } catch (error) {
    logger.error("Error deleting user refresh tokens:", error);
    return false;
  }
};

/**
 * Clean up expired refresh tokens (run periodically)
 */
export const cleanExpiredTokens = async (): Promise<void> => {
  try {
    const refreshTokenRepository = AppDataSource.getRepository(RefreshToken);
    
    const expiredTokens = await refreshTokenRepository
      .createQueryBuilder("token")
      .where("token.expires_at < :now", { now: new Date() })
      .getMany();
    
    if (expiredTokens.length > 0) {
      await refreshTokenRepository.remove(expiredTokens);
      logger.info(`Cleaned up ${expiredTokens.length} expired refresh tokens`);
    }
  } catch (error) {
    logger.error("Error cleaning expired tokens:", error);
  }
};

/**
 * Verify refresh token and return user info
 */
export const verifyRefreshToken = async (refreshToken: string): Promise<User | null> => {
  try {
    // First verify JWT structure
    const decoded = jwt.verify(refreshToken, config.JWT_SECRET) as any;
    
    if (decoded.type !== "refresh") {
      logger.warn("Invalid token type for refresh");
      return null;
    }
    
    // Get token from database
    const tokenRecord = await getRefreshTokenFromDB(refreshToken);
    
    if (!tokenRecord || !tokenRecord.user) {
      logger.warn("Refresh token not found or user not associated");
      return null;
    }
    
    return tokenRecord.user;
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      logger.warn("Refresh token expired");
      // Clean up expired token from database
      await deleteRefreshTokenFromDB(refreshToken);
    } else {
      logger.error("Error verifying refresh token:", error);
    }
    return null;
  }
};

/**
 * Cookie options for access token
 */
export const getAccessTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 30 * 60 * 1000, // 30 minutes
  path: "/"
});

/**
 * Cookie options for refresh token
 */
export const getRefreshTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", 
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/"
});

/**
 * Clear authentication cookies
 */
export const clearAuthCookies = (res: any) => {
  res.clearCookie("accessToken", { path: "/" });
  res.clearCookie("refreshToken", { path: "/" });
};

/**
 * Extract token from request (Bearer header or cookie)
 */
export const extractTokenFromRequest = (req: any): string | null => {
  // Try Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  
  // Try cookie as fallback
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }
  
  return null;
};

/**
 * Refresh tokens - generate new access token using refresh token
 */
export const refreshTokens = async (refreshToken: string): Promise<{
  accessToken: string;
  newRefreshToken: string;
  user: User;
} | null> => {
  try {
    // Verify refresh token and get user
    const user = await verifyRefreshToken(refreshToken);
    
    if (!user) {
      logger.warn("Invalid refresh token provided");
      return null;
    }
    
    // Generate new tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken();
    
    // Delete old refresh token and save new one
    await deleteRefreshTokenFromDB(refreshToken);
    await saveRefreshTokenToDB(user.id, newRefreshToken);
    
    logger.info(`Tokens refreshed for user: ${user.id}`);
    
    return {
      accessToken: newAccessToken,
      newRefreshToken,
      user
    };
  } catch (error) {
    logger.error("Error refreshing tokens:", error);
    return null;
  }
};

/**
 * Verify JWT token and return payload
 */
export const verifyAccessToken = (token: string): any => {
  try {
    return jwt.verify(token, config.JWT_SECRET);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new Error("Token expired");
    } else if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid token");
    } else {
      throw new Error("Token verification failed");
    }
  }
};

/**
 * Decode JWT token without verification (for client-side use)
 */
export const decodeToken = (token: string): any => {
  try {
    return jwt.decode(token);
  } catch (error) {
    logger.error("Error decoding token:", error);
    return null;
  }
};

/**
 * Check if token is expired (client-side helper)
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return true;
    
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  } catch (error) {
    return true;
  }
};

/**
 * Extract user role from token
 */
export const extractUserRole = (token: string): string | null => {
  try {
    const decoded = decodeToken(token);
    return decoded?.userRole || null;
  } catch (error) {
    return null;
  }
};

/**
 * Extract user ID from token
 */
export const extractUserId = (token: string): string | null => {
  try {
    const decoded = decodeToken(token);
    return decoded?.id || null;
  } catch (error) {
    return null;
  }
};