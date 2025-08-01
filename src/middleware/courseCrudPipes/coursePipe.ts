import { NextFunction, Request, Response } from "express";

export function validateCourseBody(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { title, start_date, end_date, is_public, instructor_name, batch_ids } =
    req.body;

  console.log("=== COURSE VALIDATION DEBUG ===");
  console.log("Request body:", JSON.stringify(req.body, null, 2));

  // Basic required fields
  if (
    !title ||
    !start_date ||
    !end_date ||
    is_public === undefined ||
    !instructor_name
  ) {
    return res.status(400).json({
      message:
        "Missing required fields: title, start_date, end_date, is_public, instructor_name are required",
    });
  }

  // For private courses, batch_ids must be provided and non-empty
  if (
    !is_public &&
    (!batch_ids || !Array.isArray(batch_ids) || batch_ids.length === 0)
  ) {
    return res.status(400).json({
      message:
        "Private courses require at least one batch_id in batch_ids array",
    });
  }

  // Date validation
  if (isNaN(Date.parse(start_date)) || isNaN(Date.parse(end_date))) {
    return res.status(400).json({ message: "Invalid date format" });
  }

  // Date logic validation
  if (new Date(start_date) >= new Date(end_date)) {
    return res
      .status(400)
      .json({ message: "End date must be after start date" });
  }

  console.log("✅ Course validation passed");
  next();
}
