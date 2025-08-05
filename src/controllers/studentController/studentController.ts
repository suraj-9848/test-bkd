import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import { In, Not } from "typeorm";

import { Course } from "../../db/mysqlModels/Course";
import { Module } from "../../db/mysqlModels/Module";
import { UserCourse } from "../../db/mysqlModels/UserCourse";
import { DayContent } from "../../db/mysqlModels/DayContent";
import { ModuleMCQ } from "../../db/mysqlModels/ModuleMCQ";
import { ModuleMCQResponses } from "../../db/mysqlModels/ModuleMCQResponses";
import { Test } from "../../db/mysqlModels/Test";
import { TestSubmission } from "../../db/mysqlModels/TestSubmission";
import { TestResponse } from "../../db/mysqlModels/TestResponse";
import { ModuleMCQAnswer } from "../../db/mysqlModels/ModuleMCQAnswer";
import { User } from "../../db/mysqlModels/User";
import { UserDayCompletion } from "../../db/mysqlModels/UserDayCompletion";
import { Batch } from "../../db/mysqlModels/Batch";
import {
  getAllRecordsWithFilter,
  getSingleRecord,
  createRecord,
  updateRecords,
} from "../../lib/dbLib/sqlUtils";

// Helper function to determine test status
function getTestStatus(
  test: Test,
  currentTime: Date,
): "UPCOMING" | "ONGOING" | "COMPLETED" {
  const startDate = new Date(test.startDate);
  const endDate = new Date(test.endDate);

  if (currentTime < startDate) {
    return "UPCOMING";
  } else if (currentTime > endDate) {
    return "COMPLETED";
  } else {
    return "ONGOING";
  }
}

// GET /student/tests
export const getStudentTests = async (req: Request, res: Response) => {
  try {
    const studentId = req.user.id;

    // Get courses explicitly assigned to student using utility function
    const userCourses = await getAllRecordsWithFilter(
      UserCourse,
      {
        where: { user: { id: studentId } },
        relations: ["course"],
      },
      `student:${studentId}:user_courses:tests`,
      true,
      5 * 60,
    ); // Cache for 5 minutes

    const assignedCourses = userCourses.map((uc) => uc.course);
    const assignedCourseIds = assignedCourses.map((course) => course.id);

    // Get all public courses that are not already assigned to this student using utility function
    const publicCourses = await getAllRecordsWithFilter(
      Course,
      {
        where: {
          is_public: true,
          id: Not(In(assignedCourseIds.length > 0 ? assignedCourseIds : [""])),
        },
      },
      `public_courses:tests:excluding:${assignedCourseIds.join(",")}`,
      true,
      10 * 60,
    ); // Cache for 10 minutes

    // Combine assigned courses and public courses
    const allCourses = [...assignedCourses, ...publicCourses];
    const allCourseIds = allCourses.map((course) => course.id);

    if (!allCourseIds.length) {
      return res
        .status(200)
        .json({ message: "No courses available", data: { tests: [] } });
    }

    // Get all published tests from all courses (assigned + public) using utility function
    const tests = await getAllRecordsWithFilter(
      Test,
      {
        where: {
          course: { id: In(allCourseIds) },
          status: "PUBLISHED",
        },
        relations: ["course"],
        order: { startDate: "ASC" },
      },
      `tests:published:courses:${allCourseIds.join(",")}`,
      true,
      8 * 60,
    ); // Cache for 8 minutes

    // Process tests to include status, sanitize data, and add batch info
    const currentTime = new Date();
    const processedTests = tests.map((test) => {
      // Try to get batch info if present (test.batch or test.batchId)
      let batch = null;
      if (test.batch) {
        batch = {
          id: test.batch.id,
          name: test.batch.name,
        };
      } else if (test.batchId && test.batchName) {
        batch = {
          id: test.batchId,
          name: test.batchName,
        };
      }
      return {
        id: test.id,
        title: test.title,
        description: test.description,
        maxMarks: test.maxMarks,
        passingMarks: test.passingMarks,
        durationInMinutes: test.durationInMinutes,
        startDate: test.startDate,
        endDate: test.endDate,
        maxAttempts: test.maxAttempts,
        testStatus: getTestStatus(test, currentTime),
        course: {
          id: test.course.id,
          title: test.course.title,
        },
        batch, // May be null if not present
      };
    });

    res.status(200).json({
      message: "Tests fetched successfully",
      data: { tests: processedTests },
    });
  } catch (error) {
    console.error("Error fetching student tests:", error);
    res
      .status(500)
      .json({ error: "Unable to fetch tests", details: error.message });
  }
};

