import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import morgan from "morgan";
import courseProgressRoutes from "./routes/courseRouter/courseprogressRoutes";
import sessionProgressRoutes from "./routes/sessionRouter/sessionprogressRoutes";
import path from "path";

dotenv.config({
  path: "./.env",
});
import { config } from "./config";
import { AppDataSource, redisClient } from "./db/connect";
import { authRouter } from "./routes/authRouter/authRoutes";

const logger = require("./utils/logger").getLogger();
const app = express();
const PORT = config.PORT;

// connectMongoDB();
AppDataSource.initialize()
  .then(() => {
    console.log("MYSQL connected..");
  })
  .catch((err) => {
    console.error("MYSQL connection failed:", err);
  });

redisClient
  .connect()
  .then(() => {
    console.log("REDIS CACHE ACTIVE");
  })
  .catch((e) => {
    console.error("REDIS CACHE FAILED", e);
  });

// app.use(cors({ origin: config.CORS_ORIGIN }));
app.use(
  cors({
    origin: "http://localhost:4000",
    credentials: true,
  })
);

app.disable("X-Powered-By");
app.use(morgan("dev"));
app.use(express.json({ limit: config.PAYLOAD_LIMIT }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: config.PAYLOAD_LIMIT }));
app.use(
  express.static(
    path.join(process.cwd(), "../frontend/build"),
    config.STATIC_CACHE_TIME
  )
);
app.use("/api/courseProgress", courseProgressRoutes);
app.use("/api/sessionProgress", sessionProgressRoutes);

import { adminRouter } from "./routes/adminRouter/adminRoutes";
import { instructorRouter } from "./routes/instructorRouter/batch.routes";
import {studentRouter} from "./routes/studentRouter/studentRoutes";

// Main routes
app.use("/api/instructor", instructorRouter);
app.use("/api/admin", adminRouter);
app.use("/api/auth", authRouter);
app.use("/api/student", studentRouter);

app.use((req: Request, res: Response) => {
  res.status(404).json({ message: "API route not found" });
});


app.get("/", (req, res) => {
  res.send("App is running");
});


app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
});
