import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { instructorMiddleware } from "../../middleware/instructorMiddleware";
import {
  createTest,
  createTestsBulk,
} from "../../controllers/instructorControllers/testManagement.controller";
import { getTestAnalytics } from "../../controllers/instructorControllers/test.controller";
import {
  createBatch,
  deleteBatch,
  updateBatch,
  fetchAllBatches,
  fetchBatch,
  assignBatchToStudent,
  assignMultipleStudentsToBatch,
} from "../../controllers/instructorControllers/batch.controller";
import {
  getSubmissionsForEvaluation,
  getSubmissionForEvaluation,
  evaluateResponse,
  bulkEvaluateResponses,
  getEvaluationStatistics,
} from "../../controllers/instructorControllers/evaluation.controller";
import {
  createCourse,
  fetchCourse,
  updateCourse,
  deleteCourse,
  fetchAllCoursesinBatch,
  assignCourseToStudent,
} from "../../controllers/courseCrudControllers/courseController";
import {
  fetchTestById,
  updateTest,
  deleteTest,
  fetchTestsInCourse,
  createQuestion,
  getQuestions,
  updateQuestion,
  deleteQuestion,
  teststatustoPublish,
  evaluateTestSubmission,
  getSubmissionCount,
  evaluateTestResponseById,
  getTestResponses,
} from "../../controllers/instructorControllers/test.controller";
import {
  createMCQ,
  deleteMCQ,
  getMCQById,
  getMCQ,
  updateMCQ,
} from "../../controllers/moduleControllers/moduleMCQControllers";
import {
  addDayContent,
  deleteDayContent,
  getDayContent,
  markDayAsCompleted,
  updateDayContent,
} from "../../controllers/moduleControllers/dayContentControllers";
import {
  createModule,
  deleteModule,
  getAllModules,
  getSingleModule,
  updateModule,
} from "../../controllers/moduleControllers/moduleController";
import {
  fetchCourseProgress,
  fetchSessionProgress,
} from "../../controllers/instructorControllers/progress.controller";

const router = Router();

router.use(authMiddleware, instructorMiddleware);

// Batch routes
router.post("/batches", createBatch);
router.get("/batches", fetchAllBatches);
router.get("/batches/:id", fetchBatch);
router.put("/batches/:id", updateBatch);
router.delete("/batches/:id", deleteBatch);
router.post("/batches/:batchId/assign-student", assignBatchToStudent);
router.post("/batches/:batchId/assign-students", assignMultipleStudentsToBatch);

// Course routes (nested under batch)
router.post("/batches/:batchId/courses", createCourse);
router.get("/batches/:batchId/courses", fetchAllCoursesinBatch);
router.get("/batches/:batchId/courses/:id", fetchCourse);
router.put("/batches/:batchId/courses/:id", updateCourse);
router.delete("/batches/:batchId/courses/:id", deleteCourse);
router.put("/batches/:batchId/courses/:courseId/public", updateCourse);
router.post(
  "/batches/:batchId/courses/:courseId/assign-student",
  assignCourseToStudent
);

// Test routes (nested under batch and course)
router.post("/batches/:batchId/courses/:courseId/tests", createTest);
router.post("/batches/:batchId/courses/bulk/tests", createTestsBulk);
router.get("/batches/:batchId/courses/:courseId/tests", fetchTestsInCourse);
router.get("/batches/:batchId/courses/:courseId/tests/:testId", fetchTestById);
router.put("/batches/:batchId/courses/:courseId/tests/:testId", updateTest);
router.delete("/batches/:batchId/courses/:courseId/tests/:testId", deleteTest);
router.patch(
  "/batches/:batchId/courses/:courseId/tests/:testId/publish",
  teststatustoPublish
);
router.post(
  "/batches/:batchId/courses/:courseId/tests/:testId/evaluate",
  evaluateTestSubmission
);
router.get(
  "/batches/:batchId/courses/:courseId/tests/:testId/submission-count",
  getSubmissionCount
);
router.get(
  "/batches/:batchId/courses/:courseId/tests/:testId/submissions",
  getSubmissionsForEvaluation
);
router.get(
  "/batches/:batchId/courses/:courseId/tests/:testId/responses",
  getTestResponses
);
router.put(
  "/batches/:batchId/courses/:courseId/tests/:testId/responses/:responseId/evaluate",
  evaluateTestResponseById
);

// Test Routes of Questions in test
router.get(
  "/batches/:batchId/courses/:courseId/tests/:testId/questions",
  getQuestions
);
router.post(
  "/batches/:batchId/courses/:courseId/tests/:testId/questions",
  createQuestion
);
router.delete(
  "/batches/:batchId/courses/:courseId/tests/:testId/questions/:questionId",
  deleteQuestion
);
router.put(
  "/batches/:batchId/courses/:courseId/tests/:testId/questions/:questionId",
  updateQuestion
);
router.get(
  "/batches/:batchId/courses/:courseId/tests/:testId/analytics",
  getTestAnalytics
);

// Module routes (nested under batch and course)
router.post("/batches/:batchId/courses/:courseId/modules", createModule);
router.get("/batches/:batchId/courses/:courseId/modules", getAllModules);
router.get(
  "/batches/:batchId/courses/:courseId/modules/:moduleId",
  getSingleModule
);
router.put(
  "/batches/:batchId/courses/:courseId/modules/:moduleId",
  updateModule
);
router.delete(
  "/batches/:batchId/courses/:courseId/modules/:moduleId",
  deleteModule
);

// Day Content routes (nested under batch, course, and module)
router.post(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/day-content",
  addDayContent
);
router.get(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/day-content",
  getDayContent
);
router.put(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/day-content/:dayId",
  updateDayContent
);
router.delete(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/day-content/:dayId",
  deleteDayContent
);
router.patch(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/day-content/:dayId/complete",
  markDayAsCompleted
);

// MCQ routes (nested under batch, course, and module)
router.post(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/mcq",
  createMCQ
);
router.get("/batches/:batchId/courses/:courseId/modules/:moduleId/mcq", getMCQ);
router.get(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/mcq/:mcqId",
  getMCQById
);
router.put(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/mcq/:mcqId",
  updateMCQ
);
router.delete(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/mcq/:mcqId",
  deleteMCQ
);

// Evaluation routes
router.get(
  "/batches/:batchId/courses/:courseId/tests/:testId/submissions",
  getSubmissionsForEvaluation
);
router.get(
  "/batches/:batchId/courses/:courseId/tests/:testId/submissions/:submissionId",
  getSubmissionForEvaluation
);
router.post(
  "/batches/:batchId/courses/:courseId/tests/:testId/submissions/:submissionId/evaluate",
  evaluateResponse
);
router.post(
  "/batches/:batchId/courses/:courseId/tests/:testId/submissions/bulk-evaluate",
  bulkEvaluateResponses
);
router.get(
  "/batches/:batchId/courses/:courseId/tests/:testId/evaluation-statistics",
  getEvaluationStatistics
);

// Progress tracking routes
router.get("/batches/:batchId/courses/:courseId/progress", fetchCourseProgress);
router.get("/sessions/:sessionId/progress", fetchSessionProgress);

// Direct course update route (for batch assignments)
router.put("/courses/:id", updateCourse);

export const instructorRouter = router;