// GET /student/tests/:testId
export const getStudentTestById = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const student = req.user as User;

    // Fetch the test details with relations using TypeORM
    const test = await Test.findOne({
      where: { id: testId },
      relations: ["course", "questions", "questions.options"],
    });

    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    // Check course enrollment
    const userCourse = await getSingleRecord(UserCourse, {
      where: {
        user: { id: student.id },
        course: { id: test.course.id },
      },
    });
    if (!userCourse) {
      return res.status(403).json({ message: "Not enrolled in this course" });
    }

    // Check if test is ongoing
    const currentTime = new Date();
    const testStatus = getTestStatus(test, currentTime);
    if (testStatus !== "ONGOING") {
      return res.status(403).json({
        message: `Test is ${testStatus.toLowerCase()}, cannot view questions`,
      });
    }

    // Sort MCQ options for each question
    if (test.questions) {
      test.questions = test.questions.map((question) => {
        if (question.type === "MCQ" && question.options) {
          question.options.sort((a, b) => a.id.localeCompare(b.id)); // Sort by `id` or any other property
        }
        return question;
      });
    }

    return res.status(200).json({
      message: "Test fetched successfully",
      data: { test },
    });
  } catch (error) {
    console.error("Error fetching test:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// POST /student/tests/:testId/submit
export const submitTest = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const { responses } = req.body;
    const student = req.user as User;

    // Validate test exists and is accessible
    const test = await getSingleRecord(Test, {
      where: { id: testId, status: "PUBLISHED" },
      relations: ["questions", "course", "questions.options"],
    });

    if (!test) {
      return res
        .status(404)
        .json({ message: "Test not found or not published" });
    }

    // Check course enrollment or if course is public
    const userCourse = await getSingleRecord(UserCourse, {
      where: {
        user: { id: student.id },
        course: { id: test.course.id },
      },
    });

    // If not enrolled, check if the course is public
    if (!userCourse) {
      const course = await getSingleRecord(Course, {
        where: { id: test.course.id },
      });

      if (!course || !course.is_public) {
        return res.status(403).json({
          message: "Not enrolled in this course and course is not public",
        });
      }
    }

    // Check if test is ongoing
    const currentTime = new Date();
    const testStatus = getTestStatus(test, currentTime);
    if (testStatus !== "ONGOING") {
      return res.status(403).json({
        message: `Test is ${testStatus.toLowerCase()}, cannot submit`,
      });
    }

    // Check previous attempts
    const previousAttempts = await getAllRecordsWithFilter(TestSubmission, {
      where: { test: { id: testId }, user: { id: student.id } },
    });

    if (previousAttempts.length >= test.maxAttempts) {
      return res.status(403).json({
        message: `Maximum attempts reached (${previousAttempts.length}/${test.maxAttempts})`,
      });
    }

    // Validate responses
    if (!Array.isArray(responses) || responses.length === 0) {
      return res
        .status(400)
        .json({ message: "Responses must be a non-empty array" });
    }

    const questionIds = test.questions.map((q) => q.id);
    if (
      !responses.every(
        (r) => r.questionId && questionIds.includes(r.questionId),
      )
    ) {
      return res
        .status(400)
        .json({ message: "Invalid or missing question IDs in responses" });
    }

    // Create submission within a transaction
    const submission = await TestSubmission.getRepository().manager.transaction(
      async (manager) => {
        // Create submission record
        const submission = await manager.save(TestSubmission, {
          test,
          user: student,
          submittedAt: new Date(),
          status: "SUBMITTED",
          mcqScore: 0,
          mcqPercentage: 0,
          totalMcqMarks: 0,
        });

        let mcqScore = 0;
        let totalMcqMarks = 0;

        // Process responses
        const testResponses = await Promise.all(
          responses.map(async (response) => {
            const question = test.questions.find(
              (q) => q.id === response.questionId,
            );
            if (!question) {
              throw new Error(`Question ${response.questionId} not found`);
            }

            let evaluationStatus: "EVALUATED" | "PENDING" = "PENDING";
            let score = 0;

            // Evaluate MCQs immediately
            if (question.type === "MCQ") {
              // Accept any array (including empty) from frontend
              if (!Array.isArray(response.answer)) {
                throw new Error(
                  `Invalid MCQ answer for question ${question.id}: Expected an array`,
                );
              }

              // Validate each submitted option ID (if any)
              const validOptions = response.answer.every((answerId: string) =>
                question.options?.some((o) => o.id === answerId),
              );
              if (!validOptions) {
                throw new Error(
                  `Invalid MCQ answer for question ${question.id}: One or more option IDs are invalid`,
                );
              }

              // Determine if the MCQ has multiple correct answers
              const correctOptions =
                question.options?.filter((opt) => opt.correct) || [];
              const correctAnswerIds = correctOptions.map((opt) => opt.id);
              const isMultipleCorrect = correctOptions.length > 1;

              // Evaluate the answer
              let isCorrect = false;
              if (response.answer.length === 0) {
                // Student skipped the question, isCorrect remains false, score = 0
                isCorrect = false;
              } else if (isMultipleCorrect) {
                // All correct options must be selected, and no incorrect options selected
                const allCorrectSelected = correctAnswerIds.every((id) =>
                  response.answer.includes(id),
                );
                const noIncorrectSelected = response.answer.every((id) =>
                  correctAnswerIds.includes(id),
                );
                isCorrect = allCorrectSelected && noIncorrectSelected;
              } else {
                // Single correct: Only one answer, and it matches the correct answer
                isCorrect =
                  response.answer.length === 1 &&
                  correctAnswerIds.length === 1 &&
                  response.answer[0] === correctAnswerIds[0];
              }

              evaluationStatus = "EVALUATED";
              totalMcqMarks += question.marks;
              score = isCorrect ? question.marks : 0;
              mcqScore += score;

              return {
                submission,
                question,
                answer: JSON.stringify(response.answer),
                evaluationStatus,
                score,
                evaluatorComments: null,
              };
            }

            // For non-MCQ questions
            return {
              submission,
              question,
              answer: response.answer || null,
              evaluationStatus,
              score,
              evaluatorComments: null,
            };
          }),
        );

        // Save all responses
        await manager.save(
          TestResponse,
          testResponses.map((resp) => ({
            ...resp,
            answer: Array.isArray(resp.answer)
              ? JSON.stringify(resp.answer)
              : resp.answer,
          })),
        );

        // Update submission with MCQ scores
        const mcqPercentage =
          totalMcqMarks > 0 ? (mcqScore / totalMcqMarks) * 100 : 0;
        const status = test.questions.some(
          (q: { type: string }) => q.type !== "MCQ",
        )
          ? "PARTIALLY_EVALUATED"
          : "FULLY_EVALUATED";

        await manager.update(
          TestSubmission,
          { id: submission.id },
          {
            mcqScore,
            status,
          },
        );

        return {
          ...submission,
          mcqScore,
          totalMcqMarks,
          mcqPercentage,
          status,
        };
      },
    );

    res.status(200).json({
      message: "Test submitted successfully",
      data: {
        submissionId: submission.id,
        mcqScore: submission.mcqScore,
        totalMcqMarks: submission.totalMcqMarks,
        mcqPercentage: submission.mcqPercentage,
        status: submission.status,
        message:
          submission.status === "PARTIALLY_EVALUATED"
            ? "Descriptive and code questions will be evaluated by the instructor"
            : "All questions evaluated",
      },
    });
  } catch (error) {
    console.error("Error submitting test:", error);
    res.status(500).json({ message: error.message || "Error submitting test" });
  }
};
// GET /student/tests/:testId/submissions
export const getTestSubmissions = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const student = req.user as User;

    const submissions = await getAllRecordsWithFilter(TestSubmission, {
      where: {
        test: { id: testId },
        user: { id: student.id },
      },
      relations: ["test", "responses", "responses.question"],
      order: { submittedAt: "DESC" },
    });

    const processedSubmissions = submissions.map((submission) => ({
      id: submission.id,
      submittedAt: submission.submittedAt,
      status: submission.status,
      mcqScore: submission.mcqScore,
      totalMcqMarks: submission.totalMcqMarks,
      mcqPercentage: submission.mcqPercentage,
      totalScore: submission.totalScore,
      maxMarks: submission.test.maxMarks,
      percentage:
        submission.totalScore !== null
          ? (submission.totalScore / submission.test.maxMarks) * 100
          : null,
      passed:
        submission.totalScore !== null &&
        submission.totalScore >= submission.test.passingMarks,
      responses: submission.responses.map((response) => ({
        questionId: response.question.id,
        type: response.question.type,
        evaluationStatus: response.evaluationStatus,
        score: response.score,
        maxMarks: response.question.marks,
        evaluatorComments: response.evaluatorComments,
      })),
    }));

    res.status(200).json({
      message: "Submissions fetched successfully",
      data: { submissions: processedSubmissions },
    });
  } catch (error) {
    console.error("Error fetching submissions:", error);
    res.status(500).json({ message: "Error fetching submissions" });
  }
};

