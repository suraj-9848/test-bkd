"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionprogressRouter = void 0;
const express_1 = __importDefault(require("express"));
const sessionProgress_1 = require("../../controllers/sessionProgress/sessionProgress");
exports.sessionprogressRouter = express_1.default.Router();
exports.sessionprogressRouter.post("/session", sessionProgress_1.updateSessionId);
exports.sessionprogressRouter.post("/question", sessionProgress_1.updateQuestionId);
exports.sessionprogressRouter.post("/status", sessionProgress_1.updateStatus);
//# sourceMappingURL=sessionprogressRoutes.js.map