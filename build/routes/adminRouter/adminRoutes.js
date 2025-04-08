"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = __importDefault(require("express"));
// import { getUsers, getTestData } from '../../controllers/adminControllers/adminController'
exports.adminRouter = express_1.default.Router();
// adminRouter.get("/users/all", getUsers)
exports.adminRouter.get("/ping", (req, res) => res.send("pong from admin"));
// adminRouter.get('/test', getTestData)
// adminRouter.get('/file', handleFileUpload)
//# sourceMappingURL=adminRoutes.js.map