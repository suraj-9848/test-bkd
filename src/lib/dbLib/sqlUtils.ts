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

/**
 * Get count of records with caching support
 */
export async function getRecordCount(
  model: typeof BaseEntity,
  query: any = {},
  key: any = "",
  isCache: boolean = false,
  cacheLimit: number = 10 * 60,
): Promise<number> {
  try {
    const redisCacheActive = redisClient.isOpen;
    if (isCache && redisCacheActive && key) {
      const cacheData = await getCacheData(key);
      if (cacheData !== null) {
        return cacheData;
      }
    }

    const count = await model.count(query);

    if (isCache && redisCacheActive && key) {
      await setCacheData(key, count, cacheLimit);
    }

    return count;
  } catch (err) {
    logger.error("ERROR in getRecordCount", err);
    throw err;
  }
}

/**
 * Get aggregated data (SUM, COUNT, AVG, etc.) with caching support
 */
export async function getAggregatedData(
  model: typeof BaseEntity,
  aggregateQuery: {
    select: string[];
    where?: string | object;
    whereParams?: any;
    groupBy?: string[];
  },
  key: any = "",
  isCache: boolean = false,
  cacheLimit: number = 10 * 60,
): Promise<any> {
  try {
    const redisCacheActive = redisClient.isOpen;
    if (isCache && redisCacheActive && key) {
      const cacheData = await getCacheData(key);
      if (cacheData) {
        return cacheData;
      }
    }

    let queryBuilder = model.createQueryBuilder();

    if (aggregateQuery.select) {
      queryBuilder = queryBuilder.select(aggregateQuery.select);
    }

    if (aggregateQuery.where) {
      if (typeof aggregateQuery.where === "string") {
        queryBuilder = queryBuilder.where(
          aggregateQuery.where,
          aggregateQuery.whereParams,
        );
      } else {
        queryBuilder = queryBuilder.where(aggregateQuery.where);
      }
    }

    if (aggregateQuery.groupBy) {
      aggregateQuery.groupBy.forEach((group) => {
        queryBuilder = queryBuilder.addGroupBy(group);
      });
    }

    const result = await queryBuilder.getRawMany();

    if (isCache && redisCacheActive && key) {
      await setCacheData(key, result, cacheLimit);
    }

    return result;
  } catch (err) {
    logger.error("ERROR in getAggregatedData", err);
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

/**
 * Creates a new entity instance without saving it to the database
 * @param model - The entity model/class
 * @param data - The data to populate the entity with
 * @returns A new entity instance
 */
export function createEntityInstance<T extends BaseEntity>(
  model: new () => T,
  data: Partial<T>,
): T {
  try {
    const entity = new model();
    Object.assign(entity, data);
    return entity;
  } catch (err) {
    logger.error("ERROR in createEntityInstance", err);
    throw err;
  }
}
