"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MysqlConfig = void 0;
const config_1 = require("./config");
// import fs from "fs"
exports.MysqlConfig = {
    url: config_1.config.MYSQL_DATABASE_URL,
    type: "mysql",
    // ssl:  process.env.NODE_ENV === "production" ? {ca : fs.readFileSync(__dirname + '/aws-ca.pem')} : false,
    synchronize: true,
    dropSchema: false,
    logging: process.env.NODE_ENV === "production" ? false : true,
    entities: ["build/db/mysqlModels/*.js"],
    migrations: [],
    subscribers: [],
};
//# sourceMappingURL=ormconfig.js.map