import { Router } from "express";
import * as TestManagementController from "../../controllers/instructorControllers/testManagement.controller";
import * as TestEvaluationController from "../../controllers/instructorControllers/testEvaluation.controller";
import { instructorMiddleware } from "../../middleware/instructorMiddleware";
import {
  getSubmissionsForEvaluation,
  getSubmissionForEvaluation,
  evaluateResponse,
  bulkEvaluateResponses,
  getEvaluationStatistics,
} from "../../controllers/instructorControllers/evaluation.controller";
const router = Router();

// Apply instructor authentication middleware to all routes
router.use(instructorMiddleware);

// Test management routes
// Question management routes
router.post("/tests/:testId/questions", TestManagementController.addQuestions);
router.put(
  "/tests/:testId/questions/:questionId",
  TestManagementController.updateQuestion,
);
router.delete(
  "/tests/:testId/questions/:questionId",
  TestManagementController.deleteQuestion,
);

// Test publishing and results
router.put("/tests/:testId/publish", TestManagementController.publishTest);
router.get("/tests/:testId/results", TestManagementController.getTestResults);
router.get(
  "/tests/:testId/statistics",
  TestManagementController.getTestStatistics,
);

// Test evaluation routes
router.get("/tests/:testId/attempts", TestEvaluationController.getTestAttempts);
router.get(
  "/attempts/:attemptId/grade",
  TestEvaluationController.getAttemptForGrading,
);
router.post(
  "/attempts/:attemptId/grade",
  TestEvaluationController.gradeDescriptiveAnswers,
);
router.post(
  "/attempts/:attemptId/finalize",
  TestEvaluationController.finalizeGrading,
);
router.get(
  "/tests/:testId/evaluation-stats",
  TestEvaluationController.getEvaluationStats,
);
// Submission evaluation routes
router.get(
  "/tests/:testId/submissions",
  getSubmissionsForEvaluation,
);
router.get(
  "/tests/:testId/submissions/:submissionId",
  getSubmissionForEvaluation,
);
router.post(
  "/tests/:testId/submissions/:submissionId/evaluate",
  evaluateResponse,
);
router.post(
  "/tests/:testId/submissions/bulk-evaluate",
  bulkEvaluateResponses,
);
router.get(
  "/tests/:testId/evaluation-statistics",
  getEvaluationStatistics,
);

export const testRouter = router;
