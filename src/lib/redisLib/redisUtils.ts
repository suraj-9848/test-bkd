import { redisClient } from "../../db/connect";
import { getLoggerByName } from "../../utils/logger";

const logger = getLoggerByName("Redis Utils");

export async function getCacheData(key: any) {
  try {
    const cachedData = await redisClient.get(key);
    if (cachedData) {
      const data = JSON.parse(cachedData);
      return data;
    } else {
      return false;
    }
  } catch (err) {
    logger.error("ERROR ON GETTING CACHE DATA FROM REDIS CHACHE", err);
    throw err;
  }
}

export async function setCacheData(key: any, data: any, cacheLimit: number) {
  try {
    // Ensure cacheLimit is a valid positive integer
    const safeCacheLimit = Math.max(1, Math.floor(cacheLimit) || 60);
    await redisClient.setEx(key, safeCacheLimit, JSON.stringify(data));
  } catch (err) {
    logger.error("ERROR ON CACHING DATA TO REDIS CHACHE", err);
    throw err;
  }
}

export async function deleteCacheData(key: any) {
  try {
    await redisClient.del(key);
  } catch (err) {
    logger.error("ERROR ON DELETING THE CACHE KEY =", err);
    throw err;
  }
}

export async function checkCacheDataExist(key: any) {
  try {
    const exists = await redisClient.exists(key);
    return exists;
  } catch (err) {
    logger.error("ERROR ON CACKING KEY EXISTS", err);
    throw err;
  }
}

export async function getExpiryTimeInSec(key: any) {
  try {
    const expiryTimeInSec = await redisClient.TTL(key);
    return expiryTimeInSec;
  } catch (err) {
    logger.error("ERROR ON CACKING KEY EXISTS", err);
    throw err;
  }
}

export async function deleteCacheKeysWithPrefix(key: any) {
  try {
    const keys = await redisClient.keys(`${key}*`);
    if (keys) {
      keys.forEach(async (key) => {
        await redisClient.del(key);
      });
      logger.info(`DELETED ${keys.length} KEYS HAVING PREFIX ${key}`);
    } else {
      logger.info(`NO KEYS FOUND WITH PREFIX IS ${key}`);
    }
  } catch (err) {
    logger.error("ERROR ON DELETING THE CACHE KEY =", err);
    throw err;
  }
}
