import { NextFunction, Request, Response } from "express";

export function validateCourseBody(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { title, logo, pages_id, content, start_date, end_date, batch_id } =
    req.body;

  if (!title || !batch_id || !start_date || !end_date) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (isNaN(Date.parse(start_date)) || isNaN(Date.parse(end_date))) {
    return res.status(400).json({ message: "Invalid date format" });
  }

  next();
}