// GET /student/tests/:testId/results
export const getStudentTestResults = async (req: Request, res: Response) => {
  try {
    const studentId = req.user.id;
    const { testId } = req.params;

    console.log(`[GET TEST RESULTS] Student: ${studentId}, Test: ${testId}`);

    // Get test submissions for this student and specific test using utility function
    const submissions = await getAllRecordsWithFilter(
      TestSubmission,
      {
        where: {
          user: { id: studentId },
          test: { id: testId },
        },
        relations: ["test", "test.course", "responses", "responses.question"],
        order: { submittedAt: "DESC" },
      },
      `student:${studentId}:test:${testId}:results`,
      true,
      5 * 60,
    ); // Cache for 5 minutes

    if (!submissions.length) {
      return res.status(200).json({
        message: "No test results found",
        data: { submissions: [] },
      });
    }

    // Process submissions to include additional computed data
    const processedSubmissions = submissions.map((submission) => {
      // Get individual responses for this submission
      const responses = (submission.responses || []).map((response) => ({
        questionId: response.question?.id || response.questionId,
        questionText:
          response.question?.question_text || "Question text not available",
        type: response.question?.type || "unknown",
        answer: response.selectedOptions || response.textAnswer || "",
        score: response.score || 0,
        maxMarks: response.question?.marks || 0,
        evaluationStatus: response.evaluationStatus || "NOT_EVALUATED",
        evaluatorComments: response.evaluatorComments || null,
        options: [], // Will need to be populated if needed
      }));

      return {
        id: submission.id,
        submissionId: submission.id, // Frontend expects this field
        testId: submission.test.id,
        testTitle: submission.test.title,
        courseTitle: submission.test.course?.title || "Unknown Course",
        submittedAt: submission.submittedAt,
        totalScore: submission.totalScore,
        maxMarks: submission.test.maxMarks, // Frontend expects maxMarks not maxScore
        passingMarks: submission.test.passingMarks,
        percentage:
          submission.totalScore !== null
            ? (submission.totalScore / submission.test.maxMarks) * 100
            : null,
        passed:
          submission.totalScore !== null &&
          submission.totalScore >= submission.test.passingMarks,
        status: submission.status || "SUBMITTED",
        responses,
      };
    });

    res.status(200).json({
      message: "Test results fetched successfully",
      data: { submissions: processedSubmissions },
    });
  } catch (error) {
    console.error("Error fetching test results:", error);
    res.status(500).json({ message: "Error fetching test results" });
  }
};
// Helper function to determine if a module is unlocked for a student
async function isModuleUnlocked(
  student: User,
  module: Module,
): Promise<boolean> {
  // First module is always unlocked
  if (module.order === 1) {
    return true;
  }

  // Get course ID properly
  let courseId: string;
  if (typeof module.course === "string") {
    courseId = module.course;
  } else if (
    module.course &&
    typeof module.course === "object" &&
    module.course.id
  ) {
    courseId = module.course.id;
  } else {
    console.error("Could not determine course ID for module:", module.id);
    return false;
  }

  // Check if student has already accessed this module (any progress means it should stay accessible)
  const hasAnyProgress = await hasModuleProgress(student, module);
  if (hasAnyProgress) {
    return true; // Once accessible, always accessible
  }

  // For new modules, check if previous module is completed
  const previousModule = await getSingleRecord(Module, {
    where: {
      course: { id: courseId },
      order: module.order - 1,
    },
  });
  if (!previousModule) {
    return false;
  }

  // Check if previous module is completed (all days done + MCQ passed if exists)
  const previousModuleStatus = await isMCQPassed(student, previousModule);
  const previousDaysCompleted = await areAllDaysCompleted(
    student.id,
    previousModule,
  );

  return previousDaysCompleted && previousModuleStatus.passed;
}

// Helper function to check if student has any progress in a module
async function hasModuleProgress(
  student: User,
  module: Module,
): Promise<boolean> {
  console.log(
    `Checking progress for module ${module.id}, student ${student.id}`,
  );

  // Check if any days are completed
  const days = await getAllRecordsWithFilter(DayContent, {
    where: { module: { id: module.id } },
  });

  console.log(`Found ${days.length} days for module ${module.id}`);

  for (const day of days) {
    const completion = await getSingleRecord(UserDayCompletion, {
      where: { user: { id: student.id }, day: { id: day.id } },
    });
    if (completion && completion.completed) {
      console.log(`Found completed day ${day.id} for module ${module.id}`);
      return true;
    }
  }

  // Check if MCQ has been attempted
  const mcq = await getSingleRecord(ModuleMCQ, {
    where: { module: { id: module.id } },
  });

  if (mcq) {
    const mcqResponse = await getSingleRecord(ModuleMCQResponses, {
      where: {
        moduleMCQ: { id: mcq.id },
        user: { id: student.id },
      },
    });
    if (mcqResponse) {
      console.log(`Found MCQ response for module ${module.id}`);
      return true;
    }
  }

  console.log(`No progress found for module ${module.id}`);
  return false;
}

// Helper function to check if all day contents of a module are completed
async function areAllDaysCompleted(
  studentId: string,
  module: Module,
): Promise<boolean> {
  const days = await getAllRecordsWithFilter(DayContent, {
    where: { module: { id: module.id } },
  });
  for (const day of days) {
    const completion = await getSingleRecord(UserDayCompletion, {
      where: { user: { id: studentId }, day: { id: day.id } },
    });
    if (!completion || !completion.completed) {
      return false;
    }
  }
  return true;
}

// Helper function to check if MCQ is passed for a module
async function isMCQPassed(
  student: User,
  module: Module,
): Promise<{ attempted: boolean; passed: boolean; score: number | null }> {
  const mcq = await getSingleRecord(ModuleMCQ, {
    where: { module: { id: module.id } },
  });

  if (!mcq) {
    return { attempted: false, passed: true, score: null }; // No MCQ means "passed"
  }

  const mcqResponse = await getSingleRecord(ModuleMCQResponses, {
    where: { moduleMCQ: { id: mcq.id }, user: { id: student.id } },
  });

  if (!mcqResponse) {
    return { attempted: false, passed: false, score: null };
  }

  const correctAnswers = await getAllRecordsWithFilter(ModuleMCQAnswer, {
    where: { moduleMCQ: { id: mcq.id } },
    order: { createdAt: "ASC" },
  });

  let score = 0;
  mcqResponse.responses.forEach((res: any) => {
    const correct = correctAnswers.find(
      (ans: ModuleMCQAnswer) => ans.questionId === res.questionId,
    );
    if (correct && correct.correctAnswer === res.answer) {
      score++;
    }
  });

  const percentage = (score / correctAnswers.length) * 100;
  const passed = percentage >= mcq.passingScore;

  return { attempted: true, passed, score: percentage };
}

