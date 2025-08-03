#!/usr/bin/env node

import { initializeConnections, closeConnections } from "../db/connect";
import { createProSubscriptionTables } from "./migrations/createProSubscriptionTables";
import { getLogger } from "../utils/logger";

const logger = getLogger();

/**
 * Setup script for Pro Subscription system
 * This script initializes the database tables and seeds default data
 */
async function setupProSubscriptionSystem(): Promise<void> {
  try {
    logger.info("Setting up Pro Subscription system...");

    // Initialize database connections
    await initializeConnections();

    // Create tables and seed default data
    await createProSubscriptionTables();

    logger.info("✅ Pro Subscription system setup completed successfully!");
    logger.info("");
    logger.info("📋 What was created:");
    logger.info("  ✓ ProPlan table with default plans");
    logger.info("  ✓ ProSubscription table for tracking subscriptions");
    logger.info("  ✓ User table updated with Pro status fields");
    logger.info("  ✓ Routes for student subscription management");
    logger.info("  ✓ Routes for recruiter plan management");
    logger.info("  ✓ 24-hour early access middleware for job postings");
    logger.info("  ✓ Razorpay payment integration");
    logger.info("");
    logger.info("🚀 Benefits of Pro Subscription:");
    logger.info("  • 24-hour early access to job postings");
    logger.info("  • Premium profile badge");
    logger.info("  • Priority customer support");
    logger.info("  • Advanced analytics dashboard");
    logger.info("  • Resume review by experts");
    logger.info("  • Enhanced profile features");
    logger.info("");
    logger.info(
      "📖 See docs/PRO_SUBSCRIPTION_DOCUMENTATION.md for full details",
    );
  } catch (error) {
    logger.error("❌ Failed to setup Pro Subscription system:", error);
    throw error;
  } finally {
    await closeConnections();
  }
}

// Run if called directly
if (require.main === module) {
  setupProSubscriptionSystem()
    .then(() => {
      logger.info("Setup completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Setup failed:", error);
      process.exit(1);
    });
}

export { setupProSubscriptionSystem };
