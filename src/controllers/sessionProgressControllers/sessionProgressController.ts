// src/controllers/sessionProgressController.ts
import { Request, Response } from 'express';
import { updateSessionId, updateQuestionId, updateStatus } from '../../utils/sessionProgress/sessionProgress';
export const updateSession = async (req: Request, res: Response) => {
  const { id, session_id } = req.body;
  try {
    const result = await updateSessionId(id, session_id);
    res.json({ message: 'Session ID updated successfully', result });
  } catch (err) {
    res.status(500).json({ message: 'Error updating session ID', error: err });
  }
};

export const updateQuestion = async (req: Request, res: Response) => {
  const { id, question_id } = req.body;
  try {
    const result = await updateQuestionId(id, question_id);
    res.json({ message: 'Question ID updated successfully', result });
  } catch (err) {
    res.status(500).json({ message: 'Error updating question ID', error: err });
  }
};

export const updateSessionStatus = async (req: Request, res: Response) => {
  const { id, status } = req.body;
  try {
    const result = await updateStatus(id, status);
    res.json({ message: 'Session status updated successfully', result });
  } catch (err) {
    res.status(500).json({ message: 'Error updating status', error: err });
  }
};
