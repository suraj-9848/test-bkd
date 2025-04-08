"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCacheKeysWithPrefix = exports.getExpiryTimeInSec = exports.checkCacheDataExist = exports.deleteCacheData = exports.setCacheData = exports.getCacheData = void 0;
const connect_1 = require("../../db/connect");
const logger = require("../../utils/logger").getLoggerByName("Redis Utils");
function getCacheData(key) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const cachedData = yield connect_1.redisClient.get(key);
            if (cachedData) {
                let data = JSON.parse(cachedData);
                return data;
            }
            else {
                return false;
            }
        }
        catch (err) {
            logger.error("ERROR ON GETTING CACHE DATA FROM REDIS CHACHE", err);
            throw err;
        }
    });
}
exports.getCacheData = getCacheData;
function setCacheData(key, data, cacheLimit) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield connect_1.redisClient.setEx(key, cacheLimit, JSON.stringify(data));
        }
        catch (err) {
            logger.error("ERROR ON CACHING DATA TO REDIS CHACHE", err);
            throw err;
        }
    });
}
exports.setCacheData = setCacheData;
function deleteCacheData(key) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield connect_1.redisClient.del(key);
        }
        catch (err) {
            logger.error("ERROR ON DELETING THE CACHE KEY =", err);
            throw err;
        }
    });
}
exports.deleteCacheData = deleteCacheData;
function checkCacheDataExist(key) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let exists = yield connect_1.redisClient.exists(key);
            return exists;
        }
        catch (err) {
            logger.error("ERROR ON CACKING KEY EXISTS", err);
            throw err;
        }
    });
}
exports.checkCacheDataExist = checkCacheDataExist;
function getExpiryTimeInSec(key) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let expiryTimeInSec = yield connect_1.redisClient.TTL(key);
            return expiryTimeInSec;
        }
        catch (err) {
            logger.error("ERROR ON CACKING KEY EXISTS", err);
            throw err;
        }
    });
}
exports.getExpiryTimeInSec = getExpiryTimeInSec;
function deleteCacheKeysWithPrefix(key) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const keys = yield connect_1.redisClient.keys(`${key}*`);
            if (keys) {
                keys.forEach((key) => __awaiter(this, void 0, void 0, function* () {
                    yield connect_1.redisClient.del(key);
                }));
                logger.info(`DELETED ${keys.length} KEYS HAVING PREFIX ${key}`);
            }
            else {
                logger.info(`NO KEYS FOUND WITH PREFIX IS ${key}`);
            }
        }
        catch (err) {
            logger.error("ERROR ON DELETING THE CACHE KEY =", err);
            throw err;
        }
    });
}
exports.deleteCacheKeysWithPrefix = deleteCacheKeysWithPrefix;
//# sourceMappingURL=redisUtils.js.map