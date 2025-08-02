import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import morgan from "morgan";
import courseProgressRoutes from "./routes/courseRouter/courseprogressRoutes";
import sessionProgressRoutes from "./routes/sessionRouter/sessionprogressRoutes";
import path from "path";
import swaggerUi from "swagger-ui-express";
import { specs } from "./config/swagger";
import paymentRoutes from "./routes/paymentRoutes";

dotenv.config({
  path: "./.env",
});
import { config } from "./config";
import { AppDataSource } from "./db/connect";
import authRouter from "./routes/authRouter/authRoutes";
import { getLogger } from "./utils/logger";

const logger = getLogger();
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

import { adminRouter } from "./routes/adminRouter/adminRoutes";
import { instructorRouter } from "./routes/instructorRouter/batch.routes";
import courseRouter from "./routes/instructorRouter/course.routes";
import { studentRouter } from "./routes/studentRouter/studentRoutes";
import {
  hiringAdminRouter,
  hiringUserRouter,
  hiringPublicRouter,
} from "./routes/hiringRouter/hiringRoutes";

// Main routes
app.use("/api/instructor", instructorRouter);
app.use("/api/instructor", courseRouter); // Direct course routes
app.use("/api/admin", adminRouter);
app.use("/api/auth", authRouter);
app.use("/api/student", studentRouter);
app.use("/api/admin/hiring", hiringAdminRouter);
app.use("/api/hiring", hiringPublicRouter); // Public routes must come before authenticated routes
app.use("/api/hiring", hiringUserRouter);
app.use("/api/payment", paymentRoutes);

app.get("/", (req, res) => {
  res.send("App is running");
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
