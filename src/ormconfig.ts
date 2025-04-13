import { DataSourceOptions } from "typeorm";
import { config } from "./config";
import { User } from "./db/mysqlModels/User";
import { Org } from "./db/mysqlModels/Org";
import { Batch } from "./db/mysqlModels/Batch";
import { Course } from "./db/mysqlModels/Course"; // Import the Course entity

export const MysqlConfig: DataSourceOptions = {
  url: config.MYSQL_DATABASE_URL,
  type: "mysql",
  synchronize: process.env.NODE_ENV !== "production", // Automatically syncs the database schema (use cautiously in production)
  dropSchema: false, // Never set this to true in production
  logging: process.env.NODE_ENV === "production" ? false : true,
  entities: [__dirname + "/db/mysqlModels/*.{ts,js}"],
  migrations: [],
  subscribers: [],
};
