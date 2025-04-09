import express from "express";
import {updateSessionId,updateCurrentPage,updateStatus} from "../../controllers/courseProgress/courseProgress";

export const courseprogressRouter=express.Router();
courseprogressRouter.post("/session",updateSessionId);
courseprogressRouter.post("/page",updateCurrentPage);
courseprogressRouter.post("/status",updateStatus);