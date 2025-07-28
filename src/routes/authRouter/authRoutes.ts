
import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs"; 
import { OAuth2Client } from "google-auth-library";
import { AppDataSource } from "../../db/connect";
import { User, UserRole } from "../../db/mysqlModels/User";
import { Org } from "../../db/mysqlModels/Org";
import { RefreshToken } from "../../db/mysqlModels/RefreshToken";
import { getSingleRecord } from "../../lib/dbLib/sqlUtils";
import { config } from "../../config";

const router = Router();
const logger = require("../../utils/logger").getLogger();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Repository instances
const userRepository = AppDataSource.getRepository(User);
const orgRepository = AppDataSource.getRepository(Org);
const refreshTokenRepository = AppDataSource.getRepository(RefreshToken);

// Token generation utilities
const generateAccessToken = (user: any): string => {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      userRole: user.userRole,
      email: user.email 
    },
    config.JWT_SECRET,
    { 
      expiresIn: "15m",
      issuer: "lms-backend",
      audience: "lms-app"
    }
  );
};

const generateRefreshToken = (user: any): string => {
  return jwt.sign(
    { 
      id: user.id,
      type: "refresh"
    },
    config.JWT_SECRET,
    { 
      expiresIn: "7d",
      issuer: "lms-backend",
      audience: "lms-app"
    }
  );
};

const getAccessTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" as const : "lax" as const,
  maxAge: 15 * 60 * 1000,
  path: "/",
});

const getRefreshTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" as const : "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
});

