import mongoose from "mongoose";
import { setCacheData, getCacheData } from "../redisLib/redisUtils";
import { getLoggerByName } from "../../utils/logger";

const logger = getLoggerByName("Mongo Utils");

interface PaginationOptions {
  page: number;
  limit: number;
  [key: string]: any;
}

export async function getAllRecords<T, K>(
  model: mongoose.Model<T>,
  query?: K,
  key: any = "",
  isCache: boolean = false,
  cacheLimit: number = 10 * 60,
) {
  let data;
  try {
    if (isCache) {
      const cacheData = await getCacheData(key);
      if (cacheData) {
        logger.info("Data fetched from cache", cacheData);
        logger.debug("Cached Data", cacheData);
        data = cacheData;
        return data;
      } else {
        data = await model.find();
        logger.info("Data fetched from db");
        logger.debug("Data from db", data);
        await setCacheData(key, data, cacheLimit);
        return data;
      }
    } else {
      data = await model.find();
      return data;
    }
  } catch (error) {
    logger.error("ERROR in getAllRecords", error);
    throw error;
  }
}

export async function getAllRecordsWithQuery<T, K>(
  model: mongoose.Model<T>,
  query?: K,
  key: any = "",
  isCache: boolean = false,
  cacheLimit: number = 10 * 60,
) {
  let data;
  try {
    if (isCache) {
      const cacheData = await getCacheData(key);
      if (cacheData) {
        logger.info("Data fetched from cache", cacheData);
        logger.debug("Cached Data", cacheData);
        data = cacheData;
        return data;
      } else {
        data = await model.find(query);
        logger.info("Data fetched from db");
        logger.debug("Data from db", data);
        await setCacheData(key, data, cacheLimit);
        return data;
      }
    } else {
      data = await model.find(query);
      return data;
    }
  } catch (error) {
    logger.error("ERROR in getAllRecords", error);
    throw error;
  }
}

export async function getAllRecordsWithPagination<T, K>(
  model: mongoose.Model<T>,
  query: K,
  options: PaginationOptions,
  key: any = "",
  isCache: boolean = false,
  cacheLimit: number = 10 * 60,
) {
  let data;
  try {
    if (isCache) {
      const cacheData = await getCacheData(key);
      if (cacheData) {
        logger.info("Data fetched from cache", cacheData);
        logger.debug("Cached Data", cacheData);
        data = cacheData;
        return data;
      } else {
        const skip = (options.page - 1) * options.limit;
        const docs = await model.find(query).skip(skip).limit(options.limit);
        const totalDocs = await model.countDocuments(query);
        data = {
          docs,
          totalDocs,
          limit: options.limit,
          page: options.page,
          totalPages: Math.ceil(totalDocs / options.limit),
          hasNextPage: options.page < Math.ceil(totalDocs / options.limit),
          hasPrevPage: options.page > 1,
        };
        logger.info("Data fetched from db");
        logger.debug("Data from db", data);
        await setCacheData(key, data, cacheLimit);
        return data;
      }
    } else {
      const skip = (options.page - 1) * options.limit;
      const docs = await model.find(query).skip(skip).limit(options.limit);
      const totalDocs = await model.countDocuments(query);
      data = {
        docs,
        totalDocs,
        limit: options.limit,
        page: options.page,
        totalPages: Math.ceil(totalDocs / options.limit),
        hasNextPage: options.page < Math.ceil(totalDocs / options.limit),
        hasPrevPage: options.page > 1,
      };
      return data;
    }
  } catch (error) {
    logger.error("ERROR in getAllRecordsWithPagination", error);
    return {};
  }
}

export async function getRecord<T, K, L>(
  model: mongoose.Model<T>,
  query: K,
  option?: L,
  key: any = "",
  isCache: boolean = false,
  cacheLimit: number = 10 * 60,
) {
  let data;
  try {
    if (isCache) {
      const cacheData = await getCacheData(key);
      if (cacheData) {
        logger.info("Data fetched from cache", cacheData);
        logger.debug("Cached Data", cacheData);
        data = cacheData;
        return data;
      } else {
        data = await model.findOne(query, option);
        logger.info("Data fetched from db");
        logger.debug("Data from db", data);
        await setCacheData(key, data, cacheLimit);
        return data;
      }
    } else {
      data = await model.findOne(query, option);
      return data;
    }
  } catch (error) {
    logger.error("ERROR in getRecord", error);
    throw error;
  }
}

// TO GET THE ARRAY OF DISTINCTFIELD FIELD WITH MATCHING QUERY ON MONGODB COLLECTION
export async function getDistinctRecord<T, K>(
  model: mongoose.Model<T>,
  query: K,
  option?: string,
  key: any = "",
  isCache: boolean = false,
  cacheLimit: number = 10 * 60,
) {
  let data;
  try {
    if (isCache) {
      const cacheData = await getCacheData(key);
      if (cacheData) {
        logger.info("Data fetched from cache", cacheData);
        logger.debug("Cached Data", cacheData);
        data = cacheData;
        return data;
      } else {
        data = await model.distinct(option, query);
        logger.info("Data fetched from db");
        logger.debug("Data from db", data);
        await setCacheData(key, data, cacheLimit);
        return data;
      }
    } else {
      data = await model.distinct(option, query);
      return data;
    }
  } catch (error) {
    logger.error("ERROR in getRecord", error);
    throw error;
  }
}

export async function createNewRecord<K>(model: any, data?: K) {
  try {
    const newData = await model.create(data);
    return newData;
  } catch (error) {
    logger.error("ERROR in createNewRecord", error);
    throw error;
  }
}

export async function updateOneRecord<T, K, L>(
  model: mongoose.Model<T>,
  query?: K,
  update?: L,
  upsert?: boolean,
) {
  try {
    const newData = await model.updateOne(query, update, { upsert });
    return newData;
  } catch (error) {
    logger.error("ERROR in updateOneRecord", error);
    throw error;
  }
}

export async function updateOneRecordByFilter<T, K, L>(
  model: mongoose.Model<T>,
  query: K,
  update: L,
) {
  try {
    const newData = await model.findOneAndUpdate(query, update, { new: true });
    return newData;
  } catch (error) {
    logger.error("ERROR in updateOneRecordByFilter", error);
    throw error;
  }
}

export async function updateSingleRecordById<T, K, L>(
  model: mongoose.Model<T>,
  id: K,
  data?: L,
) {
  try {
    const newData = await model.findByIdAndUpdate(id, data, { new: true });
    return newData;
  } catch (error) {
    logger.error("ERROR in updateSingleRecordById", error);
    throw error;
  }
}

export async function getSingleRecordById<T, K>(
  model: mongoose.Model<T>,
  id: K,
  options: any,
  key: any = "",
  isCache: boolean = false,
  cacheLimit: number = 10 * 60,
) {
  let data;
  try {
    if (isCache) {
      const cacheData = await getCacheData(key);
      if (cacheData) {
        logger.info("Data fetched from cache", cacheData);
        logger.debug("Cached Data", cacheData);
        data = cacheData;
        return data;
      } else {
        data = await model
          .findOne({
            _id: new mongoose.Types.ObjectId(id as unknown as string),
          })
          .populate(options);
        logger.info("Data fetched from db");
        logger.debug("Data from db", data);
        await setCacheData(key, data, cacheLimit);
        return data;
      }
    } else {
      data = await model
        .findOne({ _id: new mongoose.Types.ObjectId(id as unknown as string) })
        .populate(options);
      return data;
    }
  } catch (error) {
    logger.error("ERROR in getSingleRecordById", error);
    throw error;
  }
}
