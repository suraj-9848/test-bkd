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
    origin: (origin, callback) => {
      const allowedOrigins = (process.env.CORS_ORIGIN || "")
        .split(",")
        .map((o) => o.trim());
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

app.disable("X-Powered-By");
app.use(morgan("dev"));
app.use(express.json({ limit: config.PAYLOAD_LIMIT }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: config.PAYLOAD_LIMIT }));
app.use(
  express.static(
    path.join(process.cwd(), "../frontend/build"),
    config.STATIC_CACHE_TIME,
  ),
);

// Serve uploaded files
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/api/courseProgress", courseProgressRoutes);
app.use("/api/sessionProgress", sessionProgressRoutes);

import { adminRouter } from "./routes/adminRouter/adminRoutes";
import { instructorRouter } from "./routes/instructorRouter/batch.routes";
import { studentRouter } from "./routes/studentRouter/studentRoutes";
import {
  hiringAdminRouter,
  hiringUserRouter,
  hiringPublicRouter,
} from "./routes/hiringRouter/hiringRoutes";

// Main routes
app.use("/api/instructor", instructorRouter);
app.use("/api/admin", adminRouter);
app.use("/api/auth", authRouter);
app.use("/api/student", studentRouter);
app.use("/api/admin/hiring", hiringAdminRouter);
app.use("/api/hiring", hiringPublicRouter); // Public routes must come before authenticated routes
app.use("/api/hiring", hiringUserRouter);

app.get("/", (req, res) => {
  res.send("App is running");
});

app.get("/ping", (req, res) => {
  res.json({ message: "pong" });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ message: "API route not found" });
});

app.listen(PORT, () => {
  logger.info(`db url: ${config.MYSQL_DATABASE_URL}`);
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
});