// GET /student/courses
export const getStudentCourses = async (req: Request, res: Response) => {
  try {
    const studentId = req.user.id;
    console.log("Authenticated studentId:", studentId);

    // Get courses explicitly assigned to the student via UserCourse using utility function
    const userCourses = await getAllRecordsWithFilter(
      UserCourse,
      {
        where: { user: { id: studentId } },
        relations: ["course"],
      },
      `student:${studentId}:user_courses`,
      true,
      5 * 60,
    ); // Cache for 5 minutes

    const assignedCourses = userCourses.map((uc) => uc.course);
    // Only assigned courses should be shown to the student
    const allCourses = assignedCourses;
    console.log(
      `Found ${assignedCourses.length} assigned courses for student ${studentId}`,
    );

    // Enhance each course with module statistics and progress
    const coursesWithStats = await Promise.all(
      allCourses.map(async (course) => {
        try {
          // Get modules for this course using utility function with caching
          const modules = await getAllRecordsWithFilter(
            Module,
            {
              where: { course: { id: course.id } },
              order: { order: "ASC" },
              relations: ["days"],
            },
            `course:${course.id}:modules`,
            true,
            15 * 60,
          ); // Cache for 15 minutes

          const student = req.user as User;

          // Calculate module completion status
          const modulesWithDetails = await Promise.all(
            modules.map(async (module: Module) => {
              const isUnlocked = await isModuleUnlocked(student, module);
              const allDaysCompleted = await areAllDaysCompleted(
                student.id,
                module,
              );

              // Check if student has MCQ for this module
              const mcqResult = await isMCQPassed(student, module);

              const moduleFullyCompleted = allDaysCompleted && mcqResult.passed;

              return {
                ...module,
                isUnlocked,
                allDaysCompleted,
                mcqAttempted: mcqResult.attempted,
                mcqPassed: mcqResult.passed,
                mcqScore: mcqResult.score,
                moduleFullyCompleted,
              };
            }),
          );

          // Calculate stats
          const totalModules = modulesWithDetails.length;
          const completedModules = modulesWithDetails.filter(
            (m) => m.moduleFullyCompleted,
          ).length;
          const progress =
            totalModules > 0
              ? Math.round((completedModules / totalModules) * 100)
              : 0;

          // Determine course status
          let status: "active" | "completed" | "not-started" = "not-started";
          if (completedModules === totalModules && totalModules > 0) {
            status = "completed";
          } else if (progress > 0) {
            status = "active";
          }

          return {
            ...course,
            totalModules,
            completedModules,
            progress,
            status,
          };
        } catch (error) {
          console.error(
            `Error calculating stats for course ${course.id}:`,
            error,
          );
          // Return course with default stats if calculation fails
          return {
            ...course,
            totalModules: 0,
            completedModules: 0,
            progress: 0,
            status: "not-started" as const,
          };
        }
      }),
    );

    res.status(200).json(coursesWithStats);
  } catch (error) {
    console.error("Error fetching student courses:", error);
    res.status(500).json({ message: "Error fetching courses" });
  }
};

// GET /student/courses/:courseId/modules
export const getStudentCourseModules = async (req: Request, res: Response) => {
  const { courseId } = req.params;

  try {
    // Use utility function with caching for modules
    const modules = await getAllRecordsWithFilter(
      Module,
      {
        where: { course: { id: courseId } },
        order: { order: "ASC" },
      },
      `course:${courseId}:modules:list`,
      true,
      15 * 60,
    ); // Cache for 15 minutes

    res.status(200).json(modules);
  } catch (error) {
    console.error("Error fetching modules:", error);
    res.status(500).json({ message: "Error fetching modules" });
  }
};

// GET /student/courses/:courseId
export const getStudentCourseById = async (req: Request, res: Response) => {
  const { courseId } = req.params;
  const student = req.user as User;

  try {
    const course = await getSingleRecord(Course, { where: { id: courseId } });
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const modules = await getAllRecordsWithFilter(Module, {
      where: { course: { id: courseId } },
      order: { order: "ASC" },
      relations: ["days"],
    });

    const modulesWithDetails = await Promise.all(
      modules.map(async (module: Module) => {
        const isUnlocked = await isModuleUnlocked(student, module);
        const allDaysCompleted = await areAllDaysCompleted(student.id, module);

        // Fetch MCQ status and all attempts
        const mcq = await getSingleRecord(ModuleMCQ, {
          where: { module: { id: module.id } },
        });
        let mcqAttempted = false;
        let mcqPassed = false;
        let mcqScore = null;

        if (mcq) {
          // Get all responses for this student and module MCQ (no order by createdAt)
          const mcqResponses = await getAllRecordsWithFilter(
            ModuleMCQResponses,
            {
              where: { moduleMCQ: { id: mcq.id }, user: { id: student.id } },
            },
          );
          if (mcqResponses.length > 0) {
            mcqAttempted = true;
            const correctAnswers = await getAllRecordsWithFilter(
              ModuleMCQAnswer,
              {
                where: { moduleMCQ: { id: mcq.id } },
                order: { createdAt: "ASC" },
              },
            );
            // Calculate score for each attempt
            let maxPercentage = 0;
            for (const resp of mcqResponses) {
              let score = 0;
              resp.responses.forEach((response: any) => {
                const correct = correctAnswers.find(
                  (ans: ModuleMCQAnswer) =>
                    ans.questionId === response.questionId,
                );
                if (correct && correct.correctAnswer === response.answer) {
                  score++;
                }
              });
              const percentage = (score / correctAnswers.length) * 100;
              if (percentage > maxPercentage) {
                maxPercentage = percentage;
              }
            }
            mcqScore = maxPercentage;
            mcqPassed = mcqScore >= mcq.passingScore;
          }
        }

        // Module is completed only if MCQ is passed (using max score) and all days are completed
        const moduleFullyCompleted = allDaysCompleted && mcqPassed;

        // Calculate status
        let status: "completed" | "in-progress" | "not-started" = "not-started";
        let days: any[] = [];
        if (module.days) {
          days = module.days;
        } else {
          // fallback: fetch days if not present
          days = await getAllRecordsWithFilter(DayContent, {
            where: { module: { id: module.id } },
            order: { dayNumber: "ASC" },
          });
        }
        const completedDays = days.filter((d: any) => d.completed).length;
        if (moduleFullyCompleted) {
          status = "completed";
        } else if (completedDays > 0 || mcqAttempted) {
          status = "in-progress";
        }

        return {
          ...module,
          isLocked: !isUnlocked,
          allDaysCompleted,
          mcqAttempted,
          mcqPassed,
          mcqScore,
          moduleFullyCompleted,
          status,
        };
      }),
    );

    // Calculate stats
    const totalModules = modulesWithDetails.length;
    const completedModules = modulesWithDetails.filter(
      (m) => m.moduleFullyCompleted,
    ).length;
    const progress =
      totalModules > 0
        ? Math.round((completedModules / totalModules) * 100)
        : 0;

    res.status(200).json({
      ...course,
      modules: modulesWithDetails,
      totalModules,
      completedModules,
      progress,
    });
  } catch (error) {
    console.error("Error fetching course:", error);
    res.status(500).json({ message: "Error fetching course" });
  }
};

