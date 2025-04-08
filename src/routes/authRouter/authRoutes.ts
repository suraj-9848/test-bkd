import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../../db/mysqlModels/User";
import { Org } from "../../db/mysqlModels/Org";
import jwt from "jsonwebtoken";
import { config } from "../../config";
import { AppDataSource } from "../../db/connect";

const router = express.Router();
const userRepository = AppDataSource.getRepository(User);

router.post("/register", async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ error: "Username, email, and password are required" });
    }

    const existingUser = await userRepository.findOneBy([
      { email },
      { username },
    ]);
    if (existingUser) {
      return res
        .status(400)
        .json({ error: "Email or username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let defaultOrg = await AppDataSource.getRepository(Org).findOneBy({
      name: "Default Org",
    });
    if (!defaultOrg) {
      defaultOrg = await AppDataSource.getRepository(Org).save({
        name: "Default Org",
        description: "Default organization description",
        address: "Default address",
      });
    }

    const newUser = userRepository.create({
      username,
      email,
      password: hashedPassword,
      org_id: defaultOrg.id,
    });
    await userRepository.save(newUser);

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Error in Register Route:", error);
    res.status(500).json({ error: "Failed to register user" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await userRepository.findOneBy({ email });
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
      { expiresIn: "1h" }
    );

    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error("Error in Login Route:", error);
    res.status(500).json({ error: "Failed to login" });
  }
});

export { router as authRouter };