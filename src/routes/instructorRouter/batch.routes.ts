import { Router, Request, Response } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { instructorMiddleware } from "../../middleware/instructorMiddleware";
import { viewAsMiddleware } from "../../middleware/viewAsMiddleware";

import {
  createTest,
  createTestsBulk,
  createQuestion,
  getQuestions,
  updateQuestion,
  deleteQuestion,
  publishTest,
} from "../../controllers/instructorControllers/testManagement.controller";

import {
  authDebugMiddleware,
  validateJWTMiddleware,
  validateDayContentMiddleware,
} from "../../middleware/authDebugMiddleware";

import {
  addDayContent,
  getDayContent,
  getSingleDayContent,
  updateDayContent,
  deleteDayContent,
  markDayAsCompleted,
} from "../../controllers/moduleControllers/dayContentControllers";

import {
  getTestAnalytics,
  fetchTestById,
  updateTest,
  deleteTest,
  fetchTestsInCourse,
  evaluateTestSubmission,
  getSubmissionCount,
  evaluateTestResponseById,
  getTestResponses,
} from "../../controllers/instructorControllers/test.controller";

import {
  createBatch,
  deleteBatch,
  updateBatch,
  fetchAllBatches,
  fetchBatch,
  assignBatchToStudent,
  assignMultipleStudentsToBatch,
  fetchBatchStudents,
  getStudentCourseScores,
  removeMultipleStudentsFromBatch,
  removeBatchFromStudent,
  getBatchStudents,
  checkStudentBatchAssignment,
  transferStudentBetweenBatches,
  assignMultipleStudentsToBatchEnhanced,
  getStudentsWithBatches,
  getUserBatches,
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
  getCourseAnalytics,
} from "../../controllers/courseCrudControllers/courseController";

import {
  createMCQ,
  deleteMCQ,
  getMCQById,
  getMCQ,
  updateMCQ,
} from "../../controllers/moduleControllers/moduleMCQControllers";

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

router.use(authMiddleware, viewAsMiddleware, instructorMiddleware);

// Batch routes
router.post("/batches", createBatch);
router.get("/batches", fetchAllBatches);
router.get("/batches/:id", fetchBatch);
router.put("/batches/:id", updateBatch);
router.delete("/batches/:id", deleteBatch);
router.post("/batches/:batchId/assign-student", assignBatchToStudent);
router.post("/batches/:batchId/assign-students", assignMultipleStudentsToBatch);

router.get("/batches/:batchId/students", fetchBatchStudents);
router.get(
  "/batches/:batchId/courses/:courseId/students/:studentId/scores",
  getStudentCourseScores,
);

// Course routes
router.post("/batches/:batchId/courses", createCourse);
router.get("/batches/:batchId/courses", fetchAllCoursesinBatch);
router.get("/batches/:batchId/courses/:id", fetchCourse);
router.put("/batches/:batchId/courses/:id", updateCourse);
router.delete("/batches/:batchId/courses/:id", deleteCourse);
router.put("/batches/:batchId/courses/:courseId/public", updateCourse);
router.post(
  "/batches/:batchId/courses/:courseId/assign-student",
  assignCourseToStudent,
);

//  FIXED: Test routes using correct controller functions
router.post("/batches/:batchId/courses/:courseId/tests", createTest);
router.post("/batches/:batchId/courses/bulk/tests", createTestsBulk);
router.get("/batches/:batchId/courses/:courseId/tests", fetchTestsInCourse);
router.get("/batches/:batchId/courses/:courseId/tests/:testId", fetchTestById);
router.put("/batches/:batchId/courses/:courseId/tests/:testId", updateTest);
router.delete("/batches/:batchId/courses/:courseId/tests/:testId", deleteTest);

//  FIXED: Test publishing using correct controller function
router.patch(
  "/batches/:batchId/courses/:courseId/tests/:testId/publish",
  publishTest, //  FIXED: Use publishTest from testManagement controller
);

// Test evaluation routes (using test.controller)
router.post(
  "/batches/:batchId/courses/:courseId/tests/:testId/evaluate",
  evaluateTestSubmission,
);
router.get(
  "/batches/:batchId/courses/:courseId/tests/:testId/submission-count",
  getSubmissionCount,
);
router.get(
  "/batches/:batchId/courses/:courseId/tests/:testId/submissions",
  getSubmissionsForEvaluation,
);
router.get(
  "/batches/:batchId/courses/:courseId/tests/:testId/responses",
  getTestResponses,
);
router.put(
  "/batches/:batchId/courses/:courseId/tests/:testId/responses/:responseId/evaluate",
  evaluateTestResponseById,
);

//  FIXED: Question management routes using correct controller functions
router.get(
  "/batches/:batchId/courses/:courseId/tests/:testId/questions",
  getQuestions, //  FIXED: Use getQuestions from testManagement controller
);
router.post(
  "/batches/:batchId/courses/:courseId/tests/:testId/questions",
  createQuestion, //  FIXED: Use createQuestion from testManagement controller
);
router.put(
  "/batches/:batchId/courses/:courseId/tests/:testId/questions/:questionId",
  updateQuestion, //  FIXED: Use updateQuestion from testManagement controller
);
router.delete(
  "/batches/:batchId/courses/:courseId/tests/:testId/questions/:questionId",
  deleteQuestion, //  FIXED: Use deleteQuestion from testManagement controller
);

router.get(
  "/batches/:batchId/courses/:courseId/tests/:testId/analytics",
  getTestAnalytics,
);

// Module routes
router.post("/batches/:batchId/courses/:courseId/modules", createModule);
router.get("/batches/:batchId/courses/:courseId/modules", getAllModules);

