import express from "express";
import {updateSessionId,updateQuestionId,updateStatus} from "../../controllers/sessionProgress/sessionProgress";

export const sessionprogressRouter=express.Router();

sessionprogressRouter.post("/session",updateSessionId);
sessionprogressRouter.post("/question",updateQuestionId);
sessionprogressRouter.post("/status",updateStatus);