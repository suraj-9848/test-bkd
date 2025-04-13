// src/routes/courseProgressRoutes.ts
import express from 'express';
import { updatePage, updateCourseProgressStatus } from '../../controllers/courseProgressControllers/courseProgressController';

const courseProgressRoutes = express.Router();

courseProgressRoutes.post('/page', updatePage);
courseProgressRoutes.post('/status', updateCourseProgressStatus);

export default courseProgressRoutes;