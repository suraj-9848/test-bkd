import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../../config";
import { AppDataSource } from "../../db/connect";
import { User } from "../../db/mysqlModels/User";
import { Org } from "../../db/mysqlModels/Org";
import { getSingleRecord } from "../../lib/dbLib/sqlUtils";

const logger = require("../../utils/logger").getLogger();
const router = express.Router();
const userRepository = AppDataSource.getRepository(User);
const orgRepository = AppDataSource.getRepository(Org);

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
      10 * 60
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
      10 * 60
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
      10 * 60
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
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: config.JWT_COOKIE_EXPIRES_IN,
    });

    return res.status(200).json({
      message: "Login successful",
      user: { id: user.id, username: user.username, userRole: user.userRole },
    });
  } catch (error) {
    logger.error("Error in Login Route:", error);
    return res.status(500).json({ error: "Failed to login" });
  }
});

router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("token");
  return res.status(200).json({ message: "Logged out successfully" });
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
      10 * 60
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

export { router as authRouter };
