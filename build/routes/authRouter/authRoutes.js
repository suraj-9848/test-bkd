"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = __importDefault(require("express"));
exports.authRouter = express_1.default.Router();
const authController_1 = require("../../controllers/authControllers/authController");
const authUtils_1 = require("../../lib/authLib/authUtils");
exports.authRouter.post("/signin", authController_1.SignIn);
exports.authRouter.get("/logout", authUtils_1.userProtect, authController_1.logOut);
//# sourceMappingURL=authRoutes.js.map