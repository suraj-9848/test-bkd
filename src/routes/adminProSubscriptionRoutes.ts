import { Router } from "express";
import { Request, Response } from "express";
import {
  ProSubscription,
  ProSubscriptionStatus,
} from "../db/mysqlModels/ProSubscription";
import { ProPlan } from "../db/mysqlModels/ProPlan";
import { authMiddleware, requireRole } from "../middleware/authMiddleware";
import { UserRole } from "../db/mysqlModels/User";
import {
  getAllRecordsWithFilter,
  getSingleRecord,
  updateRecords,
} from "../lib/dbLib/sqlUtils";

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Apply admin role requirement to all routes
router.use(requireRole([UserRole.ADMIN]));

// Get all subscriptions with filters
router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      status,
      plan_id,
      user_id,
      page = 1,
      limit = 50,
      sort_by = "created_at",
      sort_order = "DESC",
    } = req.query;

    const whereConditions: any = {};

    if (status) {
      whereConditions.status = status;
    }
    if (plan_id) {
      whereConditions.plan_id = plan_id;
    }
    if (user_id) {
      whereConditions.user_id = user_id;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const subscriptions = await getAllRecordsWithFilter(ProSubscription, {
      where: whereConditions,
      relations: ["user"],
      order: { [sort_by as string]: sort_order as "ASC" | "DESC" },
      skip,
      take: Number(limit),
    });

    const total = await ProSubscription.count({ where: whereConditions });

    return res.status(200).json({
      success: true,
      subscriptions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscriptions",
    });
  }
});

// Get subscription statistics
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const { period = "30d" } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case "7d":
        startDate.setDate(endDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(endDate.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(endDate.getDate() - 90);
        break;
      case "1y":
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    // Get overall statistics
    const totalStats = await ProSubscription.createQueryBuilder("subscription")
      .select([
        "COUNT(*) as total_subscriptions",
        "COUNT(CASE WHEN status = :active THEN 1 END) as active_subscriptions",
        "COUNT(CASE WHEN status = :canceled THEN 1 END) as canceled_subscriptions",
        "COUNT(CASE WHEN status = :expired THEN 1 END) as expired_subscriptions",
        "SUM(CASE WHEN status = :active THEN amount ELSE 0 END) as total_revenue",
        "AVG(CASE WHEN status = :active THEN amount ELSE NULL END) as avg_revenue",
      ])
      .setParameters({
        active: ProSubscriptionStatus.ACTIVE,
        canceled: ProSubscriptionStatus.CANCELED,
        expired: ProSubscriptionStatus.EXPIRED,
      })
      .getRawOne();

    // Get period statistics
    const periodStats = await ProSubscription.createQueryBuilder("subscription")
      .select([
        "COUNT(*) as period_subscriptions",
        "SUM(amount) as period_revenue",
      ])
      .where("subscription.created_at >= :startDate", { startDate })
      .andWhere("subscription.created_at <= :endDate", { endDate })
      .getRawOne();

    // Get plan-wise statistics
    const planStats = await ProSubscription.createQueryBuilder("subscription")
      .leftJoin(ProPlan, "plan", "plan.id = subscription.plan_id")
      .select([
        "plan.name as plan_name",
        "plan.id as plan_id",
        "COUNT(*) as subscription_count",
        "COUNT(CASE WHEN subscription.status = :active THEN 1 END) as active_count",
        "SUM(CASE WHEN subscription.status = :active THEN subscription.amount ELSE 0 END) as revenue",
      ])
      .setParameters({ active: ProSubscriptionStatus.ACTIVE })
      .groupBy("plan.id, plan.name")
      .getRawMany();

    // Get daily revenue for chart
    const dailyRevenue = await ProSubscription.createQueryBuilder(
      "subscription",
    )
      .select([
        "DATE(subscription.created_at) as date",
        "COUNT(*) as subscription_count",
        "SUM(subscription.amount) as revenue",
      ])
      .where("subscription.created_at >= :startDate", { startDate })
      .andWhere("subscription.created_at <= :endDate", { endDate })
      .groupBy("DATE(subscription.created_at)")
      .orderBy("date", "ASC")
      .getRawMany();

    return res.status(200).json({
      success: true,
      stats: {
        overall: totalStats,
        period: periodStats,
        by_plan: planStats,
        daily_revenue: dailyRevenue,
        period_range: { startDate, endDate },
      },
    });
  } catch (error) {
    console.error("Error fetching subscription stats:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription statistics",
    });
  }
});

// Update subscription status (admin override)
router.put("/:id/status", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!Object.values(ProSubscriptionStatus).includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const subscription = await getSingleRecord(ProSubscription, {
      where: { id },
      relations: ["user"],
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    await updateRecords(ProSubscription, { id }, { status }, false);

    // TODO: Log admin action for audit trail
    console.log(
      `Admin updated subscription ${id} status to ${status}. Reason: ${reason}`,
    );

    const updatedSubscription = await getSingleRecord(ProSubscription, {
      where: { id },
      relations: ["user"],
    });

    return res.status(200).json({
      success: true,
      message: "Subscription status updated successfully",
      subscription: updatedSubscription,
    });
  } catch (error) {
    console.error("Error updating subscription status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update subscription status",
    });
  }
});

// Get specific subscription details
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const subscription = await getSingleRecord(ProSubscription, {
      where: { id },
      relations: ["user"],
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    // Get plan details
    const plan = await getSingleRecord(ProPlan, {
      where: { id: subscription.plan_id },
    });

    return res.status(200).json({
      success: true,
      subscription: {
        ...subscription,
        plan,
      },
    });
  } catch (error) {
    console.error("Error fetching subscription details:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription details",
    });
  }
});

export default router;
