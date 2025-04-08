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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSingleRecordById = exports.updateSingleRecordById = exports.updateOneRecordByFilter = exports.updateOneRecord = exports.createNewRecord = exports.getDistinctRecord = exports.getRecord = exports.getAllRecordsWithPagination = exports.getAllRecordsWithQuery = exports.getAllRecords = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const redisUtils_1 = require("../redisLib/redisUtils");
const logger = require("../../utils/logger").getLoggerByName("Mongo Utils");
function getAllRecords(model, query, key = "", isCache = false, cacheLimit = 10 * 60) {
    return __awaiter(this, void 0, void 0, function* () {
        let data;
        try {
            if (isCache) {
                const cacheData = yield (0, redisUtils_1.getCacheData)(key);
                if (cacheData) {
                    logger.info("Data fetched from cache", cacheData);
                    logger.debug("Cached Data", cacheData);
                    data = cacheData;
                    return data;
                }
                else {
                    data = yield model.find();
                    logger.info("Data fetched from db");
                    logger.debug("Data from db", data);
                    yield (0, redisUtils_1.setCacheData)(key, data, cacheLimit);
                    return data;
                }
            }
            else {
                data = yield model.find();
                return data;
            }
        }
        catch (error) {
            logger.error("ERROR in getAllRecords", error);
            throw error;
        }
    });
}
exports.getAllRecords = getAllRecords;
function getAllRecordsWithQuery(model, query, key = "", isCache = false, cacheLimit = 10 * 60) {
    return __awaiter(this, void 0, void 0, function* () {
        let data;
        try {
            if (isCache) {
                const cacheData = yield (0, redisUtils_1.getCacheData)(key);
                if (cacheData) {
                    logger.info("Data fetched from cache", cacheData);
                    logger.debug("Cached Data", cacheData);
                    data = cacheData;
                    return data;
                }
                else {
                    data = yield model.find(query);
                    logger.info("Data fetched from db");
                    logger.debug("Data from db", data);
                    yield (0, redisUtils_1.setCacheData)(key, data, cacheLimit);
                    return data;
                }
            }
            else {
                data = yield model.find(query);
                return data;
            }
        }
        catch (error) {
            logger.error("ERROR in getAllRecords", error);
            throw error;
        }
    });
}
exports.getAllRecordsWithQuery = getAllRecordsWithQuery;
function getAllRecordsWithPagination(model, query, options, key = "", isCache = false, cacheLimit = 10 * 60) {
    return __awaiter(this, void 0, void 0, function* () {
        let data;
        try {
            if (isCache) {
                const cacheData = yield (0, redisUtils_1.getCacheData)(key);
                if (cacheData) {
                    logger.info("Data fetched from cache", cacheData);
                    logger.debug("Cached Data", cacheData);
                    data = cacheData;
                    return data;
                }
                else {
                    data = yield model.paginate(query, options);
                    logger.info("Data fetched from db");
                    logger.debug("Data from db", data);
                    yield (0, redisUtils_1.setCacheData)(key, data, cacheLimit);
                    return data;
                }
            }
            else {
                data = yield model.paginate(query, options);
                return data;
            }
        }
        catch (error) {
            logger.error("ERROR in getAllRecordsWithPagination", error);
            return {};
        }
    });
}
exports.getAllRecordsWithPagination = getAllRecordsWithPagination;
function getRecord(model, query, option, key = "", isCache = false, cacheLimit = 10 * 60) {
    return __awaiter(this, void 0, void 0, function* () {
        let data;
        try {
            if (isCache) {
                const cacheData = yield (0, redisUtils_1.getCacheData)(key);
                if (cacheData) {
                    logger.info("Data fetched from cache", cacheData);
                    logger.debug("Cached Data", cacheData);
                    data = cacheData;
                    return data;
                }
                else {
                    data = yield model.findOne(query, option);
                    logger.info("Data fetched from db");
                    logger.debug("Data from db", data);
                    yield (0, redisUtils_1.setCacheData)(key, data, cacheLimit);
                    return data;
                }
            }
            else {
                data = yield model.findOne(query, option);
                return data;
            }
        }
        catch (error) {
            logger.error("ERROR in getRecord", error);
            throw error;
        }
    });
}
exports.getRecord = getRecord;
// TO GET THE ARRAY OF DISTINCTFIELD FIELD WITH MATCHING QUERY ON MONGODB COLLECTION
function getDistinctRecord(model, query, option, key = "", isCache = false, cacheLimit = 10 * 60) {
    return __awaiter(this, void 0, void 0, function* () {
        let data;
        try {
            if (isCache) {
                const cacheData = yield (0, redisUtils_1.getCacheData)(key);
                if (cacheData) {
                    logger.info("Data fetched from cache", cacheData);
                    logger.debug("Cached Data", cacheData);
                    data = cacheData;
                    return data;
                }
                else {
                    data = yield model.distinct(option, query);
                    logger.info("Data fetched from db");
                    logger.debug("Data from db", data);
                    yield (0, redisUtils_1.setCacheData)(key, data, cacheLimit);
                    return data;
                }
            }
            else {
                data = yield model.distinct(option, query);
                return data;
            }
        }
        catch (error) {
            logger.error("ERROR in getRecord", error);
            throw error;
        }
    });
}
exports.getDistinctRecord = getDistinctRecord;
function createNewRecord(model, data) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let newData = yield model.create(data);
            return newData;
        }
        catch (error) {
            logger.error("ERROR in createNewRecord", error);
            throw error;
        }
    });
}
exports.createNewRecord = createNewRecord;
function updateOneRecord(model, query, update, upsert) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let newData = yield model.updateOne(query, update, { upsert });
            return newData;
        }
        catch (error) {
            logger.error("ERROR in updateOneRecord", error);
            throw error;
        }
    });
}
exports.updateOneRecord = updateOneRecord;
function updateOneRecordByFilter(model, query, update) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let newData = yield model.findOneAndUpdate(query, update, { new: true });
            return newData;
        }
        catch (error) {
            logger.error("ERROR in updateOneRecordByFilter", error);
            throw error;
        }
    });
}
exports.updateOneRecordByFilter = updateOneRecordByFilter;
function updateSingleRecordById(model, id, data) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let newData = yield model.findByIdAndUpdate(id, data, { new: true });
            return newData;
        }
        catch (error) {
            logger.error("ERROR in updateSingleRecordById", error);
            throw error;
        }
    });
}
exports.updateSingleRecordById = updateSingleRecordById;
function getSingleRecordById(model, id, options, key = "", isCache = false, cacheLimit = 10 * 60) {
    return __awaiter(this, void 0, void 0, function* () {
        let data;
        try {
            if (isCache) {
                const cacheData = yield (0, redisUtils_1.getCacheData)(key);
                if (cacheData) {
                    logger.info("Data fetched from cache", cacheData);
                    logger.debug("Cached Data", cacheData);
                    data = cacheData;
                    return data;
                }
                else {
                    data = yield model.findOne({ _id: new mongoose_1.default.Types.ObjectId(id) }).populate(options);
                    logger.info("Data fetched from db");
                    logger.debug("Data from db", data);
                    yield (0, redisUtils_1.setCacheData)(key, data, cacheLimit);
                    return data;
                }
            }
            else {
                data = yield model.findOne({ _id: new mongoose_1.default.Types.ObjectId(id) }).populate(options);
                return data;
            }
        }
        catch (error) {
            logger.error("ERROR in getSingleRecordById", error);
            throw error;
        }
    });
}
exports.getSingleRecordById = getSingleRecordById;
//# sourceMappingURL=mongoUtils.js.map