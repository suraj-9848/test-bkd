import { config } from "../config";
import "reflect-metadata";
import { DataSource } from "typeorm";
import { MysqlConfig } from "../ormconfig";
import { createClient } from "redis";
import { getLogger } from "../utils/logger";

const logger = getLogger();

export const AppDataSource = new DataSource(MysqlConfig);

// IMPROVED REDIS CLIENT WITH PROPER ERROR HANDLING
export const redisClient = createClient({
  url: config.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 20) {
        logger.error("Too many Redis reconnection attempts, giving up");
        return false;
      }
      return Math.min(retries * 50, 500);
    },
  },
});

// ENHANCED REDIS CLIENT EVENTS
redisClient.on("error", (err) => {
  logger.error("REDIS ERROR:", err);
});
redisClient.on("end", () => {
  logger.info("REDIS CONNECTION ENDED");
});
redisClient.on("ready", () => {
  logger.info("REDIS READY");
});
redisClient.on("reconnecting", () => {
  logger.info("REDIS RECONNECTING");
});
redisClient.on("connect", () => {
  logger.info("REDIS CONNECTED");
});

// IMPROVED DATABASE CONNECTION INITIALIZATION
export const initializeConnections = async (): Promise<void> => {
  try {
    // Initialize TypeORM connection
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      logger.info("TypeORM DataSource has been initialized!");
    }

    // Initialize Redis connection
    if (!redisClient.isOpen) {
      await redisClient.connect();
      logger.info("Redis client connected!");
    }
  } catch (error) {
    logger.error("Error during Data Source initialization:", error);
    throw error;
  }
};

// GRACEFUL SHUTDOWN
export const closeConnections = async (): Promise<void> => {
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      logger.info("TypeORM connection closed");
    }

    if (redisClient.isOpen) {
      await redisClient.quit();
      logger.info("Redis connection closed");
    }
  } catch (error) {
    logger.error("Error closing connections:", error);
  }
};

// Handle process termination
process.on("SIGTERM", closeConnections);
process.on("SIGINT", closeConnections);
