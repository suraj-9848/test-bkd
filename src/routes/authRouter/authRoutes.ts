import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { AppDataSource } from "../../db/connect";
import { User, UserRole } from "../../db/mysqlModels/User";
import { Org } from "../../db/mysqlModels/Org";
import { getSingleRecord } from "../../lib/dbLib/sqlUtils";
import {
  generateAccessToken,
  generateRefreshToken,
  saveRefreshTokenToDB,
  deleteRefreshTokenFromDB,
  deleteAllUserRefreshTokens,
  refreshTokens,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  clearAuthCookies,
  extractTokenFromRequest,
  verifyAccessToken,
  cleanExpiredTokens,
} from "../../utils/authUtils";

import { getLogger } from "../../utils/logger";

const router = Router();
const logger = getLogger();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Repository instances
const userRepository = AppDataSource.getRepository(User);
const orgRepository = AppDataSource.getRepository(Org);

// Helper function to get or create default organization
const getOrCreateDefaultOrg = async (): Promise<Org> => {
  try {
    // Try to find existing default organization
    let defaultOrg = await orgRepository.findOne({
      where: { name: "Nirudhyog Default" },
    });

    if (!defaultOrg) {
      logger.info("🏢 Creating default organization...");
      defaultOrg = orgRepository.create({
        name: "Nirudhyog Default",
        description: "Default organization for new users",
        address: null,
      });
      defaultOrg = await orgRepository.save(defaultOrg);
      logger.info(`✅ Default organization created with ID: ${defaultOrg.id}`);
    }

    return defaultOrg;
  } catch (error) {
    logger.error("❌ Error getting/creating default organization:", error);
    throw error;
  }
};

// Helper function to set auth cookies
const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
) => {
  res.cookie("accessToken", accessToken, getAccessTokenCookieOptions());
  res.cookie("refreshToken", refreshToken, getRefreshTokenCookieOptions());
};

// Helper function to create tokens and save refresh token
const createTokensAndSave = async (
  user: User,
): Promise<{ accessToken: string; refreshToken: string }> => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();

  // Save refresh token to database
  await saveRefreshTokenToDB(user.id, refreshToken);

  return { accessToken, refreshToken };
};

// Periodic cleanup of expired tokens (run every hour)
setInterval(
  async () => {
    try {
      await cleanExpiredTokens();
    } catch (error) {
      logger.error("Error in periodic token cleanup:", error);
    }
  },
  60 * 60 * 1000,
); // 1 hour

