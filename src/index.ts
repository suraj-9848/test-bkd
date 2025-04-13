import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import morgan from "morgan";

dotenv.config({ path: "./.env" });

import { config } from "./config";
import { AppDataSource, redisClient } from "./db/connect";
import { adminRouter } from "./routes/adminRouter/adminRoutes";
import { authRouter } from "./routes/authRouter/authRoutes";

const logger = require("./utils/logger").getLogger();
const app = express();
const PORT = config.PORT;

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

app.use(cors({ origin: config.CORS_ORIGIN }));

app.disable("X-Powered-By");
app.use(morgan("dev"));
app.use(express.json({ limit: config.PAYLOAD_LIMIT }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: config.PAYLOAD_LIMIT }));

app.use("/api/admin", adminRouter);
app.use("/api/auth", authRouter);

app.use((req: Request, res: Response) => {
  res.status(404).json({ message: "API route not found" });
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
});
