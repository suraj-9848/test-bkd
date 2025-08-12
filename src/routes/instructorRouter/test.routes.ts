import { Router } from "express";
import * as TestManagementController from "../../controllers/instructorControllers/testManagement.controller";
import * as TestEvaluationController from "../../controllers/instructorControllers/testEvaluation.controller";
import { authMiddleware } from "../../middleware/authMiddleware";
import { instructorMiddleware } from "../../middleware/instructorMiddleware";
import { viewAsMiddleware } from "../../middleware/viewAsMiddleware";
import {
  getSubmissionsForEvaluation,
  getSubmissionForEvaluation,
  evaluateResponse,
  bulkEvaluateResponses,
  getEvaluationStatistics,
} from "../../controllers/instructorControllers/evaluation.controller";
import { deleteQuestion } from "../../controllers/instructorControllers/test.controller";

const router = Router();

// Apply middleware chain: auth -> viewAs -> instructor
router.use(authMiddleware, viewAsMiddleware, instructorMiddleware);

// Test management routes
router.post("/tests/:testId/questions", TestManagementController.addQuestions);
router.put(
  "/tests/:testId/questions/:questionId",
  TestManagementController.updateQuestion,
);
router.get("/tests/:testId/questions", TestManagementController.getQuestions);
router.delete("/tests/:testId/questions/:questionId", deleteQuestion);

// Enhanced coding question routes
router.post(
  "/tests/:testId/questions/:questionId/upload-testcases",
  TestManagementController.uploadTestCaseFile,
);

router.get("/demo-testcases", TestManagementController.getDemoTestCaseFile);

// Test publishing and results
router.put("/tests/:testId/publish", TestManagementController.publishTest);
router.get("/tests/:testId/results", TestManagementController.getTestResults);

// Evaluation routes
router.get("/submissions/evaluation", getSubmissionsForEvaluation);
router.get("/submissions/:submissionId/evaluation", getSubmissionForEvaluation);
router.post("/submissions/:submissionId/evaluate", evaluateResponse);
router.post("/submissions/bulk-evaluate", bulkEvaluateResponses);
router.get("/evaluation/statistics", getEvaluationStatistics);

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

export default router;
