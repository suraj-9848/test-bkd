import { AppDataSource } from "../db/connect";
import { User } from "../db/mysqlModels/User";
import {
  ProSubscription,
  ProSubscriptionStatus,
} from "../db/mysqlModels/ProSubscription";
import {
  getSingleRecord,
  getAllRecordsWithFilter,
} from "../lib/dbLib/sqlUtils";
import { getLogger } from "./logger";

const logger = getLogger();

/**
 * Utility service for managing Pro subscription status
 */
export class ProSubscriptionService {
  /**
   * Update user's Pro status based on their active subscriptions
   */
  static async updateUserProStatus(userId: string): Promise<void> {
    try {
      const userRepo = AppDataSource.getRepository(User);

      // Find all active subscriptions for the user
      const activeSubscriptions = await getAllRecordsWithFilter(
        ProSubscription,
        {
          where: {
            userId: userId,
            status: ProSubscriptionStatus.ACTIVE,
          },
          order: { expiresAt: "DESC" },
        },
      );

      // Determine if user has any active Pro subscriptions
      const hasActivePro = activeSubscriptions.length > 0;
      const latestExpiryDate = hasActivePro
        ? activeSubscriptions[0].expiresAt
        : null;

      // Update user's Pro status
      await userRepo.update(userId, {
        isProUser: hasActivePro,
        proExpiresAt: latestExpiryDate,
      });

      logger.info(
        `Updated Pro status for user ${userId}: isProUser=${hasActivePro}, expires=${latestExpiryDate}`,
      );
    } catch (error) {
      logger.error(`Error updating Pro status for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a user has active Pro subscription
   */
  static async hasActiveProSubscription(userId: string): Promise<boolean> {
    try {
      const user = await getSingleRecord(User, {
        where: { id: userId },
      });

      if (!user) {
        return false;
      }

      // Check if user is marked as Pro and subscription hasn't expired
      if (user.isProUser && user.proExpiresAt) {
        const now = new Date();
        return now < user.proExpiresAt;
      }

      return user.isProUser && !user.proExpiresAt; // lifetime subscription
    } catch (error) {
      logger.error(`Error checking Pro status for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get user's Pro subscription details
   */
  static async getUserProDetails(userId: string): Promise<{
    isProUser: boolean;
    expiresAt: Date | null;
    currentSubscription: ProSubscription | null;
  }> {
    try {
      const user = await getSingleRecord(User, {
        where: { id: userId },
      });

      if (!user) {
        return {
          isProUser: false,
          expiresAt: null,
          currentSubscription: null,
        };
      }

      // Get current active subscription
      const currentSubscription = await getSingleRecord(ProSubscription, {
        where: {
          userId: userId,
          status: ProSubscriptionStatus.ACTIVE,
        },
        relations: ["proPlan"],
        order: { expiresAt: "DESC" },
      });

      return {
        isProUser: user.isProUser,
        expiresAt: user.proExpiresAt,
        currentSubscription,
      };
    } catch (error) {
      logger.error(`Error getting Pro details for user ${userId}:`, error);
      return {
        isProUser: false,
        expiresAt: null,
        currentSubscription: null,
      };
    }
  }

  /**
   * Expire old subscriptions and update user statuses
   */
  static async expireOldSubscriptions(): Promise<void> {
    try {
      const subscriptionRepo = AppDataSource.getRepository(ProSubscription);

      // Find expired subscriptions
      const expiredSubscriptions = await getAllRecordsWithFilter(
        ProSubscription,
        {
          where: {
            status: ProSubscriptionStatus.ACTIVE,
          },
        },
      );

      const now = new Date();
      const toExpire = expiredSubscriptions.filter(
        (sub) => sub.expiresAt && sub.expiresAt <= now,
      );

      if (toExpire.length === 0) {
        logger.info("No subscriptions to expire");
        return;
      }

      // Update expired subscriptions
      for (const subscription of toExpire) {
        await subscriptionRepo.update(subscription.id, {
          status: ProSubscriptionStatus.EXPIRED,
        });
        logger.info(
          `Expired subscription ${subscription.id} for user ${subscription.userId}`,
        );

        // Update user's Pro status
        await this.updateUserProStatus(subscription.userId);
      }

      logger.info(`Expired ${toExpire.length} subscriptions`);
    } catch (error) {
      logger.error("Error expiring old subscriptions:", error);
      throw error;
    }
  }

  /**
   * Check if user is a student with Pro access (for job early access)
   */
  static async isProStudent(userId: string): Promise<boolean> {
    try {
      const user = await getSingleRecord(User, {
        where: { id: userId },
      });

      if (!user || user.userRole !== "student") {
        return false;
      }

      return await this.hasActiveProSubscription(userId);
    } catch (error) {
      logger.error(`Error checking if user ${userId} is Pro student:`, error);
      return false;
    }
  }

  /**
   * Get Pro subscription analytics for recruiters/admins
   */
  static async getProAnalytics(): Promise<{
    totalProUsers: number;
    activeSubscriptions: number;
    monthlyRevenue: number;
    yearlyRevenue: number;
  }> {
    try {
      const userRepo = AppDataSource.getRepository(User);
      const subscriptionRepo = AppDataSource.getRepository(ProSubscription);

      const totalProUsers = await userRepo.count({
        where: { isProUser: true },
      });

      const activeSubscriptions = await subscriptionRepo.count({
        where: { status: ProSubscriptionStatus.ACTIVE },
      });

      // Calculate revenue from active subscriptions
      const activeSubsWithPlans = await getAllRecordsWithFilter(
        ProSubscription,
        {
          where: { status: ProSubscriptionStatus.ACTIVE },
          relations: ["proPlan"],
        },
      );

      const monthlyRevenue = activeSubsWithPlans
        .filter((sub) => sub.proPlan.durationDays <= 31)
        .reduce((sum, sub) => sum + sub.amount, 0);

      const yearlyRevenue = activeSubsWithPlans
        .filter((sub) => sub.proPlan.durationDays >= 365)
        .reduce((sum, sub) => sum + sub.amount, 0);

      return {
        totalProUsers,
        activeSubscriptions,
        monthlyRevenue: monthlyRevenue / 100, // Convert paisa to rupees
        yearlyRevenue: yearlyRevenue / 100, // Convert paisa to rupees
      };
    } catch (error) {
      logger.error("Error getting Pro analytics:", error);
      return {
        totalProUsers: 0,
        activeSubscriptions: 0,
        monthlyRevenue: 0,
        yearlyRevenue: 0,
      };
    }
  }
}
