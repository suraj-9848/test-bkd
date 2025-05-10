import { Router } from "express";
import * as TestManagementController from "../../controllers/instructorControllers/testManagement.controller";
import * as TestEvaluationController from "../../controllers/instructorControllers/testEvaluation.controller";
import { instructorMiddleware } from "../../middleware/instructorMiddleware";

const router = Router();

// Apply instructor authentication middleware to all routes
router.use(instructorMiddleware);

// Test management routes
router.post("/courses/:courseId/tests", TestManagementController.createTest);
router.get(
  "/courses/:courseId/tests",
  TestManagementController.getTestsByCourse,
);
router.get("/tests/:testId", TestManagementController.getTestById);
router.put("/tests/:testId", TestManagementController.updateTest);
router.delete("/tests/:testId", TestManagementController.deleteTest);

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

export const testRouter = router;
