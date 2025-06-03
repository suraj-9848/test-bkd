import { Request, Response, NextFunction } from "express";

export const validateJobBody = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const {
    title,
    companyName,
    description,
    skills,
    eligibleBranches,
    org_id,
    location,
  } = req.body;

  // Check for required fields
  if (
    !title ||
    !companyName ||
    !description ||
    !skills ||
    !eligibleBranches ||
    !org_id ||
    !location
  ) {
    return res.status(400).json({
      message: "Missing required fields",
      required: [
        "title",
        "companyName",
        "description",
        "skills",
        "eligibleBranches",
        "org_id",
        "location",
      ],
    });
  }

  // Validate field types
  if (
    typeof title !== "string" ||
    typeof companyName !== "string" ||
    typeof description !== "string"
  ) {
    return res.status(400).json({
      message: "Invalid field types",
      details: "title, companyName, and description must be strings",
    });
  }

  // Validate arrays
  if (!Array.isArray(skills) || !Array.isArray(eligibleBranches)) {
    // Try to convert to arrays if they are strings
    if (typeof skills === "string") {
      req.body.skills = [skills];
    } else if (!Array.isArray(skills)) {
      return res.status(400).json({
        message: "Invalid field type",
        details: "skills must be an array or string",
      });
    }

    if (typeof eligibleBranches === "string") {
      req.body.eligibleBranches = [eligibleBranches];
    } else if (!Array.isArray(eligibleBranches)) {
      return res.status(400).json({
        message: "Invalid field type",
        details: "eligibleBranches must be an array or string",
      });
    }
  }

  next();
};

export const validateApplicationBody = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Check if resume file exists
  if (!req.file) {
    return res.status(400).json({
      message: "Resume file is required",
    });
  }

  // Check file type (already handled by multer, but double-checking)
  if (req.file.mimetype !== "application/pdf") {
    return res.status(400).json({
      message: "Only PDF files are allowed for resumes",
    });
  }

  // For anonymous applications, require name and email
  if (!req.user && (!req.body.applicantName || !req.body.applicantEmail)) {
    return res.status(400).json({
      message: "Name and email are required for applications",
    });
  }

  // Validate email format if provided
  if (req.body.applicantEmail && !isValidEmail(req.body.applicantEmail)) {
    return res.status(400).json({
      message: "Invalid email format",
    });
  }

  // Convert skills to array if needed
  if (req.body.skills && !Array.isArray(req.body.skills)) {
    if (typeof req.body.skills === "string") {
      req.body.skills = [req.body.skills];
    } else {
      req.body.skills = [];
    }
  }

  next();
};

// Helper function to validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
