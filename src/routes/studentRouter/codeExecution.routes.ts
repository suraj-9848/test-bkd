import { Router } from "express";
import {
  executeCode,
  submitCode,
  getQuestionDetails,
  getSupportedLanguages,
} from "../../controllers/studentControllers/codeExecution.controller";
import {
  authMiddleware,
  studentAuthMiddleware,
} from "../../middleware/authMiddleware";
import { viewAsMiddleware } from "../../middleware/viewAsMiddleware";

const router = Router();

router.use(authMiddleware);

const validateCodeExecution = (req: any, res: any, next: any) => {
  const { testId } = req.params;
  const { questionId, code, language } = req.body;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!testId || !uuidRegex.test(testId)) {
    return res.status(400).json({
      error: "Valid test ID is required",
    });
  }

  if (!questionId || !uuidRegex.test(questionId)) {
    return res.status(400).json({
      error: "Valid question ID is required",
    });
  }

  if (!code || typeof code !== "string" || code.trim().length === 0) {
    return res.status(400).json({
      error: "Code cannot be empty",
    });
  }

  const supportedLanguages = [
    "javascript",
    "python",
    "java",
    "cpp",
    "c",
    "csharp",
    "php",
    "ruby",
    "go",
    "rust",
    "kotlin",
    "swift",
    "typescript",
  ];

  if (!language || !supportedLanguages.includes(language)) {
    return res.status(400).json({
      error: "Invalid programming language",
      supportedLanguages,
    });
  }

  next();
};

const validateQuestionDetails = (req: any, res: any, next: any) => {
  const { testId, questionId } = req.params;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!testId || !uuidRegex.test(testId)) {
    return res.status(400).json({
      error: "Valid test ID is required",
    });
  }

  if (!questionId || !uuidRegex.test(questionId)) {
    return res.status(400).json({
      error: "Valid question ID is required",
    });
  }

  next();
};

/**
 * @route POST /tests/:testId/execute
 * @desc Execute code against visible test cases
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
 * @route POST /tests/:testId/submit-code
 * @desc Submit code solution (final submission)
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
 * @route GET /tests/:testId/questions/:questionId
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
 * @route GET /code/languages
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