// Google OAuth login for students
router.post("/exchange", async (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }

  try {
    logger.info("🔄 Starting student authentication process");

    // Step 1: Verify Google token
    logger.info("📝 Step 1: Verifying Google token...");
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      logger.error("❌ Invalid Google token payload");
      return res.status(400).json({ error: "Invalid Google token payload" });
    }

    const { email, name, picture } = payload;

    if (!email) {
      logger.error("❌ Email not provided by Google");
      return res.status(400).json({ error: "Email not provided by Google" });
    }

    logger.info(`✅ Google verification successful for email: ${email}`);

    // Step 2: Check if user exists
    logger.info(`🔍 Step 2: Checking if user exists for email: ${email}`);
    let user;

    try {
      user = await getSingleRecord(User, { where: { email } });
      logger.info(
        `📊 Database query result: ${user ? "User found" : "No user found"}`,
      );
    } catch (dbError) {
      logger.error("❌ Database error while checking user:", dbError);
      throw new Error(
        `Database query failed: ${dbError instanceof Error ? dbError.message : "Unknown error"}`,
      );
    }

    if (!user) {
      logger.info("➕ Step 3: Creating new student user...");

      try {
        // Get or create default organization
        const defaultOrg = await getOrCreateDefaultOrg();

        // Create new student user
        logger.info(`📝 Creating user with data:`, {
          username: name || email.split("@")[0],
          email: email,
          userRole: UserRole.STUDENT,
          batch_id: [],
          org_id: defaultOrg.id,
          profile_picture: picture || null,
        });

        const newUser = userRepository.create({
          username: name || email.split("@")[0],
          email,
          userRole: UserRole.STUDENT,
          batch_id: [],
          org_id: defaultOrg.id,
          profile_picture: picture || null,
        });

        logger.info("💾 Saving new user to database...");
        user = await userRepository.save(newUser);

        logger.info(
          `✅ New student user created successfully with ID: ${user.id}`,
        );
        logger.info(`👤 Created user details:`, {
          id: user.id,
          username: user.username,
          email: user.email,
          userRole: user.userRole,
          org_id: user.org_id,
        });
      } catch (createError) {
        logger.error("❌ Error creating new user:", createError);

        // Log detailed error information
        if (createError instanceof Error) {
          logger.error("Error message:", createError.message);
          logger.error("Error stack:", createError.stack);
        }

        // Check if it's a database constraint error
        if (createError && typeof createError === "object") {
          const dbError = createError as any;
          if (dbError.code) {
            logger.error("Database error code:", dbError.code);
          }
          if (dbError.detail) {
            logger.error("Database error details:", dbError.detail);
          }
        }

        throw new Error(
          `User creation failed: ${createError instanceof Error ? createError.message : "Unknown error"}`,
        );
      }
    } else {
      logger.info(`✅ Existing user found with ID: ${user.id}`);

      // Ensure user is a student for this endpoint
      if (user.userRole !== UserRole.STUDENT) {
        logger.warn(
          `⚠️ Non-student user attempted student login: ${email} (role: ${user.userRole})`,
        );
        return res.status(403).json({
          error:
            "This login is for students only. Please use the admin portal if you have admin access.",
        });
      }
      logger.info(`✅ Existing student user logged in: ${user.id}`);
    }

    // Step 4: Generate tokens
    logger.info("🔐 Step 4: Generating authentication tokens...");
    let accessToken, refreshToken;

    try {
      const tokens = await createTokensAndSave(user);
      accessToken = tokens.accessToken;
      refreshToken = tokens.refreshToken;
      logger.info("✅ Tokens generated successfully");
    } catch (tokenError) {
      logger.error("❌ Error generating tokens:", tokenError);
      throw new Error(
        `Token generation failed: ${tokenError instanceof Error ? tokenError.message : "Unknown error"}`,
      );
    }

    // Step 5: Set cookies and respond
    logger.info("🍪 Step 5: Setting authentication cookies...");
    try {
      setAuthCookies(res, accessToken, refreshToken);
      logger.info("✅ Authentication cookies set successfully");
    } catch (cookieError) {
      logger.error("❌ Error setting cookies:", cookieError);
      // Don't fail here, cookies are optional
    }

    logger.info(`🎉 Student login successful for user: ${user.id}`);

    res.json({
      message: "Authentication successful",
      token: accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        userRole: user.userRole,
        org_id: user.org_id,
      },
    });
  } catch (error) {
    logger.error("💥 Student Google authentication failed:", error);

    // Log additional error details
    if (error instanceof Error) {
      logger.error("Error message:", error.message);
      logger.error("Error stack:", error.stack);
    }

    // Return more specific error message in development
    const isDevelopment = process.env.NODE_ENV !== "production";

    res.status(401).json({
      error: "Authentication failed",
      details: isDevelopment
        ? error instanceof Error
          ? error.message
          : "Unknown error"
        : undefined,
    });
  }
});

// Google OAuth login for admin/instructor users
router.post("/admin-login", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : req.body.token;

  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }

  try {
    logger.info("Attempting to verify Google token for admin login");

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(400).json({ error: "Invalid Google token payload" });
    }

    const { email } = payload;

    if (!email) {
      return res.status(400).json({ error: "Email not provided by Google" });
    }

    logger.info(`Google verification successful for admin login: ${email}`);

    // Check if user exists and has admin/instructor role
    const user = await getSingleRecord(User, { where: { email } });

    if (!user) {
      logger.warn(`Admin login attempted by non-existing user: ${email}`);
      return res.status(403).json({
        error: "Access denied. Admin account not found.",
      });
    }

    // Check if user has admin or instructor role
    if (
      ![UserRole.ADMIN, UserRole.INSTRUCTOR, UserRole.RECRUITER].includes(
        user.userRole,
      )
    ) {
      logger.warn(
        `Admin login attempted by non-admin user: ${email} (role: ${user.userRole})`,
      );
      return res.status(403).json({
        error: "Access denied. Admin or instructor privileges required.",
      });
    }

    logger.info(
      `Admin login successful for user: ${user.id} (role: ${user.userRole})`,
    );

    // Generate tokens and save refresh token
    const { accessToken, refreshToken } = await createTokensAndSave(user);

    // Set cookies
    setAuthCookies(res, accessToken, refreshToken);

    res.json({
      message: "Admin authentication successful",
      token: accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        userRole: user.userRole,
        org_id: user.org_id,
      },
    });
  } catch (error) {
    logger.error("Admin Google authentication error:", error);
    res.status(401).json({ error: "Authentication failed" });
  }
});

