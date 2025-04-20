import express from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { instructorMiddleware } from "../../middleware/instructorMiddleware";
import {
  createCourse,
  updateCourse,
  deleteCourse,
  fetchAllCourses,
  fetchCourse,
} from "../../controllers/instructorControllers/instructorControllers";

const router = express.Router();

router.use(authMiddleware, instructorMiddleware);

router.post("/courses", createCourse);
router.put("/courses/:id", updateCourse);
router.delete("/courses/:id", deleteCourse);
router.get("/courses", fetchAllCourses);
router.get("/courses/:id", fetchCourse);

export const instructorRouter = router;
