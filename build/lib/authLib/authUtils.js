"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTokenAndSend = exports.userProtect = void 0;
const jwt = __importStar(require("jsonwebtoken"));
const config_1 = require("../../config");
const logger = require("../../utils/logger").getLoggerByName("Auth Utils");
const userProtect = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let token;
        if (req.cookies.jwt) {
            token = req.cookies.jwt;
        }
        if (!token) {
            for (let i of Object.keys(req.cookies)) {
                res.clearCookie(i);
            }
            return res.status(401)
                .json({
                status: "token_is_expired",
                error: "You are not logged in! Please log in with google."
            });
        }
        const decoded = jwt.verify(token, config_1.config.JWT_SECRET);
        req["user"] = Object.assign(Object.assign({}, decoded), { token });
        return next();
    }
    catch (error) {
        for (let i of Object.keys(req.cookies)) {
            res.clearCookie(i);
        }
        logger.error(error);
        return res.status(401).json({
            status: "token_is_expired",
            message: "You are not logged in! Please log in with google.",
        });
    }
});
exports.userProtect = userProtect;
const signToken = (id, role, profilePicture, updatedUsername, firstName) => {
    return jwt.sign({ id, role, profilePicture, updatedUsername, firstName }, config_1.config.JWT_SECRET, {
        expiresIn: config_1.config.JWT_EXPIRES_IN,
    });
};
const createTokenAndSend = (user, statusCode, res, firstLogin) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const token = signToken(user.id, user.role, user.avatar, user.userName, user.name);
        const cookieOptions = {
            maxAge: config_1.config.JWT_COOKIE_EXPIRES_IN,
            httpOnly: true,
        };
        if (process.env.NODE_ENV === "production")
            cookieOptions.secure = true;
        res.cookie("jwt", token, cookieOptions);
        user.tokens = undefined;
        logger.info(user, token);
        res.status(statusCode).json({
            status: "success",
            token,
            data: {
                user,
            },
        });
    }
    catch (error) {
        logger.error("ERROR In createTokenAndSend", error);
        res.status(500).json({
            status: "error",
            message: error.message,
        });
    }
});
exports.createTokenAndSend = createTokenAndSend;
//# sourceMappingURL=authUtils.js.map