// src/routes/sessionProgressRoutes.ts
import express from 'express';
import { updateSession, updateQuestion, updateSessionStatus } from '../../controllers/sessionProgressControllers/sessionProgressController';

const sessionProgressRoutes = express.Router();

sessionProgressRoutes.post('/session', updateSession);
sessionProgressRoutes.post('/question', updateQuestion);
sessionProgressRoutes.post('/status', updateSessionStatus);

export default sessionProgressRoutes;
