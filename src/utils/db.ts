// src/utils/db.ts
import mysql from 'mysql2/promise';
import { config } from '../config';

export const pool = mysql.createPool({
  uri: config.MYSQL_DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
