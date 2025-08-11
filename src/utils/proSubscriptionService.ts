import { AppDataSource } from "../db/connect";
import { User, UserRole } from "../db/mysqlModels/User";
import {
  ProSubscription,
  ProSubscriptionStatus,
  ProPlanType,
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

      // Find all active subscriptions for the user (snake_case fields)
      const activeSubscriptions = await getAllRecordsWithFilter(
        ProSubscription,
        {
          where: {
            user_id: userId,
            status: ProSubscriptionStatus.ACTIVE,
          },
          order: { expires_at: "DESC" },
        },
      );

      const hasActivePro = activeSubscriptions.length > 0;
      const latestExpiryDate = hasActivePro
        ? activeSubscriptions[0].expires_at
        : null;

      await userRepo.update(userId, {
        isProUser: hasActivePro,
        proExpiresAt: latestExpiryDate as any,
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

      const now = new Date();

      // Trust flags if unexpired
      if (user.isProUser && user.proExpiresAt && now < user.proExpiresAt) {
        return true;
      }
      if (user.isProUser && !user.proExpiresAt) {
        // lifetime
        return true;
      }

      // Flags might be stale — check subscriptions directly
      const activeSub = await getSingleRecord(ProSubscription, {
        where: {
          user_id: userId,
          status: ProSubscriptionStatus.ACTIVE,
        },
        order: { expires_at: "DESC" },
      });

      if (
        activeSub &&
        (activeSub.expires_at == null || now < activeSub.expires_at)
      ) {
        // Optionally sync flags in background
        try {
          const userRepo = AppDataSource.getRepository(User);
          await userRepo.update(userId, {
            isProUser: true,
            proExpiresAt: activeSub.expires_at as any,
          });
        } catch (e) {
          logger.warn("Failed to sync user Pro flags from subscription", e);
        }
        return true;
      }

      return false;
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

      // Current active subscription (snake_case fields; no invalid relations)
      const currentSubscription = await getSingleRecord(ProSubscription, {
        where: {
          user_id: userId,
          status: ProSubscriptionStatus.ACTIVE,
        },
        order: { expires_at: "DESC" },
      });

      const now = new Date();
      const subActive = Boolean(
        currentSubscription &&
          (!currentSubscription.expires_at ||
            now < currentSubscription.expires_at),
      );

      const userFlagActive = Boolean(
        user.isProUser && (!user.proExpiresAt || now < user.proExpiresAt),
      );

      const effectiveIsPro = subActive || userFlagActive;
      const effectiveExpiry =
        currentSubscription?.expires_at || user.proExpiresAt || null;

      return {
        isProUser: effectiveIsPro,
        expiresAt: effectiveExpiry,
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
        (sub) => sub.expires_at && sub.expires_at <= now,
      );

      if (toExpire.length === 0) {
        logger.info("No subscriptions to expire");
        return;
      }

      for (const subscription of toExpire) {
        await subscriptionRepo.update(subscription.id, {
          status: ProSubscriptionStatus.EXPIRED,
        });
        logger.info(
          `Expired subscription ${subscription.id} for user ${subscription.user_id}`,
        );

        await this.updateUserProStatus(subscription.user_id);
      }

      logger.info(`Expired ${toExpire.length} subscriptions`);
    } catch (error) {
      logger.error("Error expiring old subscriptions:", error);
      throw error;
    }
  }

  /**
   * Check if user is a student with active Pro access (for early job access)
   */
  static async isProStudent(userId: string): Promise<boolean> {
    try {
      const user = await getSingleRecord(User, { where: { id: userId } });
      if (!user || user.userRole !== UserRole.STUDENT) {
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

      // Compute revenue by plan_type without relying on non-existent relations
      const activeSubs = await getAllRecordsWithFilter(ProSubscription, {
        where: { status: ProSubscriptionStatus.ACTIVE },
      });

      const monthlyRevenue = activeSubs
        .filter((sub) => sub.plan_type === ProPlanType.PRO_MONTHLY)
        .reduce((sum, sub) => sum + Number(sub.amount), 0);

      const yearlyRevenue = activeSubs
        .filter((sub) => sub.plan_type === ProPlanType.PRO_YEARLY)
        .reduce((sum, sub) => sum + Number(sub.amount), 0);

      return {
        totalProUsers,
        activeSubscriptions,
        monthlyRevenue,
        yearlyRevenue,
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
