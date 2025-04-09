"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.courseprogressRouter = void 0;
const express_1 = __importDefault(require("express"));
const courseProgress_1 = require("../../controllers/courseProgress/courseProgress");
exports.courseprogressRouter = express_1.default.Router();
exports.courseprogressRouter.post("/session", courseProgress_1.updateSessionId);
exports.courseprogressRouter.post("/page", courseProgress_1.updateCurrentPage);
exports.courseprogressRouter.post("/status", courseProgress_1.updateStatus);
//# sourceMappingURL=courseprogressRoutes.js.map