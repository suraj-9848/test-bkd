import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../../db/mysqlModels/User";
import { OrgUtils } from "../../utils/orgUtils";
import { UserUtils } from "../../utils/userUtils";
import jwt from "jsonwebtoken";

import { config } from "../../config";
import { AppDataSource } from "../../db/connect";

const logger = require("../../utils/logger").getLogger();
const router = express.Router();
const userRepository = AppDataSource.getRepository(User);

router.post("/register", async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

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

    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ error: "Username, email, and password are required" });
    }

    const existingUser = await UserUtils.findByEmailOrUsername(email, username);
    if (existingUser) {
      return res
        .status(400)
        .json({ error: "Email or username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const defaultOrg = await OrgUtils.getOrCreateDefaultOrg();

    const newUser = userRepository.create({
      username,
      email,
      password: hashedPassword,
      org_id: defaultOrg.id,
    });
    await userRepository.save(newUser);

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    logger.error("Error in Register Route:", error);
    res.status(500).json({ error: "Failed to register user" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await UserUtils.findByEmail(email);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: config.JWT_COOKIE_EXPIRES_IN,
    });

    res.status(200).json({
      message: "Login successful",
      user: { id: user.id, username: user.username },
    });
  } catch (error) {
    logger.error("Error in Login Route:", error);
    res.status(500).json({ error: "Failed to login" });
  }
});

router.post("/logout", (req: Request, res: Response) => {
  res.status(200).json({ message: "Logged out successfully" });
});

router.get("/profile", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const decoded: any = jwt.verify(token, config.JWT_SECRET);
    const user = await UserUtils.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { password, ...userData } = user;

    res.status(200).json({ user: userData });
  } catch (error) {
    logger.error("Error in Profile Route:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

export { router as authRouter };