// GET /student/modules/:moduleId
export const getStudentModuleById = async (req: Request, res: Response) => {
  const { moduleId } = req.params;
  const student = req.user as User;

  try {
    const module = await getSingleRecord(Module, { where: { id: moduleId } });
    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    const days = await getAllRecordsWithFilter(DayContent, {
      where: { module: { id: moduleId } },
      order: { dayNumber: "ASC" },
    });

    // Add completion status to each day
    const daysWithCompletion = await Promise.all(
      days.map(async (day: DayContent) => {
        const completion = await getSingleRecord(UserDayCompletion, {
          where: { user: { id: student.id }, day: { id: day.id } },
        });
        return {
          ...day,
          completed: completion ? completion.completed : false,
        };
      }),
    );

    const allDaysCompleted = await areAllDaysCompleted(student.id, module);
    const mcqStatus = await isMCQPassed(student, module);

    // For backward compatibility, still provide individual values
    const mcqAttempted = mcqStatus.attempted;
    const mcqPassed = mcqStatus.passed;
    const mcqScore = mcqStatus.score;

    // Get minimum pass marks
    const mcq = await getSingleRecord(ModuleMCQ, {
      where: { module: { id: moduleId } },
    });
    const minimumPassMarks = mcq ? mcq.passingScore : null;

    // Module is fully completed only if all days are done AND MCQ is passed (or no MCQ exists)
    const moduleFullyCompleted = allDaysCompleted && mcqStatus.passed;
    const mcqAccessible = allDaysCompleted;

    res.status(200).json({
      ...module,
      days: daysWithCompletion,
      mcqAccessible,
      allDaysCompleted,
      mcqAttempted,
      mcqPassed,
      mcqScore,
      minimumPassMarks,
      moduleFullyCompleted,
    });
  } catch (error) {
    console.error("Error fetching module:", error);
    res.status(500).json({ message: "Error fetching module" });
  }
};

// GET /student/day-contents/:dayId
export const getStudentDayContentById = async (req: Request, res: Response) => {
  const { dayId } = req.params;

  try {
    const day = await getSingleRecord(DayContent, { where: { id: dayId } });
    if (!day) {
      return res.status(404).json({ message: "Day content not found" });
    }

    res.status(200).json(day);
  } catch (error) {
    console.error("Error fetching day content:", error);
    res.status(500).json({ message: "Error fetching day content" });
  }
};

// PATCH /student/day-contents/:dayId/complete
export const markDayAsCompleted = async (req: Request, res: Response) => {
  const { dayId } = req.params;
  const student = req.user as User;

  try {
    const day = await getSingleRecord(DayContent, { where: { id: dayId } });
    if (!day) {
      return res.status(404).json({ message: "Day content not found" });
    }

    const completion = await getSingleRecord(UserDayCompletion, {
      where: { user: { id: student.id }, day: { id: dayId } },
    });

    if (completion) {
      await updateRecords(
        UserDayCompletion,
        { id: completion.id },
        { completed: true },
        false,
      );
    } else {
      const newCompletion = UserDayCompletion.create({
        user: student,
        day,
        completed: true,
      });
      await createRecord(UserDayCompletion, newCompletion);
    }

    res.status(200).json({ message: "Day marked as completed" });
  } catch (error) {
    console.error("Error marking day as completed:", error);
    res.status(500).json({ message: "Error marking day as completed" });
  }
};

// GET /student/modules/:moduleId/mcq
export const getStudentModuleMCQ = async (req: Request, res: Response) => {
  const { moduleId } = req.params;
  const student = req.user as User;

  try {
    const module = await getSingleRecord(Module, { where: { id: moduleId } });
    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    const allDaysCompleted = await areAllDaysCompleted(student.id, module);
    if (!allDaysCompleted) {
      return res
        .status(403)
        .json({ message: "Complete all days to access MCQ" });
    }

    const mcq = await getSingleRecord(ModuleMCQ, {
      where: { module: { id: moduleId } },
      relations: ["module"],
    });
    if (!mcq) {
      return res.status(404).json({ message: "MCQ not found for this module" });
    }

    console.log("📚 Serving MCQ to student:", {
      moduleId,
      mcqId: mcq.id,
      questionsCount: mcq.questions?.length || 0,
    });

    // Remove correct answers from questions before sending to student
    const questionsWithoutAnswers =
      mcq.questions?.map((question: any) => ({
        ...question,
        correctAnswer: undefined, // Hide correct answers from students
      })) || [];

    res.status(200).json({
      id: mcq.id,
      passingScore: mcq.passingScore,
      questions: questionsWithoutAnswers,
      module: {
        id: module.id,
        title: module.title,
      },
    });
  } catch (error) {
    console.error("Error fetching MCQ:", error);
    res.status(500).json({ message: "Error fetching MCQ" });
  }
};

