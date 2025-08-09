import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import morgan from "morgan";
import path from "path";
import swaggerUi from "swagger-ui-express";

// Config imports
dotenv.config({
  path: "./.env",
});
import { config } from "./config";
import { specs } from "./config/swagger";

// Database and utilities
import { AppDataSource } from "./db/connect";
import { getLogger } from "./utils/logger";

// Route imports
import authRouter from "./routes/authRouter/authRoutes";
import recruiterRouter from "./routes/recruiterRouter/recruiterRoutes";
import { adminRouter } from "./routes/adminRouter/adminRoutes";
import { instructorRouter } from "./routes/instructorRouter/batch.routes";
import courseRouter from "./routes/instructorRouter/course.routes";
import { studentRouter } from "./routes/studentRouter/studentRoutes";
import {
  hiringAdminRouter,
  hiringUserRouter,
  hiringPublicRouter,
} from "./routes/hiringRouter/hiringRoutes";
import courseProgressRoutes from "./routes/courseRouter/courseprogressRoutes";
import sessionProgressRoutes from "./routes/sessionRouter/sessionprogressRoutes";
import paymentRoutes from "./routes/paymentRoutes";
import studentProSubscriptionRoutes from "./routes/studentProSubscriptionRoutes";
import { getAvailablePlans } from "./controllers/studentControllers/proSubscriptionController";
import adminProSubscriptionRoutes from "./routes/adminProSubscriptionRoutes";
import webhookRoutes from "./routes/webhookRoutes";
import cpTrackerRoutes from "./routes/cpTrackerRoutes";

// Services
import { CPTrackerCronService } from "./services/cpTrackerCronService";

const logger = getLogger();
const app = express();
const PORT = config.PORT;

// connectMongoDB();
AppDataSource.initialize()
  .then(() => {
    console.log("MYSQL connected..");

    // Initialize CPTracker cron jobs after database connection
    CPTrackerCronService.initializeCronJobs();
    CPTrackerCronService.startAllJobs();
    logger.info("CPTracker cron service initialized");
  })
  .catch((err) => {
    console.error("MYSQL connection failed:", err);
  });

// redisClient
//   .connect()
//   .then(() => {
//     console.log("REDIS CACHE ACTIVE");
//   })
//   .catch((e) => {
//     console.error("REDIS CACHE FAILED", e);
//   });

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
    exposedHeaders: ["x-rtb-fingerprint-id"],
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

// Main routes
app.use("/api/instructor", instructorRouter);
app.use("/api/instructor", courseRouter); // Direct course routes
app.use("/api/admin", adminRouter);
app.use("/api/auth", authRouter);
app.use("/api/recruiter", recruiterRouter);
app.use("/api/student", studentRouter);
app.use("/api/hiring/admin", hiringAdminRouter);
app.use("/api/hiring/user", hiringUserRouter);
app.use("/api/hiring/public", hiringPublicRouter);
app.use("/api/course/payment", paymentRoutes);
app.use("/api/subscriptions", studentProSubscriptionRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/cp-tracker", cpTrackerRoutes);

// Public route for getting plans
app.get("/api/public/pro-plans", getAvailablePlans);

// Student subscription routes
app.use("/api/student/pro-subscriptions", studentProSubscriptionRoutes);

// Admin subscription management routes
app.use("/api/admin/pro-subscriptions", adminProSubscriptionRoutes);

app.get("/", (req: Request, res: Response) => {
  res.send("Hello, World!");
});

app.get("/ping", (req, res) => {
  res.json({ message: "pong" });
});

// Swagger UI Documentation
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    explorer: true,
    customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 50px 0 }
    .swagger-ui .info .title {
      color: #3b4151;
      font-family: sans-serif;
      font-size: 36px;
    }
  `,
    customSiteTitle: "Nirudhyog API Documentation",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
    },
  }),
);

// OpenAPI JSON specification
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json(specs);
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ message: "API route not found" });
});

app.listen(PORT, () => {
  logger.info(`db url: ${config.MYSQL_DATABASE_URL}`);
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown handling
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully...");
  CPTrackerCronService.shutdown();
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully...");
  CPTrackerCronService.shutdown();
  process.exit(0);
});
