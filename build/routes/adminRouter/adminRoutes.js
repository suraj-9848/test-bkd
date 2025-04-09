"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = __importDefault(require("express"));
const adminController_1 = require("../../controllers/adminControllers/adminController");
exports.adminRouter = express_1.default.Router();
exports.adminRouter.get("/users/all", adminController_1.getUsers);
exports.adminRouter.get("/ping", (req, res) => res.send("pong from admin"));
exports.adminRouter.get('/test', adminController_1.getTestData);
// adminRouter.get('/file', handleFileUpload)
//# sourceMappingURL=adminRoutes.js.map