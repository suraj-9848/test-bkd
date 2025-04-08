"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MysqlConfig = void 0;
const config_1 = require("./config");
const User_1 = require("./db/mysqlModels/User");
const Org_1 = require("./db/mysqlModels/Org");
const Batch_1 = require("./db/mysqlModels/Batch");
const Course_1 = require("./db/mysqlModels/Course"); // Import the Course entity
exports.MysqlConfig = {
    url: config_1.config.MYSQL_DATABASE_URL,
    type: "mysql",
    synchronize: true,
    dropSchema: false,
    logging: process.env.NODE_ENV === "production" ? false : true,
    entities: [User_1.User, Org_1.Org, Batch_1.Batch, Course_1.Course],
    migrations: [],
    subscribers: [],
};
//# sourceMappingURL=ormconfig.js.map