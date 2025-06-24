import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../../config";
import { AppDataSource } from "../../db/connect";
import { User, UserRole } from "../../db/mysqlModels/User";
import { Org } from "../../db/mysqlModels/Org";
import { getSingleRecord } from "../../lib/dbLib/sqlUtils";
import { OAuth2Client } from "google-auth-library";

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
      maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
      path: "/", // Ensure cookie is available across all paths
    });

    return res.status(200).json({
      message: "Login successful",
      token,
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

// Update the logout route to properly clear the cookie
router.post("/logout", (_req: Request, res: Response) => {
  res.cookie("token", "", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    expires: new Date(0), // Immediately expire the cookie
    path: "/",
  });
  return res.status(200).json({ message: "Logged out successfully" });
});

/**
 * Get the currently authenticated user (from cookie)
 */
router.get("/me", async (req: Request, res: Response) => {
  try {
    // Get token from the cookie
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ error: "Unauthorized - No token found" });
    }

    // Verify the token
    const decoded: any = jwt.verify(token, config.JWT_SECRET);

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

    // Remove sensitive data
    const { password, ...userData } = user;

    // Return user data
    return res.status(200).json({ user: userData });
  } catch (error) {
    logger.error("Error in Me Route:", error);

    // If token is invalid or expired
    if (error instanceof jwt.JsonWebTokenError) {
      // Clear the cookie if the token is invalid
      res.clearCookie("token");
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/profile", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const decoded: any = jwt.verify(token, config.JWT_SECRET);

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
async function verifyGoogleToken(idToken: string) {
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
      user.userRole = UserRole.STUDENT; // Default role
      await user.save();
      // console.log("New user created:", email);
      // console.log("Password set", user.password);
    }

    // Generate JWT token for the existing user
    // const token = jwt.sign(
    //   { id: user.id, username: user.username, userRole: user.userRole },
    //   process.env.JWT_SECRET,
    //   { expiresIn: "24h" },
    // );

    return res.status(200).json({
      message: "Login successful",
      // token,
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

    const user = await getSingleRecord<User, any>(
      User,
      { where: { email: payload.email } },
      `user_email_${payload.email}`,
      true,
      10 * 60,
    );

    // Generate JWT token for the existing user
    // const token = jwt.sign(
    //   { id: user.id, username: user.username, userRole: user.userRole },
    //   process.env.JWT_SECRET,
    //   { expiresIn: "24h" },
    // );
    if (!user || !user?.userRole || user?.userRole === UserRole.STUDENT) {
      return res
        .status(403)
        .json({ error: "Access denied. Admin role required." });
    }

    return res.status(200).json({
      message: "Login successful",
      // token,
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

export { router as authRouter };
