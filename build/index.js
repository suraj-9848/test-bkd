"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const morgan_1 = __importDefault(require("morgan"));
// import session from "express-session";
// import passport from "passport";
// import "./config/passportConfig"; 
dotenv_1.default.config({ path: "./.env" });
const config_1 = require("./config");
const connect_1 = require("./db/connect");
const adminRoutes_1 = require("./routes/adminRouter/adminRoutes");
const authRoutes_1 = require("./routes/authRouter/authRoutes");
const logger = require("./utils/logger").getLogger();
const app = (0, express_1.default)();
const PORT = config_1.config.PORT;
connect_1.AppDataSource.initialize()
    .then(() => {
    console.log("MYSQL connected..");
})
    .catch((err) => {
    console.log("MYSQL connection failed:", err);
});
connect_1.redisClient
    .connect()
    .then(() => {
    console.log("REDIS CACHE ACTIVE");
})
    .catch((e) => {
    console.log("REDIS CACHE FAILED", e);
});
app.disable("X-Powered-By");
app.use((0, cors_1.default)({ origin: config_1.config.CORS_ORIGIN }));
app.use((0, morgan_1.default)("dev"));
app.use(express_1.default.json({ limit: config_1.config.PAYLOAD_LIMIT }));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.urlencoded({ extended: true, limit: config_1.config.PAYLOAD_LIMIT }));
// app.use(
//   session({
//     secret: "your_session_secret", // Replace with a secure secret
//     resave: false,
//     saveUninitialized: true,
//   })
// );
// app.use(passport.initialize());
// app.use(passport.session());
app.use("/api/admin", adminRoutes_1.adminRouter);
app.use("/api/auth", authRoutes_1.authRouter);
app.get("/api", (req, res) => {
    res.send("Hello World");
});
app.use((req, res) => {
    res.status(404).json({ message: "API route not found" });
});
app.listen(PORT, () => {
    logger.info("Server is running on port " + PORT);
    logger.info("Environment is " + config_1.config.MYSQL_DATABASE_URL);
});
//# sourceMappingURL=index.js.map