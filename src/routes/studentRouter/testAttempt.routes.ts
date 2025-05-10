import { Router } from "express";
import * as TestAttemptController from "../../controllers/studentControllers/testAttempt.controller";
import { authMiddleware } from "../../middleware/authMiddleware";

const router = Router();

// Apply student authentication middleware to all routes
router.use(authMiddleware);

// Available tests
router.get("/available-tests", TestAttemptController.getAvailableTests);

// Test attempt routes
router.post("/tests/:testId/start", TestAttemptController.startTestAttempt);
router.get(
  "/attempts/:attemptId/questions",
  TestAttemptController.getTestQuestions,
);
router.post("/attempts/:attemptId/answers", TestAttemptController.saveAnswer);
router.post("/attempts/:attemptId/submit", TestAttemptController.submitTest);

// Results routes
router.get(
  "/attempts/:attemptId/results",
  TestAttemptController.getTestResults,
);
router.get("/history", TestAttemptController.getTestAttemptHistory);
router.get(
  "/tests/:testId/leaderboard",
  TestAttemptController.getTestLeaderboard,
);

export const testAttemptRouter = router;
