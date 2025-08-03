import { ProSubscriptionService } from "../utils/proSubscriptionService";
import { initializeConnections, closeConnections } from "../db/connect";
import { getLogger } from "../utils/logger";

const logger = getLogger();

/**
 * Cron job script to expire old Pro subscriptions
 * This should be run periodically (e.g., every hour) to check and expire old subscriptions
 */
async function expireOldSubscriptions(): Promise<void> {
  try {
    logger.info("Starting subscription expiry check...");

    await initializeConnections();

    await ProSubscriptionService.expireOldSubscriptions();

    logger.info("Subscription expiry check completed successfully");
  } catch (error) {
    logger.error("Error in subscription expiry job:", error);
    throw error;
  } finally {
    await closeConnections();
  }
}

// Run if called directly (for cron jobs)
if (require.main === module) {
  expireOldSubscriptions()
    .then(() => {
      logger.info("Subscription expiry job completed");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Subscription expiry job failed:", error);
      process.exit(1);
    });
}

export { expireOldSubscriptions };
