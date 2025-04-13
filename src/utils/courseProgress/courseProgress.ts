// src/utils/courseProgress.ts
import { pool } from '../db';

export const updateCurrentPage = async (id: string, current_page: string) => {
  const [result] = await pool.execute(
    `UPDATE student_course_progress SET current_page = ? WHERE id = ?`,
    [current_page, id]
  );
  return result;
};

export const updateCourseStatus = async (id: string, status: string) => {
  const [result] = await pool.execute(
    `UPDATE student_course_progress SET status = ? WHERE id = ?`,
    [status, id]
  );
  return result;
};