// Refresh token endpoint
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    // Get refresh token from cookie or body
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token not provided" });
    }

    logger.info("Attempting to refresh tokens");

    // Refresh tokens
    const result = await refreshTokens(refreshToken);

    if (!result) {
      logger.warn("Invalid or expired refresh token");
      clearAuthCookies(res);
      return res
        .status(401)
        .json({ error: "Invalid or expired refresh token" });
    }

    const { accessToken, newRefreshToken, user } = result;

    // Set new cookies
    setAuthCookies(res, accessToken, newRefreshToken);

    logger.info(`Tokens refreshed successfully for user: ${user.id}`);

    res.json({
      message: "Tokens refreshed successfully",
      token: accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        userRole: user.userRole,
        org_id: user.org_id,
      },
    });
  } catch (error) {
    logger.error("Token refresh error:", error);
    clearAuthCookies(res);
    res.status(401).json({ error: "Token refresh failed" });
  }
});

// Verify token endpoint (for client-side validation)
router.post("/verify", async (req: Request, res: Response) => {
  try {
    const token = extractTokenFromRequest(req) || req.body.token;

    if (!token) {
      return res.status(401).json({ error: "Token not provided" });
    }

    const decoded = verifyAccessToken(token);

    // Get full user info
    const user = await getSingleRecord(User, { where: { id: decoded.id } });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    res.json({
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        userRole: user.userRole,
        org_id: user.org_id,
      },
    });
  } catch (error) {
    logger.error("Token verification error:", error);

    if (error.message === "Token expired") {
      return res
        .status(401)
        .json({ error: "Token expired", code: "TOKEN_EXPIRED" });
    } else if (error.message === "Invalid token") {
      return res
        .status(401)
        .json({ error: "Invalid token", code: "INVALID_TOKEN" });
    } else {
      return res.status(401).json({ error: "Token verification failed" });
    }
  }
});

// Get current user info (requires valid access token)
router.get("/me", async (req: Request, res: Response) => {
  try {
    const token = extractTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({ error: "Access token not provided" });
    }

    const decoded = verifyAccessToken(token);
    const user = await getSingleRecord(User, { where: { id: decoded.id } });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        userRole: user.userRole,
        org_id: user.org_id,
      },
    });
  } catch (error) {
    logger.error("Get user info error:", error);

    if (error.message === "Token expired") {
      return res
        .status(401)
        .json({ error: "Token expired", code: "TOKEN_EXPIRED" });
    } else {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  }
});

// Logout endpoint
router.post("/logout", async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if (refreshToken) {
      // Delete refresh token from database
      await deleteRefreshTokenFromDB(refreshToken);
      logger.info("Refresh token deleted on logout");
    }

    // Clear cookies
    clearAuthCookies(res);

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    logger.error("Logout error:", error);
    // Still clear cookies even if database operation fails
    clearAuthCookies(res);
    res.json({ message: "Logged out successfully" });
  }
});

// Logout from all devices
router.post("/logout-all", async (req: Request, res: Response) => {
  try {
    const token = extractTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({ error: "Access token not provided" });
    }

    const decoded = verifyAccessToken(token);

    // Delete all refresh tokens for this user
    await deleteAllUserRefreshTokens(decoded.id);

    // Clear cookies
    clearAuthCookies(res);

    logger.info(`All refresh tokens deleted for user: ${decoded.id}`);

    res.json({ message: "Logged out from all devices successfully" });
  } catch (error) {
    logger.error("Logout all error:", error);
    clearAuthCookies(res);
    res.status(500).json({ error: "Logout failed" });
  }
});

// Admin endpoint to clean up expired tokens manually
router.post("/cleanup-tokens", async (req: Request, res: Response) => {
  try {
    const token = extractTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({ error: "Access token not provided" });
    }

    const decoded = verifyAccessToken(token);
    const user = await getSingleRecord(User, { where: { id: decoded.id } });

    // Only allow admin users to trigger cleanup
    if (!user || user.userRole !== UserRole.ADMIN) {
      return res.status(403).json({ error: "Admin access required" });
    }

    await cleanExpiredTokens();

    res.json({ message: "Expired tokens cleaned up successfully" });
  } catch (error) {
    logger.error("Token cleanup error:", error);
    res.status(500).json({ error: "Token cleanup failed" });
  }
});

export default router;