// POST /student/modules/:moduleId/mcq/responses
export const submitMCQResponses = async (req: Request, res: Response) => {
  const { moduleId } = req.params;
  const { responses } = req.body;
  const student = req.user as User;

  try {
    const module = await getSingleRecord(Module, { where: { id: moduleId } });
    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    const mcq = await getSingleRecord(ModuleMCQ, {
      where: { module: { id: moduleId } },
    });
    if (!mcq) {
      return res.status(404).json({ message: "MCQ not found for this module" });
    }

    const existingResponse = await getSingleRecord(ModuleMCQResponses, {
      where: { moduleMCQ: { id: mcq.id }, user: { id: student.id } },
    });

    if (existingResponse) {
      console.log(
        `Student ${student.id} is retaking MCQ for module ${moduleId}. Previous attempt found.`,
      );
    }

    const correctAnswers = await getAllRecordsWithFilter(ModuleMCQAnswer, {
      where: { moduleMCQ: { id: mcq.id } },
      order: { createdAt: "ASC" },
    });

    if (
      !Array.isArray(responses) ||
      responses.length !== correctAnswers.length
    ) {
      return res.status(400).json({ message: "Invalid number of responses" });
    }

    let score = 0;
    responses.forEach((answer: string, index: number) => {
      const correct = correctAnswers[index];
      if (correct && correct.correctAnswer === answer) {
        score++;
      }
    });

    const totalQuestions = correctAnswers.length;
    const percentage = (score / totalQuestions) * 100;
    const passed = percentage >= mcq.passingScore;

    const storedResponses = responses.map((answer: string, index: number) => ({
      questionId: correctAnswers[index].questionId,
      answer,
    }));

    if (existingResponse) {
      existingResponse.responses = storedResponses;
      await existingResponse.save();
    } else {
      const newResponse = ModuleMCQResponses.create({
        moduleMCQ: mcq,
        user: student,
        responses: storedResponses,
      });
      await createRecord(ModuleMCQResponses, newResponse);
    }

    res.status(200).json({
      score: percentage,
      passed,
      canRetake: true,
      message: passed
        ? `Congratulations! You scored ${percentage.toFixed(1)}%. You can retake to improve your score.`
        : `You scored ${percentage.toFixed(1)}%. You need ${mcq.passingScore}% to pass. You can retake this MCQ.`,
    });
  } catch (error) {
    console.error("Error submitting MCQ responses:", error);
    res.status(500).json({ message: "Error submitting MCQ responses" });
  }
};

// GET /student/modules/:moduleId/mcq/results
export const getMCQResults = async (req: Request, res: Response) => {
  const { moduleId } = req.params;
  const student = req.user as User;

  try {
    const module = await getSingleRecord(Module, { where: { id: moduleId } });
    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    const mcq = await getSingleRecord(ModuleMCQ, {
      where: { module: { id: moduleId } },
    });
    if (!mcq) {
      return res.status(404).json({ message: "MCQ not found for this module" });
    }

    const latestResponse = await getSingleRecord(
      ModuleMCQResponses,
      {
        where: { moduleMCQ: { id: mcq.id }, user: { id: student.id } },
      },
      { order: { createdAt: "DESC" } },
    );

    if (!latestResponse) {
      return res.status(404).json({ message: "No MCQ response found" });
    }

    const correctAnswers = await getAllRecordsWithFilter(ModuleMCQAnswer, {
      where: { moduleMCQ: { id: mcq.id } },
      order: { createdAt: "ASC" },
    });
    let score = 0;
    latestResponse.responses.forEach((response: any) => {
      const correct = correctAnswers.find(
        (ans: ModuleMCQAnswer) => ans.questionId === response.questionId,
      );
      if (correct && correct.correctAnswer === response.answer) {
        score++;
      }
    });

    const totalQuestions = correctAnswers.length;
    const percentage = (score / totalQuestions) * 100;
    const passed = percentage >= mcq.passingScore;

    res.status(200).json({
      responses: latestResponse.responses,
      score: percentage,
      passed,
      minimumPassMarks: mcq.passingScore,
    });
  } catch (error) {
    console.error("Error fetching MCQ results:", error);
    res.status(500).json({ message: "Error fetching MCQ results" });
  }
};

// GET /student/modules/:moduleId/mcq/review
export const getMCQReview = async (req: Request, res: Response) => {
  const { moduleId } = req.params;
  const student = req.user as User;

  try {
    const module = await getSingleRecord(Module, { where: { id: moduleId } });
    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    const mcq = await getSingleRecord(ModuleMCQ, {
      where: { module: { id: moduleId } },
    });
    if (!mcq) {
      return res.status(404).json({ message: "MCQ not found for this module" });
    }

    // Only allow if student has already attempted
    const existingResponse = await getSingleRecord(ModuleMCQResponses, {
      where: { moduleMCQ: { id: mcq.id }, user: { id: student.id } },
    });
    if (!existingResponse) {
      return res
        .status(403)
        .json({ message: "You have not attempted this MCQ yet" });
    }

    console.log("📚 Serving MCQ review to student:", {
      moduleId,
      mcqId: mcq.id,
      questionsCount: mcq.questions?.length || 0,
      studentId: student.id,
    });

    // Return the MCQ structure including correctAnswer for review
    res.status(200).json({
      id: mcq.id,
      passingScore: mcq.passingScore,
      questions: mcq.questions, // Include correct answers for review
      module: {
        id: module.id,
        title: module.title,
      },
    });
  } catch (error) {
    console.error("Error fetching MCQ review:", error);
    res.status(500).json({ message: "Error fetching MCQ review" });
  }
};

// GET /student/modules/:moduleId/completion
export const getModuleCompletionStatus = async (
  req: Request,
  res: Response,
) => {
  const { moduleId } = req.params;
  const student = req.user as User;

  try {
    const module = await getSingleRecord(Module, { where: { id: moduleId } });
    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    const allDaysCompleted = await areAllDaysCompleted(student.id, module);

    const mcq = await getSingleRecord(ModuleMCQ, {
      where: { module: { id: moduleId } },
    });
    let mcqAttempted = false;
    let mcqPassed = false;
    if (mcq) {
      const mcqResponse = await getSingleRecord(ModuleMCQResponses, {
        where: { moduleMCQ: { id: mcq.id }, user: { id: student.id } },
      });
      if (mcqResponse) {
        mcqAttempted = true;
        const correctAnswers = await getAllRecordsWithFilter(ModuleMCQAnswer, {
          where: { moduleMCQ: { id: mcq.id } },
          order: { createdAt: "ASC" },
        });
        let score = 0;
        mcqResponse.responses.forEach((response: any) => {
          const correct = correctAnswers.find(
            (ans: ModuleMCQAnswer) => ans.questionId === response.questionId,
          );
          if (correct && correct.correctAnswer === response.answer) {
            score++;
          }
        });
        const percentage = (score / correctAnswers.length) * 100;
        mcqPassed = percentage >= mcq.passingScore;
      }
    }

    const moduleFullyCompleted = allDaysCompleted && (mcq ? mcqPassed : true);

    res.status(200).json({
      moduleId,
      allDaysCompleted,
      mcqAttempted,
      mcqPassed,
      moduleFullyCompleted,
    });
  } catch (error) {
    console.error("Error checking module completion:", error);
    res.status(500).json({ message: "Error checking module completion" });
  }
};

