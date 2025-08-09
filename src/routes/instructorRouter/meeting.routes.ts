import express from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { viewAsMiddleware } from "../../middleware/viewAsMiddleware";
import { instructorMiddleware } from "../../middleware/instructorMiddleware";
import {
  createMeeting,
  getMeetingsForCourse,
  getMeetingById,
  updateMeeting,
  deleteMeeting,
} from "../../controllers/meetingControllers/meetingController";

const router = express.Router();

router.use(authMiddleware, viewAsMiddleware, instructorMiddleware);

// POST /instructor/courses/:courseId/meetings
router.post("/courses/:courseId/meetings", createMeeting);
// GET /instructor/courses/:courseId/meetings
router.get("/courses/:courseId/meetings", getMeetingsForCourse);
// GET /instructor/courses/:courseId/meetings/:meetingId
router.get("/courses/:courseId/meetings/:meetingId", getMeetingById);
// PATCH /instructor/courses/:courseId/meetings/:meetingId
router.patch("/courses/:courseId/meetings/:meetingId", updateMeeting);
// DELETE /instructor/courses/:courseId/meetings/:meetingId
router.delete("/courses/:courseId/meetings/:meetingId", deleteMeeting);

export default router;
