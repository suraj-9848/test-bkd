// src/controllers/courseProgressController.ts
import { Request, Response } from 'express';
import { updateCurrentPage, updateCourseStatus } from '../../utils/courseProgress/courseProgress';

export const updatePage = async (req: Request, res: Response) => {
  const { id, current_page } = req.body;
  try {
    const result = await updateCurrentPage(id, current_page);
    res.json({ message: 'Current page updated successfully', result });
  } catch (err) {
    res.status(500).json({ message: 'Error updating current page', error: err });
  }
};

export const updateCourseProgressStatus = async (req: Request, res: Response) => {
  const { id, status } = req.body;
  try {
    const result = await updateCourseStatus(id, status);
    res.json({ message: 'Course status updated successfully', result });
  } catch (err) {
    res.status(500).json({ message: 'Error updating course status', error: err });
  }
};
