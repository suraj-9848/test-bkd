import { redisClient } from "../../db/connect";
const logger = require("../../utils/logger").getLoggerByName("Redis Utils");

/**
 * Get data from Redis cache by key.
 */
export async function getCacheData<T>(key: string): Promise<T | false> {
  try {
    const cachedData = await redisClient.get(key);
    return cachedData ? JSON.parse(cachedData) : false;
  } catch (err) {
    logger.error("ERROR ON GETTING CACHE DATA FROM REDIS CACHE", err);
    throw err;
  }
}

/**
 * Set data in Redis cache with optional TTL (default: 600 seconds).
 */
export async function setCacheData<T>(
  key: string,
  data: T,
  cacheLimit?: number
): Promise<void> {
  try {
    const ttl =
      Number.isInteger(cacheLimit) && cacheLimit! > 0 ? cacheLimit! : 600;
    await redisClient.setEx(key, ttl, JSON.stringify(data));
  } catch (err) {
    logger.error("ERROR ON CACHING DATA TO REDIS CACHE", err?.stack || err);
    throw err;
  }
}

/**
 * Delete a single key from Redis cache.
 */
export async function deleteCacheData(key: string): Promise<void> {
  try {
    await redisClient.del(key);
  } catch (err) {
    logger.error("ERROR ON DELETING THE CACHE KEY", err);
    throw err;
  }
}

/**
 * Check if a cache key exists.
 */
export async function checkCacheDataExist(key: string): Promise<boolean> {
  try {
    const exists = await redisClient.exists(key);
    return exists === 1;
  } catch (err) {
    logger.error("ERROR ON CHECKING KEY EXISTS", err);
    throw err;
  }
}

/**
 * Get the TTL (time to live) in seconds for a cache key.
 */
export async function getExpiryTimeInSec(key: string): Promise<number> {
  try {
    return await redisClient.ttl(key);
  } catch (err) {
    logger.error("ERROR ON GETTING TTL FOR KEY", err);
    throw err;
  }
}

/**
 * Delete all keys in Redis that match a given prefix.
 */
export async function deleteCacheKeysWithPrefix(prefix: string): Promise<void> {
  try {
    const keys = await redisClient.keys(`${prefix}*`);
    if (keys.length) {
      await Promise.all(keys.map((key) => redisClient.del(key)));
      logger.info(`DELETED ${keys.length} KEYS WITH PREFIX '${prefix}'`);
    } else {
      logger.info(`NO KEYS FOUND WITH PREFIX '${prefix}'`);
    }
  } catch (err) {
    logger.error("ERROR ON DELETING CACHE KEYS WITH PREFIX", err);
    throw err;
  }
}