// GET /student/tests/leaderboard
export const getGlobalTestLeaderboard = async (req, res) => {
  try {
    console.log("📊 Fetching global test leaderboard...");

    // Fetch all submissions with user and test relations
    const submissions = await TestSubmission.find({
      relations: ["user", "test", "test.course"],
    });

    console.log(`📊 Found ${submissions.length} test submissions`);

    // If no submissions, return empty leaderboard
    if (submissions.length === 0) {
      console.log("📊 No test submissions found, returning empty leaderboard");
      return res.json({
        message: "Global leaderboard fetched successfully",
        data: [],
      });
    }

    // Map: userId -> { userName, totalScore, totalMaxMarks, tests: [...] }
    const userScores = new Map();

    // For each test, keep only the highest submission per user
    const bestSubmissionsPerUserPerTest = new Map();
    for (const submission of submissions) {
      const key = `${submission.user.id}_${submission.test.id}`;
      const score = submission.totalScore ?? submission.mcqScore ?? 0;
      if (
        !bestSubmissionsPerUserPerTest.has(key) ||
        score > bestSubmissionsPerUserPerTest.get(key).score
      ) {
        bestSubmissionsPerUserPerTest.set(key, {
          user: submission.user,
          test: submission.test,
          score,
          maxMarks: submission.test.maxMarks,
          submittedAt: submission.submittedAt,
        });
      }
    }

    console.log(
      `📊 Processing ${bestSubmissionsPerUserPerTest.size} best submissions`,
    );

    // Aggregate per user
    for (const {
      user,
      test,
      score,
      maxMarks,
      submittedAt,
    } of bestSubmissionsPerUserPerTest.values()) {
      if (!userScores.has(user.id)) {
        userScores.set(user.id, {
          id: user.id, // Add user ID for frontend matching
          userName: user.username,
          totalScore: 0,
          totalMaxMarks: 0,
          tests: [],
        });
      }
      const userEntry = userScores.get(user.id);
      userEntry.totalScore += score;
      userEntry.totalMaxMarks += maxMarks;
      userEntry.tests.push({
        testId: test.id,
        testTitle: test.title,
        courseName: test.course?.title || "N/A",
        score,
        maxMarks,
        submittedAt,
      });
    }

    // Prepare leaderboard array
    const leaderboard = Array.from(userScores.values())
      .map((entry) => ({
        id: entry.id,
        userName: entry.userName,
        courseName: entry.tests.length > 0 ? entry.tests[0].courseName : "N/A",
        score: entry.totalScore, // Match frontend interface
        totalScore: entry.totalScore, // Keep for backward compatibility
        totalMaxMarks: entry.totalMaxMarks,
        tests: entry.tests,
        percentage:
          entry.totalMaxMarks > 0
            ? Math.round((entry.totalScore / entry.totalMaxMarks) * 100)
            : 0,
      }))
      .sort((a, b) => {
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore;
        }
        if ((b.percentage ?? 0) !== (a.percentage ?? 0)) {
          return (b.percentage ?? 0) - (a.percentage ?? 0);
        }
        return a.userName.localeCompare(b.userName);
      });

    console.log(`📊 Generated leaderboard with ${leaderboard.length} users`);

    res.json({
      message: "Global leaderboard fetched successfully",
      data: leaderboard,
    });
  } catch (error) {
    console.error(" Error fetching leaderboard:", error);
    res.status(500).json({
      message: "Error fetching leaderboard",
      error: error.message,
      data: [], // Return empty array on error
    });
  }
};

// GET /student/batches
export const getStudentBatches = async (req: Request, res: Response) => {
  try {
    const studentId = req.user.id;

    // Get user details with batch information using utility function
    const user = await getSingleRecord(
      User,
      {
        where: { id: studentId },
      },
      `user:${studentId}:details`,
      true,
      10 * 60,
    ); // Cache for 10 minutes

    if (!user || !user.batch_id || user.batch_id.length === 0) {
      return res
        .status(200)
        .json({ message: "No batches assigned", data: { batches: [] } });
    }

    // Get batches using utility function with caching
    const batches = await getAllRecordsWithFilter(
      Batch,
      {
        where: { id: In(user.batch_id) },
      },
      `student:${studentId}:batches:${user.batch_id.join(",")}`,
      true,
      15 * 60,
    ); // Cache for 15 minutes

    res.status(200).json({
      message: "Batches fetched successfully",
      data: { batches },
    });
  } catch (error) {
    console.error("Error fetching student batches:", error);
    res.status(500).json({ message: "Error fetching batches" });
  }
};