const saveRefreshTokenToDB = async (userId: string, token: string, expiresAt: Date) => {
  try {
    await refreshTokenRepository.delete({ user_id: userId });
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

const getRefreshTokenFromDB = async (token: string): Promise<any> => {
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

const deleteRefreshTokenFromDB = async (token: string) => {
  try {
    await refreshTokenRepository.delete({ token });
    logger.info("Refresh token deleted from database");
  } catch (error) {
    logger.error("Error deleting refresh token:", error);
  }
};

const cleanExpiredTokens = async () => {
  try {
    await refreshTokenRepository
      .createQueryBuilder()
      .delete()
      .where("expires_at < :now", { now: new Date() })
      .execute();
  } catch (error) {
    logger.error("Error cleaning expired tokens:", error);
  }
};

/**
 * User Registration
 */
router.post("/register", async (req: Request, res: Response) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ 
      error: "Username, email, and password are required" 
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  if (!strongPasswordRegex.test(password)) {
    return res.status(400).json({
      error: "Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character",
    });
  }

  try {
    const existingUser = await getSingleRecord<User, any>(
      User,
      { where: [{ email }, { username }] },
      `user_${email}_${username}`,
      false, // Don't cache for registration check
      10 * 60,
    );

    if (existingUser) {
      return res.status(400).json({ 
        error: "Email or username already exists" 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    let defaultOrg = await getSingleRecord<Org, any>(
      Org,
      { where: { name: "Default Org" } },
      `org_default`,
      true,
      10 * 60,
    );

    if (!defaultOrg) {
      defaultOrg = orgRepository.create({ name: "Default Org" });
      await orgRepository.save(defaultOrg);
    }

    const newUser = userRepository.create({
      username,
      email,
      password: hashedPassword,
      batch_id: [],
      org_id: defaultOrg.id,
      userRole: UserRole.STUDENT,
    });
    
    await userRepository.save(newUser);

    logger.info(`New user registered: ${email}`);
    return res.status(201).json({ 
      message: "User registered successfully",
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        userRole: newUser.userRole
      }
    });
  } catch (error) {
    logger.error("Error in Register Route:", error);
    return res.status(500).json({ error: "Failed to register user" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ 
      error: "Email and password are required" 
    });
  }

  try {
    const user = await getSingleRecord<User, any>(
      User,
      { where: { email } },
      `user_email_${email}`,
      false,
      10 * 60,
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.password) {
      return res.status(401).json({ error: "Invalid credentials - Google user" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await saveRefreshTokenToDB(user.id, refreshToken, refreshTokenExpiresAt);

    res.cookie("accessToken", accessToken, getAccessTokenCookieOptions());
    res.cookie("refreshToken", refreshToken, getRefreshTokenCookieOptions());
    res.cookie("token", accessToken, getAccessTokenCookieOptions()); 

    logger.info(`User logged in: ${email}`);
    return res.status(200).json({
      message: "Login successful",
      token: accessToken,
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        userRole: user.userRole,
      },
    });
  } catch (error) {
    logger.error("Error in Login Route:", error);
    return res.status(500).json({ error: "Failed to login" });
  }
});

router.post("/admin-login", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const idToken = authHeader?.split(" ")[1];

  if (!idToken) {
    return res.status(400).json({ error: "ID token is required" });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ error: "Invalid Google token" });
    }

    const user = await getSingleRecord<User, any>(
      User,
      { where: { email: payload.email } },
      `user_email_${payload.email}`,
      false,
      10 * 60,
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const allowedRoles = [UserRole.ADMIN, UserRole.RECRUITER, UserRole.INSTRUCTOR];
    if (!allowedRoles.includes(user.userRole)) {
      return res.status(403).json({
        error: "Access denied. Admin privileges required.",
        userRole: user.userRole,
      });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await saveRefreshTokenToDB(user.id, refreshToken, refreshTokenExpiresAt);

    res.cookie("accessToken", accessToken, getAccessTokenCookieOptions());
    res.cookie("refreshToken", refreshToken, getRefreshTokenCookieOptions());
    res.cookie("token", accessToken, getAccessTokenCookieOptions());

    logger.info(`Admin logged in: ${payload.email}`);
    return res.status(200).json({
      message: "Admin login successful",
      token: accessToken,
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        userRole: user.userRole,
      },
    });
  } catch (error) {
    logger.error("Error in Admin Login Route:", error);
    return res.status(500).json({ error: "Failed to login as admin" });
  }
});

/**
 * Google OAuth Token Exchange
 */
router.post("/exchange", async (req: Request, res: Response) => {
  const { token: googleJwt } = req.body;
  
  if (!googleJwt) {
    return res.status(400).json({ error: "Google token is required" });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: googleJwt,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ error: "Invalid Google token" });
    }

    let user = await getSingleRecord<User, any>(
      User,
      { where: { email: payload.email } },
      `user_email_${payload.email}`,
      false,
      10 * 60,
    );

    if (!user) {
      let defaultOrg = await getSingleRecord<Org, any>(
        Org,
        { where: { name: "Default Org" } },
        `org_default`,
        true,
        10 * 60,
      );

      if (!defaultOrg) {
        defaultOrg = orgRepository.create({ name: "Default Org" });
        await orgRepository.save(defaultOrg);
      }

      user = userRepository.create({
        username: payload.email.split("@")[0],
        email: payload.email,
        password: "",
        batch_id: [],
        org_id: defaultOrg.id,
        userRole: UserRole.STUDENT,
      });
      
      await userRepository.save(user);
      logger.info(`New Google user created: ${payload.email}`);
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await saveRefreshTokenToDB(user.id, refreshToken, refreshTokenExpiresAt);

    res.cookie("accessToken", accessToken, getAccessTokenCookieOptions());
    res.cookie("refreshToken", refreshToken, getRefreshTokenCookieOptions());
    res.cookie("token", accessToken, getAccessTokenCookieOptions()); // Legacy

    logger.info(`Google user authenticated: ${payload.email}`);
    return res.status(200).json({ 
      token: accessToken,
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        userRole: user.userRole,
      }
    });
  } catch (error) {
    logger.error("Error in Google token exchange:", error);
    return res.status(401).json({ error: "Invalid Google token" });
  }
});

