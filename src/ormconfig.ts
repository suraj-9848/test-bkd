import { DataSourceOptions } from "typeorm";
import { config } from "./config";

export const MysqlConfig: DataSourceOptions = {
  url: config.MYSQL_DATABASE_URL,
  type: "mysql",
  synchronize: process.env.NODE_ENV !== "production", 
  dropSchema: false, 
  logging: process.env.NODE_ENV === "production" ? false : true,
  entities: [__dirname + "/db/mysqlModels/*.js"],
  migrations: [],
  subscribers: [],
};
