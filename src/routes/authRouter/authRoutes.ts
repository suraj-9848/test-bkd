import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../../config";
import { AppDataSource } from "../../db/connect";
import { User, UserRole } from "../../db/mysqlModels/User";
import { Org } from "../../db/mysqlModels/Org";
import { getSingleRecord } from "../../lib/dbLib/sqlUtils";
import { OAuth2Client } from "google-auth-library";
import {
  saveRefreshToken,
  getRefreshToken,
  deleteRefreshToken,
} from "./refreshTokenStore";

const logger = require("../../utils/logger").getLogger();
const router = express.Router();
const userRepository = AppDataSource.getRepository(User);
const orgRepository = AppDataSource.getRepository(Org);
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * User Registration Route
 */
router.post("/register", async (req: Request, res: Response) => {
  const { username, email, password } = req.body;

  // Validate input fields
  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ error: "Username, email, and password are required" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  const strongPasswordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  if (!strongPasswordRegex.test(password)) {
    return res.status(400).json({
      error:
        "Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character",
    });
  }

  try {
    // Check if email or username already exists
    const existingUser = await getSingleRecord<User, any>(
      User,
      { where: [{ email }, { username }] },
      `user_${email}_${username}`,
      true,
      10 * 60,
    );

    if (existingUser) {
      return res
        .status(400)
        .json({ error: "Email or username already exists" });
    }

    // Hash password before saving to DB
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check for Default Organization and create if not exists
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

    // Create new user with the default organization
    const newUser = userRepository.create({
      username,
      email,
      password: hashedPassword,
      batch_id: [],
      org_id: defaultOrg.id,
    });
    await userRepository.save(newUser);

    return res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    logger.error("Error in Register Route:", error);
    return res.status(500).json({ error: "Failed to register user" });
  }
});

// Helper to generate tokens
function generateAccessToken(user: any) {
  return jwt.sign(
    { id: user.id, username: user.username, userRole: user.userRole },
    process.env.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN },
  );
}
function generateRefreshToken(user: any) {
  return jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

// First, update the login route to set better cookie options
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const user = await getSingleRecord<User, any>(
      User,
      { where: { email } },
      `user_email_${email}`,
      true,
      10 * 60,
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, userRole: user.userRole },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }, // Set token expiry to 24 hours
    );

    // Set cookie with improved options
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.status(200).json({
      message: "Login successful",
      token: token,
      user: {
        id: user.id,
        username: user.username,
        userRole: user.userRole,
      },
    });
  } catch (error) {
    logger.error("Error in Login Route:", error);
    return res.status(500).json({ error: "Failed to login" });
  }
});

// Refresh endpoint
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: "No refresh token provided" });
    }
    let payload: any;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }
    const storedToken = getRefreshToken(payload.id);
    if (storedToken !== refreshToken) {
      return res.status(401).json({ error: "Refresh token mismatch" });
    }
    // Issue new access token
    const user = await getSingleRecord<User, any>(
      User,
      { where: { id: payload.id } },
      `user_id_${payload.id}`,
      true,
      10 * 60,
    );
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const newAccessToken = generateAccessToken(user);
    res.cookie("token", newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });
    return res.status(200).json({ token: newAccessToken });
  } catch (error) {
    logger.error("Error in Refresh Route:", error);
    return res.status(500).json({ error: "Failed to refresh token" });
  }
});

// Update logout to clear refresh token
router.post("/logout", (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;
  if (refreshToken) {
    try {
      const payload: any = jwt.verify(refreshToken, process.env.JWT_SECRET);
      deleteRefreshToken(payload.id);
    } catch {}
  }
  res.cookie("token", "", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    expires: new Date(0),
    path: "/",
  });
  res.cookie("refreshToken", "", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    expires: new Date(0),
    path: "/",
  });
  return res.status(200).json({ message: "Logged out successfully" });
});

/**
 * Get the currently authenticated user (from cookie)
 */

router.get("/me", async (req: Request, res: Response) => {
  try {
    let token: string | undefined;

    // Try Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.cookies && req.cookies.token) {
      // Fallback to cookie
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ error: "Unauthorized - No token found" });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: "Invalid or malformed token" });
    }

    // Fetch user from database
    const user = await getSingleRecord<User, any>(
      User,
      { where: { id: decoded.id } },
      `user_id_${decoded.id}`,
      true,
      10 * 60,
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const { password, ...userData } = user;
    return res.status(200).json({ user: userData });
  } catch (error) {
    logger.error("Error in Profile Route:", error);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// Validate OAuth JWT from NextAuth
async function verifyGoogleToken(idToken) {
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

router.post("/google-login", async (req: Request, res: Response) => {
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
      10 * 60,
    );

    const name = payload.name;
    const email = payload.email;

    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();

    if (!user) {
      // Create new user if doesn't exist
      user = new User();
      user.username = email.split("@")[0] || name;
      user.email = email;
      user.batch_id = [];
      user.password = email.split("@")[0] + `${day}-${month}-${year}`;
      user.userRole = UserRole.ADMIN; // Default role
      await user.save();
    }

    // Generate JWT token for the existing user
    const token = jwt.sign(
      { id: user.id, username: user.username, userRole: user.userRole },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    // Set cookie for /me route support
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        userRole: user.userRole,
        email: user.email,
      },
    });
  } catch (error) {
    logger.error("Error in Google Login Route:", error);
    return res.status(500).json({ error: "Failed to login with Google" });
  }
});

router.post("/admin-login", async (req: Request, res: Response) => {
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
      10 * 60,
    );

    if (!user) {
      // Optionally, you can create the user here if needed
      return res.status(404).json({ error: "User not found" });
    }

    // Check if user has admin privileges
    const allowedRoles = [UserRole.ADMIN, UserRole.RECRUITER];
    if (!allowedRoles.includes(user.userRole)) {
      return res.status(403).json({
        error: "Access denied. Admin privileges required.",
        userRole: user.userRole,
      });
    }

    // Generate JWT token for the user
    const token = jwt.sign(
      { id: user.id, username: user.username, userRole: user.userRole },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    // Set cookie for /me route support
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        userRole: user.userRole,
        email: user.email,
      },
    });
  } catch (error) {
    logger.error("Error in Admin Login Route:", error);
    return res.status(500).json({ error: "Failed to login as admin" });
  }
});

// Exchange Google JWT for backend JWT
router.post("/exchange", async (req: Request, res: Response) => {
  const { token: googleJwt } = req.body;
  if (!googleJwt) return res.status(400).json({ error: "No token" });
  try {
    const ticket = await client.verifyIdToken({
      idToken: googleJwt,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ error: "Invalid Google token" });
    }
    // Find or create user
    let user = await getSingleRecord<User, any>(
      User,
      { where: { email: payload.email } },
      `user_email_${payload.email}`,
      true,
      10 * 60,
    );
    if (!user) {
      // Always assign default org for new students
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
        password: "", // Not used for Google users
        batch_id: [],
        org_id: defaultOrg.id,
        userRole: UserRole.STUDENT,
      });
      await userRepository.save(user);
      logger.info("Created new student user with default org", user);
    } else {
      logger.info("Found existing user for exchange", user);
    }
    // Issue backend JWT and refresh token
    const backendJwt = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    saveRefreshToken(user.id, refreshToken);
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });
    res.status(200).json({ token: backendJwt });
  } catch (err) {
    logger.error("Error in /exchange:", err);
    res.status(401).json({ error: "Invalid Google token" });
  }
});

export { router as authRouter };
