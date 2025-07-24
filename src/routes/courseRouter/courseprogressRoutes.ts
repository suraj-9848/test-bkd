import express from "express";
import multer from "multer";
import { updateCourseProgress } from "../../controllers/courseProgressControllers/courseProgressController";
import {uploadCourseLogo} from "../../controllers/courseCrudControllers/courseController";

const courseProgressrouter = express.Router();
const upload = multer();

courseProgressrouter.post("/updateCourseProgress", updateCourseProgress);
courseProgressrouter.post("/upload-logo", upload.single("logo"), uploadCourseLogo);
export default courseProgressrouter;