// GET /student/dashboard/stats
export const getStudentDashboardStats = async (req: Request, res: Response) => {
  try {
    console.log("=== Getting student dashboard stats ===");

    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const studentId = user.id;
    console.log("=== Fetching stats for student:", studentId);

    // Get courses explicitly assigned to this student using utility function
    const userCourses = await getAllRecordsWithFilter(
      UserCourse,
      {
        where: { user: { id: studentId } },
        relations: ["course"],
      },
      `student:${studentId}:user_courses:stats`,
      true,
      5 * 60,
    ); // Cache for 5 minutes

    const assignedCourses = userCourses.map((uc) => uc.course);
    const assignedCourseIds = assignedCourses.map((course) => course.id);

    // Get all public courses that are not already assigned to this student using utility function
    const publicCourses = await getAllRecordsWithFilter(
      Course,
      {
        where: {
          is_public: true,
          id: Not(In(assignedCourseIds.length > 0 ? assignedCourseIds : [""])),
        },
      },
      `public_courses:stats:excluding:${assignedCourseIds.join(",")}`,
      true,
      10 * 60,
    ); // Cache for 10 minutes

    // Combine assigned courses and public courses
    const allCourses = [...assignedCourses, ...publicCourses];
    console.log(
      `Dashboard stats: Found ${assignedCourses.length} assigned courses and ${publicCourses.length} public courses for student ${studentId}`,
    );

    const totalCourses = allCourses.length;
    // For completed courses, we can only count explicitly assigned ones since we track completion in UserCourse
    const completedCourses = userCourses.filter((uc) => uc.completed).length;

    // Get all course IDs for test calculation
    const allCourseIds = allCourses.map((course) => course.id);
    let completedTests = 0;
    let averageScore = 0;

    if (allCourseIds.length > 0) {
      // Get all published tests from all courses (assigned + public) using utility function
      const tests = await getAllRecordsWithFilter(
        Test,
        {
          where: {
            course: { id: In(allCourseIds) },
            status: "PUBLISHED",
          },
          relations: ["course"],
        },
        `student:${studentId}:tests:${allCourseIds.join(",")}`,
        true,
        10 * 60,
      ); // Cache for 10 minutes

      // Get test submissions for this student using utility function
      const testSubmissions = await getAllRecordsWithFilter(
        TestSubmission,
        {
          where: {
            user: { id: studentId },
            test: { id: In(tests.map((t) => t.id)) },
          },
          relations: ["test"],
        },
        `student:${studentId}:test_submissions`,
        true,
        5 * 60,
      ); // Cache for 5 minutes

      completedTests = testSubmissions.length;

      // Calculate average score
      if (testSubmissions.length > 0) {
        const totalScore = testSubmissions.reduce(
          (sum, submission) => sum + (submission.score || 0),
          0,
        );
        averageScore = Math.round(totalScore / testSubmissions.length);
      }
    }

    // Calculate overall progress
    const overallProgress =
      totalCourses > 0
        ? Math.round((completedCourses / totalCourses) * 100)
        : 0;

    // Get student's modules progress from all courses
    let totalModules = 0;
    let completedModules = 0;

    for (const course of allCourses) {
      // Use utility function with caching for modules
      const modules = await getAllRecordsWithFilter(
        Module,
        {
          where: { course: { id: course.id } },
        },
        `course:${course.id}:modules:stats`,
        true,
        15 * 60,
      ); // Cache for 15 minutes

      totalModules += modules.length;

      // Count completed modules by checking if all days are completed
      for (const module of modules) {
        const allDaysCompleted = await areAllDaysCompleted(user.id, module);
        if (allDaysCompleted) {
          completedModules++;
        }
      }
    }

    // Calculate hours learned (this would need to be implemented based on your business logic)
    // For now, we'll estimate based on completed modules and average time per module
    let hoursLearned = 0;
    for (const course of allCourses) {
      // Use utility function with caching for modules
      const modules = await getAllRecordsWithFilter(
        Module,
        {
          where: { course: { id: course.id } },
        },
        `course:${course.id}:modules:hours`,
        true,
        15 * 60,
      ); // Cache for 15 minutes

      // Estimate 2 hours per completed module
      for (const module of modules) {
        const allDaysCompleted = await areAllDaysCompleted(user.id, module);
        if (allDaysCompleted) {
          hoursLearned += 2; // Estimated hours per module
        }
      }
    }

    const stats = {
      coursesEnrolled: totalCourses,
      hoursLearned: hoursLearned,
      testsCompleted: completedTests,
      averageGrade: averageScore,
      // Additional stats for potential future use
      totalModules,
      completedModules,
      overallProgress,
      currentStreak: 0, // TODO: Implement streak calculation
      totalPoints: averageScore * completedTests, // Simple points calculation
    };

    console.log("=== Student dashboard stats:", JSON.stringify(stats, null, 2));

    return res.json({ stats });
  } catch (err: any) {
    console.error("=== Error getting student dashboard stats:", err);
    return res.status(500).json({
      error: "Failed to fetch dashboard statistics",
      details:
        process.env.NODE_ENV === "development"
          ? err?.message
          : "Internal server error",
    });
  }
};

// GET /student/modules/:moduleId/mcq/retake-status
export const getMCQRetakeStatus = async (req: Request, res: Response) => {
  const { moduleId } = req.params;
  const student = req.user as User;

  try {
    const module = await getSingleRecord(Module, { where: { id: moduleId } });
    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    const mcq = await getSingleRecord(ModuleMCQ, {
      where: { module: { id: moduleId } },
    });

    if (!mcq) {
      return res.status(404).json({ message: "No MCQ found for this module" });
    }

    const existingResponse = await getSingleRecord(ModuleMCQResponses, {
      where: { moduleMCQ: { id: mcq.id }, user: { id: student.id } },
    });

    if (!existingResponse) {
      return res.status(200).json({
        canTake: true,
        canRetake: false,
        hasAttempted: false,
        hasPassed: false,
        score: null,
        passingScore: mcq.passingScore,
        message: "You can take this MCQ",
      });
    }

    // Calculate if they passed
    const correctAnswers = await getAllRecordsWithFilter(ModuleMCQAnswer, {
      where: { moduleMCQ: { id: mcq.id } },
      order: { createdAt: "ASC" },
    });

    let score = 0;
    existingResponse.responses.forEach((response: any) => {
      const correct = correctAnswers.find(
        (ans: ModuleMCQAnswer) => ans.questionId === response.questionId,
      );
      if (correct && correct.correctAnswer === response.answer) {
        score++;
      }
    });

    const percentage = (score / correctAnswers.length) * 100;
    const passed = percentage >= mcq.passingScore;

    return res.status(200).json({
      canTake: true,
      canRetake: true,
      hasAttempted: true,
      hasPassed: passed,
      score: percentage,
      passingScore: mcq.passingScore,
      message: passed
        ? `You scored ${percentage.toFixed(1)}%. You can retake to improve your score!`
        : "You can retake this MCQ to improve your score",
    });
  } catch (error) {
    console.error("Error checking MCQ retake status:", error);
    res.status(500).json({ message: "Error checking MCQ retake status" });
  }
};

export const getStudentPublicCourses = async (req: Request, res: Response) => {
  console.log("[DEBUG] getStudentPublicCourses called for user:", req.user?.id);
  try {
    const student = req.user as User;
    let publicCourses: Course[] = [];
    if (student && student.id) {
      console.log("[DEBUG] Authenticated student detected:", student.id);
      // Get all course IDs assigned to the student
      const userCourses = await getAllRecordsWithFilter(UserCourse, {
        where: { user: { id: student.id } },
        relations: ["course"],
      });
      const assignedCourseIds = userCourses.map((uc) => uc.course.id);
      console.log(
        "[DEBUG] Assigned course IDs for student",
        student.id,
        assignedCourseIds,
      );
      // Get all public courses NOT assigned to the student
      publicCourses = await getAllRecordsWithFilter(Course, {
        where: {
          is_public: true,
          id:
            assignedCourseIds.length > 0
              ? Not(In(assignedCourseIds))
              : undefined,
        },
      });
      console.log(
        "[DEBUG] Public courses query completed for student",
        student.id,
      );
      if (publicCourses && publicCourses.length > 0) {
        console.log(
          "[DEBUG] Public courses returned for student",
          student.id,
          publicCourses.map((c) => c.id),
        );
      } else {
        console.log(
          "[DEBUG] No public courses returned for student",
          student.id,
        );
      }
    } else {
      // If not authenticated, show all public courses
      console.log("[DEBUG] Unauthenticated user, returning all public courses");
      publicCourses = await getAllRecordsWithFilter(Course, {
        where: { is_public: true },
      });
      console.log(
        "[DEBUG] All public courses returned:",
        publicCourses.map((c) => c.id),
      );
    }
    return res.json({ courses: publicCourses });
  } catch (error) {
    console.error("Error fetching public courses:", error);
    return res.status(500).json({ message: "Error fetching public courses" });
  }
};

export function OptionalStudentAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      // Use your actual JWT secret here
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch {
      // Invalid token, do not set req.user
      req.user = undefined;
    }
  }
  next();
}
