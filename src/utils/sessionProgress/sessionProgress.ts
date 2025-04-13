
import { pool } from '../db';

export const updateSessionId = async (id: string, session_id: string) => {
  const [result] = await pool.execute(
    `UPDATE student_session_progress SET session_id = ? WHERE id = ?`,
    [session_id, id]
  );
  return result;
};

export const updateQuestionId = async (id: string, question_id: string) => {
  const [result] = await pool.execute(
    `UPDATE student_session_progress SET question_id = ? WHERE id = ?`,
    [question_id, id]
  );
  return result;
};

export const updateStatus = async (id: string, status: string) => {
  const [result] = await pool.execute(
    `UPDATE student_session_progress SET status = ? WHERE id = ?`,
    [status, id]
  );
  return result;
};
