import { DataSourceOptions } from "typeorm";
import { config } from "./config";

export const MysqlConfig: DataSourceOptions = {
    url: config.MYSQL_DATABASE_URL,
    type: "mysql",
    // ssl:  process.env.NODE_ENV === "production" ? {ca : fs.readFileSync(__dirname + '/aws-ca.pem')} : false,
    synchronize: true,
    dropSchema: false, // ! Never make it true
    logging: process.env.NODE_ENV === "production" ? false : true,
    entities: ["build/db/mysqlModels/*.js"], // or .js if using compiled output
    migrations: [],
    subscribers: [],
}
