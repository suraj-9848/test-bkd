import express from "express";
import { updateSessionProgress } from "../../controllers/sessionProgressControllers/sessionProgressController";

const sessionProgressRouter = express.Router();

sessionProgressRouter.post("/updateSessionProgress", updateSessionProgress);

export default sessionProgressRouter;
