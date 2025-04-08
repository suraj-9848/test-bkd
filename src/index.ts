import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import morgan from "morgan";
// import session from "express-session";
// import passport from "passport";
// import "./config/passportConfig"; 

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
    console.log("MYSQL connection failed:", err);
  });

redisClient
  .connect()
  .then(() => {
    console.log("REDIS CACHE ACTIVE");
  })
  .catch((e) => {
    console.log("REDIS CACHE FAILED", e);
  });

app.disable("X-Powered-By");
app.use(cors({ origin: config.CORS_ORIGIN }));
app.use(morgan("dev"));
app.use(express.json({ limit: config.PAYLOAD_LIMIT }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: config.PAYLOAD_LIMIT }));

// app.use(
//   session({
//     secret: "your_session_secret", // Replace with a secure secret
//     resave: false,
//     saveUninitialized: true,
//   })
// );

// app.use(passport.initialize());
// app.use(passport.session());

app.use("/api/admin", adminRouter);
app.use("/api/auth", authRouter);
app.get("/api", (req: Request, res: Response) => {
  res.send("Hello World");
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ message: "API route not found" });
});

app.listen(PORT, () => {
  logger.info("Server is running on port " + PORT);
  logger.info("Environment is " + config.MYSQL_DATABASE_URL);
});
