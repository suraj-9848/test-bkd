import express from "express";
import { updateCourseProgress } from "../../controllers/courseProgressControllers/courseProgressController";

const courseProgressrouter = express.Router();

courseProgressrouter.post("/updateCourseProgress", updateCourseProgress);

export default courseProgressrouter;