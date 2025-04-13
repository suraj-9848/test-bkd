import { AppDataSource } from "../db/connect";
import { Org } from "../db/mysqlModels/Org";
const logger = require("./logger").getLoggerByName("OrgUtils"); 

export class OrgUtils {
  static async getOrCreateDefaultOrg() {
    const orgRepository = AppDataSource.getRepository(Org);

    try {
      let defaultOrg = await orgRepository.findOneBy({ name: "Default Org" });

      if (!defaultOrg) {
        defaultOrg = await orgRepository.save({
          name: "Default Org",
          description: "Default organization description",
          address: "Default address",
        });
        logger.info("Default Org created successfully");
      }

      return defaultOrg;
    } catch (error) {
      logger.error("Error in getOrCreateDefaultOrg", { error });
      throw new Error("Failed to get or create the Default Org");
    }
  }
}
