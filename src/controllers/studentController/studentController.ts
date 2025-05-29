import { Request, Response } from "express";
import { In } from "typeorm";
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

    // Get courses assigned to student
    const userCourses = await getAllRecordsWithFilter(UserCourse, {
      where: { user: { id: studentId } },
      relations: ["course"],
    });

    const courseIds = userCourses.map((uc) => uc.course.id);
    if (!courseIds.length) {
      return res
        .status(200)
        .json({ message: "No courses assigned", data: { tests: [] } });
    }

    // Get all published tests from assigned courses
    const tests = await getAllRecordsWithFilter(Test, {
      where: {
        course: { id: In(courseIds) },
        status: "PUBLISHED",
      },
      relations: ["course"],
      order: { startDate: "ASC" },
    });

    // Process tests to include status and sanitize data
    const currentTime = new Date();
    const processedTests = tests.map((test) => ({
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
    }));

    res.status(200).json({
      message: "Tests fetched successfully",
      data: { tests: processedTests },
    });
  } catch (error) {
    console.error("Error fetching student tests:", error);
    res.status(500).json({ message: "Error fetching tests" });
  }
};

// GET /student/tests/:testId
export const getStudentTestById = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    // Fetch the test details with relations using TypeORM
    const test = await Test.findOne({
      where: { id: testId },
      relations: ["course", "questions", "questions.options"],
    });

    if (!test) {
      return res.status(404).json({ message: "Test not found" });
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
      where: { id: testId },
      relations: ["questions", "course", "questions.options"],
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
      return res.status(403).json({ message: "Access denied" });
    }

    // Check if test is ongoing
    const currentTime = new Date();
    const testStatus = getTestStatus(test, currentTime);
    if (testStatus !== "ONGOING") {
      return res.status(403).json({ message: "Test is not active" });
    }

    // Check previous attempts
    const previousAttempts = await getAllRecordsWithFilter(TestSubmission, {
      where: { test: { id: testId }, user: { id: student.id } },
    });

    // Debug log for maximum attempts
    console.log({
      previousAttempts: previousAttempts.length,
      maxAttempts: test.maxAttempts,
    });

    if (previousAttempts.length >= test.maxAttempts) {
      return res.status(403).json({
        message: `Maximum attempts reached. You have already attempted ${previousAttempts.length} out of ${test.maxAttempts} allowed attempts.`,
      });
    }

    // Validate responses
    if (!Array.isArray(responses)) {
      return res.status(400).json({ message: "Responses must be an array" });
    }

    const questionIds = test.questions.map((q) => q.id);
    if (!responses.every((r) => questionIds.includes(r.questionId))) {
      return res
        .status(400)
        .json({ message: "Invalid or missing question responses" });
    }

    // Create submission within a transaction
    const submission = await TestSubmission.getRepository().manager.transaction(
      async (manager) => {
        const submission = await manager.save(TestSubmission, {
          test,
          user: student,
          submittedAt: new Date(),
          status: "SUBMITTED",
        });

        let mcqScore = 0;
        let totalMcqMarks = 0;

        // Process responses
        await Promise.all(
          responses.map(async (response) => {
            const question = test.questions.find(
              (q) => q.id === response.questionId,
            );
            if (!question) return;

            let evaluationStatus: "EVALUATED" | "PENDING" = "PENDING";
            let score = 0;

            // Evaluate MCQs immediately
            if (question.type === "MCQ") {
              const validOption = question.options?.some(
                (o) => o.id === response.answer,
              );
              if (!validOption) {
                throw new Error(
                  `Invalid MCQ answer for question ${question.id}`,
                );
              }
              evaluationStatus = "EVALUATED";
              if (response.answer === question.correctAnswer) {
                score = question.marks;
                mcqScore += score;
              }
              totalMcqMarks += question.marks;
            }

            await manager.save(TestResponse, {
              submission,
              question,
              answer: response.answer,
              evaluationStatus,
              score,
              evaluatorComments: null,
            });
          }),
        );

        // Update submission with MCQ scores
        const mcqPercentage =
          totalMcqMarks > 0 ? (mcqScore / totalMcqMarks) * 100 : 0;
        const status = test.questions.some((q) => q.type !== "MCQ")
          ? "PARTIALLY_EVALUATED"
          : "FULLY_EVALUATED";
        await manager.update(
          TestSubmission,
          { id: submission.id },
          {
            mcqScore,
            totalMcqMarks,
            mcqPercentage,
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

export const getStudentTestResults = async (req: Request, res: Response) => {
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

    res.status(200).json({
      message: "Test results fetched successfully",
      data: { submissions },
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
  if (module.order === 1) {
    return true;
  }

  const courseId = module.course || module.course?.id;
  if (!courseId) {
    return false;
  }

  const previousModule = await getSingleRecord(Module, {
    where: {
      course: { id: courseId },
      order: module.order - 1,
    },
  });
  if (!previousModule) {
    return false;
  }

  const previousMCQ = await getSingleRecord(ModuleMCQ, {
    where: { module: { id: previousModule.id } },
  });
  if (!previousMCQ) {
    return false;
  }

  const response = await getSingleRecord(ModuleMCQResponses, {
    where: {
      moduleMCQ: { id: previousMCQ.id },
      user: { id: student.id },
    },
  });
  if (!response) {
    return false;
  }

  const correctAnswers = await getAllRecordsWithFilter(ModuleMCQAnswer, {
    where: { moduleMCQ: { id: previousMCQ.id } },
    order: { createdAt: "ASC" },
  });
  let score = 0;
  response.responses.forEach((res: any) => {
    const correct = correctAnswers.find(
      (ans: ModuleMCQAnswer) => ans.questionId === res.questionId,
    );
    if (correct && correct.correctAnswer === res.answer) {
      score++;
    }
  });
  const percentage = (score / correctAnswers.length) * 100;
  return percentage >= previousMCQ.passingScore;
}

// Helper function to check if all day contents of a module are completed
async function areAllDaysCompleted(
  student: User,
  module: Module,
): Promise<boolean> {
  const days = await getAllRecordsWithFilter(DayContent, {
    where: { module: { id: module.id } },
  });
  for (const day of days) {
    const completion = await getSingleRecord(UserDayCompletion, {
      where: { user: { id: student.id }, day: { id: day.id } },
    });
    if (!completion || !completion.completed) {
      return false;
    }
  }
  return true;
}

// GET /student/courses
export const getStudentCourses = async (req: Request, res: Response) => {
  try {
    const studentId = req.user.id;
    console.log("Authenticated studentId:", studentId);
    const userCourses = await UserCourse.find({
      where: { user: { id: studentId } },
      relations: ["course"], // ensures course details are populated
    });

    const assignedCourses = userCourses.map((uc) => uc.course);

    res.status(200).json(assignedCourses);
  } catch (error) {
    console.error("Error fetching student courses:", error);
    res.status(500).json({ message: "Error fetching courses" });
  }
};

// GET /student/courses/:courseId/modules
export const getStudentCourseModules = async (req: Request, res: Response) => {
  const { courseId } = req.params;

  try {
    const modules = await Module.find({
      where: { course: { id: courseId } },
      order: { order: "ASC" },
    });

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
    });

    const modulesWithDetails = await Promise.all(
      modules.map(async (module: Module) => {
        const isUnlocked = await isModuleUnlocked(student, module);
        const allDaysCompleted = await areAllDaysCompleted(student, module);

        // Fetch MCQ status
        const mcq = await getSingleRecord(ModuleMCQ, {
          where: { module: { id: module.id } },
        });
        let mcqAttempted = false;
        let mcqPassed = false;
        let mcqScore = null;

        if (mcq) {
          const mcqResponse = await getSingleRecord(ModuleMCQResponses, {
            where: { moduleMCQ: { id: mcq.id }, user: { id: student.id } },
          });
          if (mcqResponse) {
            mcqAttempted = true;
            const correctAnswers = await getAllRecordsWithFilter(
              ModuleMCQAnswer,
              {
                where: { moduleMCQ: { id: mcq.id } },
                order: { createdAt: "ASC" },
              },
            );
            let score = 0;
            mcqResponse.responses.forEach((response: any) => {
              const correct = correctAnswers.find(
                (ans: ModuleMCQAnswer) =>
                  ans.questionId === response.questionId,
              );
              if (correct && correct.correctAnswer === response.answer) {
                score++;
              }
            });
            const percentage = (score / correctAnswers.length) * 100;
            mcqPassed = percentage >= mcq.passingScore;
            mcqScore = percentage;
          }
        }

        const moduleFullyCompleted = allDaysCompleted && mcqAttempted;

        return {
          ...module,
          isLocked: !isUnlocked,
          allDaysCompleted,
          mcqAttempted,
          mcqPassed,
          mcqScore,
          moduleFullyCompleted,
        };
      }),
    );

    res.status(200).json({ ...course, modules: modulesWithDetails });
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

    const isUnlocked = await isModuleUnlocked(student, module);
    if (!isUnlocked) {
      return res.status(403).json({ message: "Module is locked" });
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

    const allDaysCompleted = await areAllDaysCompleted(student, module);

    // Fetch MCQ status
    const mcq = await getSingleRecord(ModuleMCQ, {
      where: { module: { id: moduleId } },
    });
    let mcqAttempted = false;
    let mcqPassed = false;
    let mcqScore = null;
    let minimumPassMarks = null;

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
        mcqScore = percentage;
        minimumPassMarks = mcq.passingScore;
      }
    }

    const moduleFullyCompleted = allDaysCompleted && mcqAttempted;
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
  const student = req.user as User;

  try {
    const day = await getSingleRecord(DayContent, { where: { id: dayId } });
    if (!day) {
      return res.status(404).json({ message: "Day content not found" });
    }

    const module = await getSingleRecord(Module, {
      where: { id: day.module.id },
    });
    const isUnlocked = await isModuleUnlocked(student, module);
    if (!isUnlocked) {
      return res.status(403).json({ message: "Module is locked" });
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

    const isUnlocked = await isModuleUnlocked(student, module);
    if (!isUnlocked) {
      return res.status(403).json({ message: "Module is locked" });
    }

    const allDaysCompleted = await areAllDaysCompleted(student, module);
    if (!allDaysCompleted) {
      return res
        .status(403)
        .json({ message: "Complete all days to access MCQ" });
    }

    const mcq = await getSingleRecord(ModuleMCQ, {
      where: { module: { id: moduleId } },
    });
    if (!mcq) {
      return res.status(404).json({ message: "MCQ not found for this module" });
    }

    res.status(200).json(mcq);
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

    // Check if MCQ has already been attempted
    const existingResponse = await getSingleRecord(ModuleMCQResponses, {
      where: { moduleMCQ: { id: mcq.id }, user: { id: student.id } },
    });
    if (existingResponse) {
      return res.status(403).json({ message: "MCQ already attempted" });
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

    const newResponse = ModuleMCQResponses.create({
      moduleMCQ: mcq,
      user: student,
      responses: storedResponses,
    });
    await createRecord(ModuleMCQResponses, newResponse);

    res.status(200).json({ score: percentage, passed });
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

    const isUnlocked = await isModuleUnlocked(student, module);
    if (!isUnlocked) {
      return res.status(403).json({ message: "Module is locked" });
    }

    const allDaysCompleted = await areAllDaysCompleted(student, module);

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

    const moduleFullyCompleted = allDaysCompleted && mcqAttempted;

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