// Course analytics route
router.get("/batches/:batchId/courses/:courseId/analytics", getCourseAnalytics);
router.get(
  "/batches/:batchId/courses/:courseId/modules/:moduleId",
  getSingleModule,
);
router.put(
  "/batches/:batchId/courses/:courseId/modules/:moduleId",
  updateModule,
);
router.delete(
  "/batches/:batchId/courses/:courseId/modules/:moduleId",
  deleteModule,
);

// Day content routes
router.post(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/day-content",
  addDayContent,
);
router.get(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/day-content",
  getDayContent,
);
router.put(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/day-content/:dayId",
  updateDayContent,
);
router.delete(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/day-content/:dayId",
  deleteDayContent,
);
router.patch(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/day-content/:dayId/complete",
  markDayAsCompleted,
);

// MCQ routes
router.post(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/mcq",
  createMCQ,
);
router.get("/batches/:batchId/courses/:courseId/modules/:moduleId/mcq", getMCQ);
router.get(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/mcq/:mcqId",
  getMCQById,
);
router.put(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/mcq/:mcqId",
  updateMCQ,
);
router.delete(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/mcq/:mcqId",
  deleteMCQ,
);

// Evaluation routes
router.get(
  "/batches/:batchId/courses/:courseId/tests/:testId/submissions",
  getSubmissionsForEvaluation,
);
router.get(
  "/batches/:batchId/courses/:courseId/tests/:testId/submissions/:submissionId",
  getSubmissionForEvaluation,
);
router.post(
  "/batches/:batchId/courses/:courseId/tests/:testId/submissions/:submissionId/evaluate",
  evaluateResponse,
);
router.post(
  "/batches/:batchId/courses/:courseId/tests/:testId/submissions/bulk-evaluate",
  bulkEvaluateResponses,
);
router.get(
  "/batches/:batchId/courses/:courseId/tests/:testId/evaluation-statistics",
  getEvaluationStatistics,
);

// Progress routes
router.get("/batches/:batchId/courses/:courseId/progress", fetchCourseProgress);
router.get("/sessions/:sessionId/progress", fetchSessionProgress);
router.get("/students-with-batches", getStudentsWithBatches);

router.get("/users/:userId/batches", getUserBatches);

router.post(
  "/:batchId/assign-multiple-enhanced",
  assignMultipleStudentsToBatchEnhanced,
);

router.get("/:batchId/students", getBatchStudents);
router.get("/:batchId/students/:studentId/check", checkStudentBatchAssignment);
router.post("/transfer-student", transferStudentBetweenBatches);

// Bulk assignment route
router.post("/bulk-assign", async (req: Request, res: Response) => {
  try {
    const { assignments } = req.body;

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({
        message: "assignments array is required and cannot be empty",
      });
    }

    const results = [];
    const errors = [];

    for (const assignment of assignments) {
      const { batchId, studentIds } = assignment;

      try {
        const mockReq = {
          params: { batchId },
          body: { userIds: studentIds },
        } as any;
        const mockRes = {
          status: (code: number) => ({
            json: (data: any) => ({ statusCode: code, data }),
          }),
        } as any;

        const result = await assignMultipleStudentsToBatchEnhanced(
          mockReq,
          mockRes,
        );

        results.push({
          batchId,
          studentIds,
          success: true,
          result,
        });
      } catch (error) {
        errors.push({
          batchId,
          studentIds,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return res.status(200).json({
      message: `Bulk assignment completed: ${results.length} successful, ${errors.length} failed`,
      results,
      errors: errors.length > 0 ? errors : undefined,
      totalAssignments: assignments.length,
      successCount: results.length,
      errorCount: errors.length,
    });
  } catch (err) {
    console.error("Error in bulk assignment:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.delete(
  "/batches/:batchId/remove-students",
  removeMultipleStudentsFromBatch,
);
router.delete("/batches/:batchId/remove-student", removeBatchFromStudent);

router.post(
  "/batches/transfer-student",
  async (req: Request, res: Response) => {
    try {
      const { studentId, fromBatchId, toBatchId } = req.body;

      if (!studentId || !fromBatchId || !toBatchId) {
        return res.status(400).json({
          message: "studentId, fromBatchId, and toBatchId are required",
        });
      }

      await removeBatchFromStudent(
        {
          params: { batchId: fromBatchId },
          body: { userId: studentId },
        } as any,
        res as any,
      );

      await assignBatchToStudent(
        { params: { batchId: toBatchId }, body: { userId: studentId } } as any,
        res as any,
      );

      return res.status(200).json({
        message: "Student transferred successfully",
        studentId,
        fromBatchId,
        toBatchId,
      });
    } catch (err) {
      console.error("Transfer error:", err);
      return res.status(500).json({ message: "Transfer failed" });
    }
  },
);

// Day content routes with enhanced debugging
router.use(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/day-content*",
  authDebugMiddleware,
);

router.post(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/day-content",
  validateJWTMiddleware,
  validateDayContentMiddleware,
  addDayContent,
);

router.get(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/day-content",
  validateJWTMiddleware,
  getDayContent,
);

router.get(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/day-content/:dayId",
  validateJWTMiddleware,
  getSingleDayContent,
);

router.put(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/day-content/:dayId",
  validateJWTMiddleware,
  validateDayContentMiddleware,
  updateDayContent,
);

router.delete(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/day-content/:dayId",
  validateJWTMiddleware,
  deleteDayContent,
);

router.patch(
  "/batches/:batchId/courses/:courseId/modules/:moduleId/day-content/:dayId/complete",
  validateJWTMiddleware,
  markDayAsCompleted,
);

router.put("/courses/:id", updateCourse);

export const instructorRouter = router;
