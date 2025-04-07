"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = __importDefault(require("express"));
const createCourse_1 = require("../../controllers/adminControllers/createCourse");
//import { getUsers, getTestData } from '../../controllers/adminControllers/adminController'
exports.adminRouter = express_1.default.Router();
// adminRouter.get("/users/all", getUsers)
// adminRouter.get("/ping", (req, res) => res.send("pong from admin"))
// adminRouter.get('/test', getTestData)
// adminRouter.get('/file', handleFileUpload)
exports.adminRouter.post('/create-course', createCourse_1.createCourse);
//# sourceMappingURL=adminRoutes.js.map