import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import morgan from "morgan";
import courseProgressRoutes from "./routes/courseRouter/courseprogressRoutes";
import sessionProgressRoutes from "./routes/sessionRouter/sessionprogressRoutes";

dotenv.config({
  path: "./.env",
});
import { config } from "./config";
import { AppDataSource, redisClient, connectMongoDB } from "./db/connect";
import path from "path";

const logger = require("./utils/logger").getLogger();
const app = express();
const PORT = config.PORT;

// connectMongoDB();
AppDataSource.initialize()
  .then(() => {
    console.log("MYSQL connected..")
  })
  .catch((err) => {
    console.log(err)
  })


redisClient.connect().then(() => {
  console.log("REDIS CACHE ACTIVE");
}).catch((e) => {
  console.log("REDIS CACHE FAILED", e)
})

app.disable('X-Powered-By')
app.use(cors( { origin : config.CORS_ORIGIN }));
app.use(morgan('dev'))
app.use(express.json({ limit: config.PAYLOAD_LIMIT }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: config.PAYLOAD_LIMIT }));
app.use(express.static(path.join(process.cwd(), "../frontend/build"), config.STATIC_CACHE_TIME));
app.use("/api/courseProgress",courseProgressRoutes);
app.use("/api/sessionProgress",sessionProgressRoutes);

import { adminRouter } from "./routes/adminRouter/adminRoutes";
import { authRouter } from "./routes/authRouter/authRoutes";

app.use("/api/admin", adminRouter);
app.use("/api/auth", authRouter);

app.get("/api", (req: Request, res: Response) => {
  res.send("Hello World");
});

app.get("/*", (req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), "../frontend/build/index.html"));
});

app.listen(PORT, () => {
  logger.info("Server is running on port " + PORT);
});
