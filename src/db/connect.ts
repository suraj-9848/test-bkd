import mongoose from "mongoose"
import { config } from "../config"
import "reflect-metadata"
import { DataSource } from "typeorm"
import { MysqlConfig } from "../ormconfig"
import { createClient } from 'redis';


const logger = require("../utils/logger").getLogger()

const connectionString = config.MONGO_DB_CONNECTION_STRING

export const connectMongoDB = async () => {

        await mongoose.connect(connectionString);
        logger.info("MongoDB connected...");
    // } catch (err) {
        // logger.error("Failed to connect MongoDB", err);
        // process.exit(1); // Exit if DB connection fails
    
};



export const disconnect = function () {
    logger.info("Got call to disconnect DB")
    mongoose.disconnect()
}

export const AppDataSource = new DataSource(MysqlConfig)

// REDIS CLIENT
export const redisClient = createClient({
    url: config.REDIS_URL
});

// REDIS CLIENT EVENTS
redisClient.on("error", log("REDIS ERROR "))
redisClient.on("end", log("REDIS END"))
redisClient.on("ready", log("REDIS READY"))
redisClient.on("reconnecting", log("REDIS TRYING TO RECONNECT"))
redisClient.on("connect", log("REDIS CONNECTED"))

function log(type : string) { return function () { logger.info(type)} }
