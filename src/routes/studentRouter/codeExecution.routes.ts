import { Router } from "express";
import {
  executeCode,
  submitCode,
  getQuestionDetails,
  getSupportedLanguages,
} from "../../controllers/studentControllers/codeExecution.controller";
import { authMiddleware } from "../../middleware/authMiddleware";
import { studentAuthMiddleware } from "../../middleware/authMiddleware";
import { viewAsMiddleware } from "../../middleware/viewAsMiddleware";

const router = Router();

// Validation middleware for code execution
const validateCodeExecution = (req: any, res: any, next: any) => {
  const { questionId, code, language } = req.body;

  if (!questionId || typeof questionId !== "string") {
    return res.status(400).json({
      success: false,
      error: "Question ID is required and must be a string",
    });
  }

  if (!code || typeof code !== "string" || code.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: "Code is required and cannot be empty",
    });
  }

  if (!language || typeof language !== "string") {
    return res.status(400).json({
      success: false,
      error: "Programming language is required",
    });
  }

  // Validate testId in params
  const { testId } = req.params;
  if (!testId || typeof testId !== "string") {
    return res.status(400).json({
      success: false,
      error: "Test ID is required in URL parameters",
    });
  }

  // Basic UUID validation for testId
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(testId)) {
    return res.status(400).json({
      success: false,
      error: "Invalid test ID format",
    });
  }

  next();
};

// Validation middleware for question details
const validateQuestionDetails = (req: any, res: any, next: any) => {
  const { testId, questionId } = req.params;

  if (!testId || !questionId) {
    return res.status(400).json({
      success: false,
      error: "Test ID and Question ID are required",
    });
  }

  // Basic UUID validation
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(testId) || !uuidRegex.test(questionId)) {
    return res.status(400).json({
      success: false,
      error: "Invalid ID format",
    });
  }

  next();
};

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route POST /api/student/tests/:testId/execute
 * @desc Execute code against visible test cases only (for testing/debugging)
 * @access Private (Student)
 */
router.post(
  "/tests/:testId/execute",
  viewAsMiddleware,
  studentAuthMiddleware,
  validateCodeExecution,
  executeCode,
);

/**
 * @route POST /api/student/tests/:testId/submit-code
 * @desc Submit code solution (final submission with all test cases)
 * @access Private (Student)
 */
router.post(
  "/tests/:testId/submit-code",
  viewAsMiddleware,
  studentAuthMiddleware,
  validateCodeExecution,
  submitCode,
);

/**
 * @route GET /api/student/tests/:testId/questions/:questionId
 * @desc Get question details with visible test cases
 * @access Private (Student)
 */
router.get(
  "/tests/:testId/questions/:questionId",
  viewAsMiddleware,
  studentAuthMiddleware,
  validateQuestionDetails,
  getQuestionDetails,
);

/**
 * @route GET /api/student/code/languages
 * @desc Get supported programming languages
 * @access Private (Student)
 */
router.get(
  "/code/languages",
  viewAsMiddleware,
  studentAuthMiddleware,
  getSupportedLanguages,
);

export default router;
