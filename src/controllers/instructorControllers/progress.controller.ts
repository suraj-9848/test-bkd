import { Request, Response } from "express";
import { In } from "typeorm";
import { StudentCourseProgress } from "../../db/mysqlModels/StudentCourseProgress";
import { StudentSessionProgress } from "../../db/mysqlModels/StudentSessionProgress";
import { User } from "../../db/mysqlModels/User";
import { Batch } from "../../db/mysqlModels/Batch";
import {
  getAllRecordsWithFilter,
  getSingleRecord,
} from "../../lib/dbLib/sqlUtils";
const logger = require("../../utils/logger").getLoggerByName("Progress Ctrl");

export const fetchCourseProgress = async (req: Request, res: Response) => {
  const { batchId, courseId } = req.params;
  try {
    const batch = await getSingleRecord<Batch, any>(
      Batch,
      { where: { id: batchId } },
      `batch_${batchId}`,
      true,
      60,
    );
    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }

    const progressList = await getAllRecordsWithFilter<
      StudentCourseProgress,
      any
    >(
      StudentCourseProgress,
      { where: { session_id: courseId } },
      `course_${courseId}_progress`,
      true,
      60,
    );

    const students = await getAllRecordsWithFilter<User, any>(
      User,
      {
        where: (qb) => qb.where("FIND_IN_SET(:batchId, batch_id)", { batchId }),
      },
      `batch_${batchId}_students`,
      false,
    );

    const report = (students as User[]).map((stu: any) => {
      const p = (progressList as StudentCourseProgress[]).find(
        (r) => r.student_id === stu.id,
      );
      return {
        studentId: stu.id,
        username: stu.username,
        currentPage: p?.current_page ?? 0,
        status: p?.status ?? "not-started",
      };
    });

    return res.json({ batchId, courseId, report });
  } catch (err) {
    logger.error("fetchCourseProgress failed", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const fetchSessionProgress = async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  try {
    const entries = await getAllRecordsWithFilter<StudentSessionProgress, any>(
      StudentSessionProgress,
      { where: { session_id: sessionId } },
      `session_${sessionId}_progress`,
      true,
      60,
    );

    const studentIds = [
      ...new Set(
        (entries as StudentSessionProgress[]).map((e) => e.student_id),
      ),
    ];

    const students = await getAllRecordsWithFilter<User, any>(
      User,
      { where: (qb) => qb.whereInIds(studentIds) },
      `session_${sessionId}_students`,
      false,
    );

    const report = (students as User[]).map((stu: any) => ({
      studentId: stu.id,
      username: stu.username,
      answers: (entries as StudentSessionProgress[])
        .filter((e) => e.student_id === stu.id)
        .map((e) => ({
          questionId: e.question_id,
          status: e.status,
        })),
    }));

    return res.json({ sessionId, report });
  } catch (err) {
    logger.error("fetchSessionProgress failed", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
