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
exports.getFillteredRecordsWithPaginationNew = exports.getFillteredRecordsWithPagination = exports.updateRecords = exports.deleteRecords = exports.getAllRecordsWithFilter = exports.getSingleRecord = exports.getAllRecords = exports.createRecord = void 0;
const connect_1 = require("../../db/connect");
const redisUtils_1 = require("../redisLib/redisUtils");
const logger = require("../../utils/logger").getLoggerByName("SQL Utils");
function createRecord(model, data, cacheKey, cacheLimit = 10 * 60) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const savedData = yield model.save(data);
            if (cacheKey && connect_1.redisClient.isOpen) {
                yield (0, redisUtils_1.setCacheData)(cacheKey, savedData, cacheLimit);
            }
            return savedData;
        }
        catch (err) {
            logger.error("ERROR in createRecord", err);
            throw err;
        }
    });
}
exports.createRecord = createRecord;
function getAllRecords(model, key = "", isCache = false, cacheLimit = 10 * 60) {
    return __awaiter(this, void 0, void 0, function* () {
        let data;
        try {
            let redisCacheActive = connect_1.redisClient.isOpen;
            if (isCache && redisCacheActive) {
                const cacheData = yield (0, redisUtils_1.getCacheData)(key);
                if (cacheData) {
                    data = cacheData;
                    return data;
                }
                else {
                    data = yield model.find({});
                    yield (0, redisUtils_1.setCacheData)(key, data, cacheLimit);
                    return data;
                }
            }
            else {
                let data = yield model.find({});
                return data;
            }
        }
        catch (err) {
            logger.error("ERROR in getAllRecords", err);
            throw err;
        }
    });
}
exports.getAllRecords = getAllRecords;
function getSingleRecord(model, query, key = "", isCache = false, cacheLimit = 10 * 60) {
    return __awaiter(this, void 0, void 0, function* () {
        let data;
        try {
            let redisCacheActive = connect_1.redisClient.isOpen;
            if (isCache && redisCacheActive) {
                const cacheData = yield (0, redisUtils_1.getCacheData)(key);
                if (cacheData) {
                    data = cacheData;
                    return data;
                }
                else {
                    data = yield model.findOne(query);
                    yield (0, redisUtils_1.setCacheData)(key, data, cacheLimit);
                    return data;
                }
            }
            else {
                data = yield model.findOne(query);
                return data;
            }
        }
        catch (err) {
            logger.error("ERROR in getSingleRecord", err);
            throw err;
        }
    });
}
exports.getSingleRecord = getSingleRecord;
function getAllRecordsWithFilter(model, query, key = "", isCache = false, cacheLimit = 10 * 60) {
    return __awaiter(this, void 0, void 0, function* () {
        let data;
        try {
            let redisCacheActive = connect_1.redisClient.isOpen;
            if (isCache && redisCacheActive) {
                const cacheData = yield (0, redisUtils_1.getCacheData)(key);
                if (cacheData) {
                    data = cacheData;
                    return data;
                }
                else {
                    data = yield model.find(query);
                    yield (0, redisUtils_1.setCacheData)(key, data, cacheLimit);
                    return data;
                }
            }
            else {
                data = yield model.find(query);
                return data;
            }
        }
        catch (err) {
            logger.error("getAllRecordsWithFilter", err);
            throw err;
        }
    });
}
exports.getAllRecordsWithFilter = getAllRecordsWithFilter;
function deleteRecords(model, query) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let data = yield model.getRepository().createQueryBuilder().delete().where(query).execute();
            return data;
        }
        catch (err) {
            logger.error("ERROR in deleteRecords", err);
            throw err;
        }
    });
}
exports.deleteRecords = deleteRecords;
function updateRecords(model, query, update, upsert) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (upsert) {
                let newData = yield model.upsert(update, query);
                return newData;
            }
            let newData = yield model.update(query, update);
            return newData;
        }
        catch (err) {
            logger.error("ERROR in updateRecords", err);
            throw err;
        }
    });
}
exports.updateRecords = updateRecords;
function getFillteredRecordsWithPagination(model, page, query, orderBy, select, relations, key = "", isCache = false, cacheLimit = 10 * 60) {
    return __awaiter(this, void 0, void 0, function* () {
        let data;
        try {
            let redisCacheActive = connect_1.redisClient.isOpen;
            if (isCache && redisCacheActive) {
                const cacheData = yield (0, redisUtils_1.getCacheData)(key);
                if (cacheData) {
                    logger.debug("Cached Data", cacheData);
                    data = cacheData;
                    return data;
                }
                else {
                    let skip = (page["page"] - 1) * page["limit"];
                    let res1 = yield model.find({
                        select: select,
                        where: query,
                        relations: relations,
                        order: {
                            [orderBy.field]: orderBy.ordering,
                        },
                        skip: skip,
                        take: page["limit"],
                    });
                    let res2 = yield model.count({ where: query });
                    data = {
                        totalCount: res2,
                        page: page["page"],
                        limit: page["limit"],
                        data: [...res1] || [],
                    };
                    yield (0, redisUtils_1.setCacheData)(key, data, cacheLimit);
                    return data;
                }
            }
            else {
                let skip = (page["page"] - 1) * page["limit"];
                let res1 = yield model.find({
                    select: select,
                    where: query,
                    relations: relations,
                    order: {
                        [orderBy.field]: orderBy.ordering,
                    },
                    skip: skip,
                    take: page["limit"],
                });
                let res2 = yield model.count({ where: query });
                let finalData = {
                    totalCount: res2,
                    page: page["page"],
                    limit: page["limit"],
                    data: [...res1] || [],
                };
                return finalData;
            }
        }
        catch (err) {
            logger.error("ERROR in getFillteredRecordsWithPagination", err);
            throw err;
        }
    });
}
exports.getFillteredRecordsWithPagination = getFillteredRecordsWithPagination;
function getFillteredRecordsWithPaginationNew(model, page, query, orderBy, select, relations, key = "", isCache = false, cacheLimit = 10 * 60) {
    return __awaiter(this, void 0, void 0, function* () {
        let data;
        try {
            let redisCacheActive = connect_1.redisClient.isOpen;
            if (isCache && redisCacheActive) {
                const cacheData = yield (0, redisUtils_1.getCacheData)(key);
                if (cacheData) {
                    data = cacheData;
                    return data;
                }
                else {
                    let skip = (page["page"] - 1) * page["limit"];
                    let res1 = yield model.find({
                        select: select,
                        where: query,
                        relations: relations,
                        order: orderBy,
                        skip: skip,
                        take: page["limit"],
                    });
                    let res2 = yield model.count({ where: query });
                    data = {
                        totalCount: res2,
                        page: page["page"],
                        limit: page["limit"],
                        data: [...res1] || [],
                    };
                    yield (0, redisUtils_1.setCacheData)(key, data, cacheLimit);
                    return data;
                }
            }
            else {
                let skip = (page["page"] - 1) * page["limit"];
                let res1 = yield model.find({
                    select: select,
                    where: query,
                    relations: relations,
                    order: orderBy,
                    skip: skip,
                    take: page["limit"],
                });
                let res2 = yield model.count({ where: query });
                let finalData = {
                    totalCount: res2,
                    page: page["page"],
                    limit: page["limit"],
                    data: [...res1] || [],
                };
                return finalData;
            }
        }
        catch (err) {
            logger.error("ERROR in getFillteredRecordsWithPaginationNew", err);
            throw err;
        }
    });
}
exports.getFillteredRecordsWithPaginationNew = getFillteredRecordsWithPaginationNew;
//# sourceMappingURL=sqlUtils.js.map