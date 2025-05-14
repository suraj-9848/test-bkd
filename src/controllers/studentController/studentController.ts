import { Request, Response } from "express";
import { Course } from "../../db/mysqlModels/Course";
import { Module } from "../../db/mysqlModels/Module";
import { DayContent } from "../../db/mysqlModels/DayContent";
import { ModuleMCQ } from "../../db/mysqlModels/ModuleMCQ";
import { ModuleMCQResponses } from "../../db/mysqlModels/ModuleMCQResponses";
import { ModuleMCQAnswer } from "../../db/mysqlModels/ModuleMCQAnswer";
import { User } from "../../db/mysqlModels/User";
import { UserDayCompletion } from "../../db/mysqlModels/UserDayCompletion";
import {
  getAllRecordsWithFilter,
  getSingleRecord,
  createRecord,
  updateRecords,
} from "../../lib/dbLib/sqlUtils";

// Helper function to determine if a module is unlocked for a student
async function isModuleUnlocked(
  student: User,
  module: Module
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
      (ans: ModuleMCQAnswer) => ans.questionId === res.questionId
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
  module: Module
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
    const courses = await getAllRecordsWithFilter(Course, {});
    res.status(200).json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
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

    const modules = await getAllRecordsWithFilter(
      Module,
      { where: { course: { id: courseId } }, order: { order: "ASC" } },
      "",
      false,
      0
    );

    const modulesWithLockStatus = await Promise.all(
      modules.map(async (module: Module) => {
        const isUnlocked = await isModuleUnlocked(student, module);
        return { ...module, isLocked: !isUnlocked };
      })
    );

    res.status(200).json({ ...course, modules: modulesWithLockStatus });
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

    const days = await getAllRecordsWithFilter(
      DayContent,
      { where: { module: { id: moduleId } }, order: { dayNumber: "ASC" } },
      "",
      false,
      0
    );

    // Check if all days are completed
    const allDaysCompleted = await areAllDaysCompleted(student, module);

    // Check if MCQ has been attempted
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
            (ans: ModuleMCQAnswer) => ans.questionId === response.questionId
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
    const mcqAccessible = allDaysCompleted;

    res.status(200).json({
      ...module,
      days,
      mcqAccessible,
      allDaysCompleted,
      mcqAttempted,
      mcqPassed,
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
        false
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
      { order: { createdAt: "DESC" } }
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
        (ans: ModuleMCQAnswer) => ans.questionId === response.questionId
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
  res: Response
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
            (ans: ModuleMCQAnswer) => ans.questionId === response.questionId
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
