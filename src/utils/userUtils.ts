import { AppDataSource } from "../db/connect";
import { User } from "../db/mysqlModels/User";

const logger = require("./logger").getLoggerByName("UserUtils");
const userRepository = AppDataSource.getRepository(User);

export class UserUtils {

  static async findByEmail(email: string): Promise<User | null> {
    try {
      return await userRepository.findOneBy({ email });
    } catch (error) {
      logger.error("Error finding user by email", { email, error });
      return null;
    }
  }

  
  static async findById(id: string): Promise<User | null> {
    try {
      return await userRepository.findOneBy({ id });
    } catch (error) {
      logger.error("Error finding user by ID", { id, error });
      return null;
    }
  }

 
  static async findByEmailOrUsername(
    email: string,
    username: string
  ): Promise<User | null> {
    try {
      return await userRepository.findOneBy([{ email }, { username }]);
    } catch (error) {
      logger.error("Error finding user by email or username", {
        email,
        username,
        error,
      });
      return null;
    }
  }
}
