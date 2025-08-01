import { BaseEntity } from "typeorm";
import { redisClient } from "../../db/connect";
import { setCacheData, getCacheData } from "../redisLib/redisUtils";
import { getLoggerByName } from "../../utils/logger";

const logger = getLoggerByName("SQL Utils");

export async function createRecord<T extends BaseEntity>(
  model: { save: (data: T) => Promise<T> },
  data: T,
  cacheKey?: string,
  _cacheLimit: number = 10 * 60,
): Promise<T> {
  try {
    const savedData = await model.save(data);

    return savedData;
  } catch (err) {
    logger.error("ERROR in createRecord", err);
    throw err;
  }
}

export async function getAllRecords<T>(
  model: typeof BaseEntity,
  key: any = "",
  isCache: boolean = false,
  cacheLimit: number = 10 * 60,
): Promise<T | any> {
  let data;
  try {
    const redisCacheActive = redisClient.isOpen;
    if (isCache && redisCacheActive) {
      const cacheData = await getCacheData(key);
      if (cacheData) {
        data = cacheData;
        return data;
      } else {
        data = await model.find({});
        await setCacheData(key, data, cacheLimit);
        return data;
      }
    } else {
      const data = await model.find({});
      return data;
    }
  } catch (err) {
    logger.error("ERROR in getAllRecords", err);
    throw err;
  }
}

export async function getSingleRecord<T, L>(
  model: typeof BaseEntity,
  query: L,
  key: any = "",
  isCache: boolean = false,
  cacheLimit: number = 10 * 60,
): Promise<T | any> {
  let data;
  try {
    const redisCacheActive = redisClient.isOpen;
    if (isCache && redisCacheActive) {
      const cacheData = await getCacheData(key);
      if (cacheData) {
        data = cacheData;
        return data;
      } else {
        data = await model.findOne(query);
        await setCacheData(key, data, cacheLimit);
        return data;
      }
    } else {
      data = await model.findOne(query);
      return data;
    }
  } catch (err) {
    logger.error("ERROR in getSingleRecord", err);
    throw err;
  }
}

export async function getAllRecordsWithFilter<T, L>(
  model: typeof BaseEntity,
  query: L,
  key: any = "",
  isCache: boolean = false,
  cacheLimit: number = 10 * 60,
): Promise<T | any> {
  let data;
  try {
    const redisCacheActive = redisClient.isOpen;
    if (isCache && redisCacheActive) {
      const cacheData = await getCacheData(key);
      if (cacheData) {
        data = cacheData;
        return data;
      } else {
        data = await model.find(query);
        await setCacheData(key, data, cacheLimit);
        return data;
      }
    } else {
      data = await model.find(query);
      return data;
    }
  } catch (err) {
    logger.error("getAllRecordsWithFilter", err);
    throw err;
  }
}

export async function deleteRecords<T, L>(
  model: typeof BaseEntity,
  query: L,
): Promise<T | any> {
  try {
    const data = await model
      .getRepository()
      .createQueryBuilder()
      .delete()
      .where(query)
      .execute();
    return data;
  } catch (err) {
    logger.error("ERROR in deleteRecords", err);
    throw err;
  }
}

export async function updateRecords<T>(
  model: typeof BaseEntity,
  query: any,
  update: any,
  upsert: boolean,
): Promise<T | any> {
  try {
    if (upsert) {
      const newData = await model.upsert(update, query);
      return newData;
    }
    const newData = await model.update(query, update);
    return newData;
  } catch (err) {
    logger.error("ERROR in updateRecords", err);
    throw err;
  }
}

export async function getFillteredRecordsWithPagination<T>(
  model: any,
  page: any,
  query: any,
  orderBy?: any,
  select?: any,
  relations?: any,
  key: any = "",
  isCache: boolean = false,
  cacheLimit: number = 10 * 60,
): Promise<T | any> {
  let data;
  try {
    const redisCacheActive = redisClient.isOpen;
    if (isCache && redisCacheActive) {
      const cacheData = await getCacheData(key);
      if (cacheData) {
        logger.debug("Cached Data", cacheData);
        data = cacheData;
        return data;
      } else {
        const skip = (page["page"] - 1) * page["limit"];
        const res1 = await model.find({
          select: select,
          where: query,
          relations: relations,
          order: {
            [orderBy.field]: orderBy.ordering,
          },
          skip: skip,
          take: page["limit"],
        });

        const res2 = await model.count({ where: query });

        data = {
          totalCount: res2,
          page: page["page"],
          limit: page["limit"],
          data: res1 ? [...res1] : [],
        };
        await setCacheData(key, data, cacheLimit);
        return data;
      }
    } else {
      const skip = (page["page"] - 1) * page["limit"];

      const res1 = await model.find({
        select: select,
        where: query,
        relations: relations,
        order: {
          [orderBy.field]: orderBy.ordering,
        },
        skip: skip,
        take: page["limit"],
      });

      const res2 = await model.count({ where: query });

      const finalData = {
        totalCount: res2,
        page: page["page"],
        limit: page["limit"],
        data: res1 ? [...res1] : [],
      };

      return finalData;
    }
  } catch (err) {
    logger.error("ERROR in getFillteredRecordsWithPagination", err);
    throw err;
  }
}

export interface PaginatedResponseType<T> {
  totalCount: number;
  page: number;
  limit: number;
  data: T[];
}

export async function getFillteredRecordsWithPaginationNew<T>(
  model: any,
  page: any,
  query: any,
  orderBy?: any,
  select?: any,
  relations?: any,
  key: any = "",
  isCache: boolean = false,
  cacheLimit: number = 10 * 60,
): Promise<T | any> {
  let data;
  try {
    const redisCacheActive = redisClient.isOpen;

    if (isCache && redisCacheActive) {
      const cacheData = await getCacheData(key);
      if (cacheData) {
        data = cacheData;
        return data;
      } else {
        const skip = (page["page"] - 1) * page["limit"];
        const res1 = await model.find({
          select: select,
          where: query,
          relations: relations,
          order: orderBy,
          skip: skip,
          take: page["limit"],
        });

        const res2 = await model.count({ where: query });

        data = {
          totalCount: res2,
          page: page["page"],
          limit: page["limit"],
          data: res1 ? [...res1] : [],
        };
        await setCacheData(key, data, cacheLimit);
        return data;
      }
    } else {
      const skip = (page["page"] - 1) * page["limit"];

      const res1 = await model.find({
        select: select,
        where: query,
        relations: relations,
        order: orderBy,
        skip: skip,
        take: page["limit"],
      });

      const res2 = await model.count({ where: query });

      const finalData = {
        totalCount: res2,
        page: page["page"],
        limit: page["limit"],
        data: res1 ? [...res1] : [],
      };

      return finalData;
    }
  } catch (err) {
    logger.error("ERROR in getFillteredRecordsWithPaginationNew", err);
    throw err;
  }
}
