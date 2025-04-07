"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = exports.AppDataSource = exports.disconnect = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("../config");
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const ormconfig_1 = require("../ormconfig");
const redis_1 = require("redis");
const logger = require("../utils/logger").getLogger();
const connectionString = config_1.config.MONGO_DB_CONNECTION_STRING;
const disconnect = function () {
    logger.info("Got call to disconnect DB");
    mongoose_1.default.disconnect();
};
exports.disconnect = disconnect;
exports.AppDataSource = new typeorm_1.DataSource(ormconfig_1.MysqlConfig);
// REDIS CLIENT
exports.redisClient = (0, redis_1.createClient)({
    url: config_1.config.REDIS_URL
});
// REDIS CLIENT EVENTS
exports.redisClient.on("error", log("REDIS ERROR "));
exports.redisClient.on("end", log("REDIS END"));
exports.redisClient.on("ready", log("REDIS READY"));
exports.redisClient.on("reconnecting", log("REDIS TRYING TO RECONNECT"));
exports.redisClient.on("connect", log("REDIS CONNECTED"));
function log(type) { return function () { logger.info(type); }; }
//# sourceMappingURL=connect.js.map