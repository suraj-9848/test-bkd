"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = require("../../db/mysqlModels/User");
const Org_1 = require("../../db/mysqlModels/Org");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../../config");
const connect_1 = require("../../db/connect");
const router = express_1.default.Router();
exports.authRouter = router;
const userRepository = connect_1.AppDataSource.getRepository(User_1.User);
router.post("/register", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res
                .status(400)
                .json({ error: "Username, email, and password are required" });
        }
        const existingUser = yield userRepository.findOneBy([
            { email },
            { username },
        ]);
        if (existingUser) {
            return res
                .status(400)
                .json({ error: "Email or username already exists" });
        }
        const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
        let defaultOrg = yield connect_1.AppDataSource.getRepository(Org_1.Org).findOneBy({
            name: "Default Org",
        });
        if (!defaultOrg) {
            defaultOrg = yield connect_1.AppDataSource.getRepository(Org_1.Org).save({
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
        yield userRepository.save(newUser);
        res.status(201).json({ message: "User registered successfully" });
    }
    catch (error) {
        console.error("Error in Register Route:", error);
        res.status(500).json({ error: "Failed to register user" });
    }
}));
router.post("/login", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }
        const user = yield userRepository.findOneBy({ email });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const isMatch = yield bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, username: user.username }, config_1.config.JWT_SECRET, { expiresIn: "1h" });
        res.status(200).json({ message: "Login successful", token });
    }
    catch (error) {
        console.error("Error in Login Route:", error);
        res.status(500).json({ error: "Failed to login" });
    }
}));
//# sourceMappingURL=authRoutes.js.map