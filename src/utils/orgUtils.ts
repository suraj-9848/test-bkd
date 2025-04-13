import { AppDataSource } from "../db/connect";
import { Org } from "../db/mysqlModels/Org";

export class OrgUtils {
  static async getOrCreateDefaultOrg() {
    const orgRepository = AppDataSource.getRepository(Org);

    let defaultOrg = await orgRepository.findOneBy({ name: "Default Org" });

    if (!defaultOrg) {
      defaultOrg = await orgRepository.save({
        name: "Default Org",
        description: "Default organization description",
        address: "Default address",
      });
    }

    return defaultOrg;
  }
}
