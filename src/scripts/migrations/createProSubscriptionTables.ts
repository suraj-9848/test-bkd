import { AppDataSource } from "../../db/connect";
import { ProPlan } from "../../db/mysqlModels/ProPlan";
import { getLogger } from "../../utils/logger";

const logger = getLogger();

/**
 * TypeORM-based migration script to create Pro subscription tables and seed default data
 * This replaces direct SQL migrations with ORM-based approach
 */
export async function createProSubscriptionTables(): Promise<void> {
  try {
    await AppDataSource.initialize();

    logger.info("Creating Pro subscription tables and seeding default data...");

    // Since synchronize is true, tables will be created automatically from entities
    // We just need to sync the schema
    await AppDataSource.synchronize();

    // Seed default Pro plans
    await seedDefaultProPlans();

    logger.info(
      "Pro subscription tables created and default data seeded successfully!",
    );
  } catch (error) {
    logger.error("Error creating Pro subscription tables:", error);
    throw error;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

/**
 * Seed default Pro plans for different durations
 */
async function seedDefaultProPlans(): Promise<void> {
  const proPlanRepo = AppDataSource.getRepository(ProPlan);

  // Check if plans already exist
  const existingPlans = await proPlanRepo.count();
  if (existingPlans > 0) {
    logger.info("Pro plans already exist, skipping seeding");
    return;
  }

  const defaultPlans = [
    {
      name: "Pro Monthly",
      description: "Monthly Pro subscription with premium features",
      price: 999, // ₹9.99
      currency: "INR",
      durationDays: 30,
      features: [
        "24-hour early access to job postings",
        "Premium profile badge",
        "Priority customer support",
        "Advanced analytics dashboard",
        "Resume review by experts",
      ],
      isActive: true,
      maxSubscriptions: null, // unlimited
    },
    {
      name: "Pro Quarterly",
      description: "3-month Pro subscription with 15% discount",
      price: 2549, // ₹25.49 (15% discount)
      currency: "INR",
      durationDays: 90,
      features: [
        "24-hour early access to job postings",
        "Premium profile badge",
        "Priority customer support",
        "Advanced analytics dashboard",
        "Resume review by experts",
        "Quarterly progress reports",
      ],
      isActive: true,
      maxSubscriptions: null,
    },
    {
      name: "Pro Annual",
      description: "12-month Pro subscription with 25% discount",
      price: 8999, // ₹89.99 (25% discount)
      currency: "INR",
      durationDays: 365,
      features: [
        "24-hour early access to job postings",
        "Premium profile badge",
        "Priority customer support",
        "Advanced analytics dashboard",
        "Resume review by experts",
        "Monthly progress reports",
        "Career counseling sessions",
        "Mock interview sessions",
      ],
      isActive: true,
      maxSubscriptions: null,
    },
  ];

  for (const planData of defaultPlans) {
    const plan = proPlanRepo.create(planData);
    await proPlanRepo.save(plan);
    logger.info(`Created Pro plan: ${plan.name}`);
  }

  logger.info("Default Pro plans seeded successfully");
}

// Run migration if called directly
if (require.main === module) {
  createProSubscriptionTables()
    .then(() => {
      logger.info("Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Migration failed:", error);
      process.exit(1);
    });
}