router.post("/refresh", async (req: Request, res: Response) => {
  try {
    await cleanExpiredTokens();

    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({ 
        error: "Refresh token is required" 
      });
    }

    let payload: any;
    try {
      payload = jwt.verify(refreshToken, config.JWT_SECRET) as any;
      
      if (payload.type !== "refresh") {
        throw new Error("Invalid token type");
      }
    } catch (err) {
      return res.status(401).json({ 
        error: "Invalid or expired refresh token" 
      });
    }

    const tokenRecord = await getRefreshTokenFromDB(refreshToken);
    
    if (!tokenRecord) {
      return res.status(401).json({ 
        error: "Refresh token not found or expired" 
      });
    }

    if (tokenRecord.expires_at < new Date()) {
      await deleteRefreshTokenFromDB(refreshToken);
      return res.status(401).json({ 
        error: "Refresh token has expired" 
      });
    }

    const user = await getSingleRecord<User, any>(
      User,
      { where: { id: payload.id } },
      `user_id_${payload.id}`,
      false,
      10 * 60,
    );

    if (!user) {
      await deleteRefreshTokenFromDB(refreshToken);
      return res.status(404).json({ error: "User not found" });
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    const newRefreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    await deleteRefreshTokenFromDB(refreshToken);
    await saveRefreshTokenToDB(user.id, newRefreshToken, newRefreshTokenExpiresAt);

    res.cookie("accessToken", newAccessToken, getAccessTokenCookieOptions());
    res.cookie("refreshToken", newRefreshToken, getRefreshTokenCookieOptions());
    res.cookie("token", newAccessToken, getAccessTokenCookieOptions()); // Legacy

    logger.info(`Tokens refreshed for user: ${user.id}`);
    return res.status(200).json({ 
      token: newAccessToken,
      accessToken: newAccessToken,
      message: "Tokens refreshed successfully"
    });
  } catch (error) {
    logger.error("Error in refresh token route:", error);
    return res.status(500).json({ error: "Failed to refresh tokens" });
  }
});

router.get("/me", async (req: Request, res: Response) => {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.cookies) {
      token = req.cookies.accessToken || req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ 
        error: "Unauthorized - No access token found" 
      });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET) as any;
    } catch (err) {
      return res.status(401).json({ 
        error: "Invalid or expired access token" 
      });
    }

    const user = await getSingleRecord<User, any>(
      User,
      { where: { id: decoded.id } },
      `user_id_${decoded.id}`,
      true,
      5 * 60,
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        userRole: user.userRole,
        org_id: user.org_id,
        batch_id: user.batch_id,
      },
    });
  } catch (error) {
    logger.error("Error in /me route:", error);
    return res.status(500).json({ error: "Failed to get user information" });
  }
});

router.post("/logout", async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (refreshToken) {
      await deleteRefreshTokenFromDB(refreshToken);
    }

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" as const : "lax" as const,
      expires: new Date(0),
      path: "/",
    };

    res.cookie("accessToken", "", cookieOptions);
    res.cookie("refreshToken", "", cookieOptions);
    res.cookie("token", "", cookieOptions);

    logger.info("User logged out successfully");
    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    logger.error("Error in logout route:", error);
    return res.status(500).json({ error: "Failed to logout" });
  }
});

router.post("/logout-all", async (req: Request, res: Response) => {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.cookies) {
      token = req.cookies.accessToken || req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ 
        error: "Unauthorized - No access token found" 
      });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET) as any;
    } catch (err) {
      return res.status(401).json({ 
        error: "Invalid access token" 
      });
    }

    await refreshTokenRepository.delete({ user_id: decoded.id });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" as const : "lax" as const,
      expires: new Date(0),
      path: "/",
    };

    res.cookie("accessToken", "", cookieOptions);
    res.cookie("refreshToken", "", cookieOptions);
    res.cookie("token", "", cookieOptions);

    logger.info(`User logged out from all devices: ${decoded.id}`);
    return res.status(200).json({ 
      message: "Logged out from all devices successfully" 
    });
  } catch (error) {
    logger.error("Error in logout-all route:", error);
    return res.status(500).json({ error: "Failed to logout from all devices" });
  }
});

export { router as authRouter };