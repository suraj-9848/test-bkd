// Quick script to seed Pro plans in the database
import { DataSource } from "typeorm";
import { ProPlan } from "../db/mysqlModels/ProPlan";
import { config } from "../config";

async function seedProPlans() {
  const dataSource = new DataSource({
    url: config.MYSQL_DATABASE_URL,
    type: "mysql",
    entities: [ProPlan],
    synchronize: false,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await dataSource.initialize();
    console.log("Database connected for seeding...");

    const planRepo = dataSource.getRepository(ProPlan);

    // Check if plans already exist
    const existingPlans = await planRepo.find();
    if (existingPlans.length > 0) {
      console.log("Pro plans already exist:", existingPlans.length);
      return;
    }

    // Create default pro plans
    const plans = [
      {
        id: "pro-monthly-001",
        name: "Pro Monthly",
        description: "Monthly Pro subscription with early job access",
        price: 999,
        currency: "INR",
        duration_months: 1,
        features: [
          "24-hour early access to job postings",
          "Premium profile badge",
          "Priority customer support",
          "Advanced analytics dashboard",
          "Resume review by experts",
        ],
        is_active: true,
      },
      {
        id: "pro-quarterly-001",
        name: "Pro Quarterly",
        description: "3-month Pro subscription with 15% discount",
        price: 2549,
        currency: "INR",
        duration_months: 3,
        features: [
          "24-hour early access to job postings",
          "Premium profile badge",
          "Priority customer support",
          "Advanced analytics dashboard",
          "Resume review by experts",
          "Quarterly progress reports",
        ],
        is_active: true,
      },
    ];

    for (const planData of plans) {
      const plan = planRepo.create(planData);
      await planRepo.save(plan);
      console.log(`Created plan: ${plan.name}`);
    }

    console.log("Pro plans seeded successfully!");
  } catch (error) {
    console.error("Error seeding pro plans:", error);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

seedProPlans();
