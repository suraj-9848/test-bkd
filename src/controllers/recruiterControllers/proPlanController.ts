import { Request, Response } from "express";
import { User } from "../../db/mysqlModels/User";
import { ProPlan } from "../../db/mysqlModels/ProPlan";
import {
  ProSubscription,
  ProSubscriptionStatus,
} from "../../db/mysqlModels/ProSubscription";
import { validate } from "class-validator";
import {
  getSingleRecord,
  getAllRecordsWithFilter,
  updateRecords,
  deleteRecords,
  createRecord,
  getAggregatedData,
} from "../../lib/dbLib/sqlUtils";

// Create new pro plan
export const createProPlan = async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      price,
      currency = "INR",
      duration_months,
      features,
    } = req.body;
    const user = req.user as User;

    if (!name || !price || !duration_months) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: name, price, and duration_months are required",
      });
    }

    if (price <= 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be greater than 0",
      });
    }

    if (duration_months <= 0) {
      return res.status(400).json({
        success: false,
        message: "Duration must be greater than 0 months",
      });
    }

    // Check if plan with same name already exists
    const existingPlan = await getSingleRecord(ProPlan, {
      where: { name },
    });

    if (existingPlan) {
      return res.status(400).json({
        success: false,
        message: "Plan with this name already exists",
      });
    }

    const plan = new ProPlan();
    plan.name = name;
    plan.description = description;
    plan.price = price;
    plan.currency = currency;
    plan.duration_months = duration_months;
    plan.features = features || [];
    plan.created_by = user.id;

    const errors = await validate(plan);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const createdPlan = await createRecord(ProPlan, plan);

    return res.status(201).json({
      success: true,
      message: "Pro plan created successfully",
      plan: createdPlan,
    });
  } catch (error) {
    console.error("Error creating pro plan:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create pro plan",
    });
  }
};

// Get all pro plans for recruiter
export const getProPlans = async (req: Request, res: Response) => {
  try {
    const { active_only } = req.query;
    const whereConditions: any = {};

    if (active_only === "true") {
      whereConditions.is_active = true;
    }

    const plans = await getAllRecordsWithFilter(ProPlan, {
      where: whereConditions,
      order: { created_at: "DESC" },
      relations: ["creator"],
    });

    // Get subscription counts for each plan
    const plansWithStats = await Promise.all(
      plans.map(async (plan) => {
        const subscriptionCount = await ProSubscription.count({
          where: { plan_id: plan.id },
        });

        const activeSubscriptionCount = await ProSubscription.count({
          where: {
            plan_id: plan.id,
            status: ProSubscriptionStatus.ACTIVE,
          },
        });

        return {
          ...plan,
          subscription_count: subscriptionCount,
          active_subscription_count: activeSubscriptionCount,
        };
      }),
    );

    return res.status(200).json({
      success: true,
      plans: plansWithStats,
    });
  } catch (error) {
    console.error("Error fetching pro plans:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pro plans",
    });
  }
};

// Get specific pro plan
export const getProPlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const plan = await getSingleRecord(ProPlan, {
      where: { id },
      relations: ["creator"],
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Pro plan not found",
      });
    }

    // Get subscription statistics
    const subscriptionCount = await ProSubscription.count({
      where: { plan_id: plan.id },
    });

    const activeSubscriptionCount = await ProSubscription.count({
      where: {
        plan_id: plan.id,
        status: ProSubscriptionStatus.ACTIVE,
      },
    });

    const totalRevenueResult = await getAggregatedData(
      ProSubscription,
      {
        select: ["SUM(subscription.amount) as total"],
        where: {
          plan_id: plan.id,
          status: "active",
        },
      },
      `pro_plan:${plan.id}:total_revenue`,
      true,
      30 * 60, // Cache for 30 minutes
    );

    const totalRevenue = totalRevenueResult[0] || { total: 0 };

    return res.status(200).json({
      success: true,
      plan: {
        ...plan,
        subscription_count: subscriptionCount,
        active_subscription_count: activeSubscriptionCount,
        total_revenue: totalRevenue?.total || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching pro plan:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pro plan",
    });
  }
};

// Update pro plan
export const updateProPlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, price, currency, duration_months, features } =
      req.body;

    const plan = await getSingleRecord(ProPlan, {
      where: { id },
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Pro plan not found",
      });
    }

    // Validate price if provided
    if (price !== undefined && price <= 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be greater than 0",
      });
    }

    // Validate duration if provided
    if (duration_months !== undefined && duration_months <= 0) {
      return res.status(400).json({
        success: false,
        message: "Duration must be greater than 0 months",
      });
    }

    // Check if name is being changed and if it conflicts
    if (name && name !== plan.name) {
      const existingPlan = await getSingleRecord(ProPlan, {
        where: { name },
      });

      if (existingPlan && existingPlan.id !== id) {
        return res.status(400).json({
          success: false,
          message: "Plan with this name already exists",
        });
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (currency !== undefined) updateData.currency = currency;
    if (duration_months !== undefined)
      updateData.duration_months = duration_months;
    if (features !== undefined) updateData.features = features;

    await updateRecords(ProPlan, { id }, updateData, false);

    const updatedPlan = await getSingleRecord(ProPlan, {
      where: { id },
      relations: ["creator"],
    });

    return res.status(200).json({
      success: true,
      message: "Pro plan updated successfully",
      plan: updatedPlan,
    });
  } catch (error) {
    console.error("Error updating pro plan:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update pro plan",
    });
  }
};

// Toggle plan active status
export const togglePlanStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const plan = await getSingleRecord(ProPlan, {
      where: { id },
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Pro plan not found",
      });
    }

    await updateRecords(
      ProPlan,
      { id },
      { is_active: is_active !== undefined ? is_active : !plan.is_active },
      false,
    );

    const updatedPlan = await getSingleRecord(ProPlan, {
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: `Pro plan ${updatedPlan?.is_active ? "activated" : "deactivated"} successfully`,
      plan: updatedPlan,
    });
  } catch (error) {
    console.error("Error toggling plan status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update plan status",
    });
  }
};

// Delete pro plan
export const deleteProPlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const plan = await getSingleRecord(ProPlan, {
      where: { id },
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Pro plan not found",
      });
    }

    // Check if plan has active subscriptions
    const activeSubscriptions = await ProSubscription.count({
      where: {
        plan_id: id,
        status: ProSubscriptionStatus.ACTIVE,
      },
    });

    if (activeSubscriptions > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete plan with active subscriptions. Please deactivate the plan instead.",
        active_subscriptions: activeSubscriptions,
      });
    }

    await deleteRecords(ProPlan, { id });

    return res.status(200).json({
      success: true,
      message: "Pro plan deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting pro plan:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete pro plan",
    });
  }
};

// Get plan analytics for recruiter
export const getProPlanAnalytics = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { period = "30d" } = req.query;

    const plan = await getSingleRecord(ProPlan, {
      where: { id },
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Pro plan not found",
      });
    }

    // Calculate date range based on period
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

    // Get subscription analytics
    const subscriptionStatsResult = await getAggregatedData(
      ProSubscription,
      {
        select: [
          "COUNT(*) as total_subscriptions",
          "COUNT(CASE WHEN status = 'active' THEN 1 END) as active_subscriptions",
          "COUNT(CASE WHEN status = 'canceled' THEN 1 END) as canceled_subscriptions",
          "COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_subscriptions",
          "SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END) as total_revenue",
          "AVG(CASE WHEN status = 'active' THEN amount ELSE NULL END) as avg_revenue",
        ],
        where: `subscription.plan_id = :planId AND subscription.created_at >= :startDate AND subscription.created_at <= :endDate`,
        whereParams: { planId: id, startDate, endDate },
      },
      `pro_plan:${id}:analytics:${period}`,
      true,
      15 * 60, // Cache for 15 minutes
    );

    const subscriptionStats = subscriptionStatsResult[0] || {
      total_subscriptions: 0,
      active_subscriptions: 0,
      canceled_subscriptions: 0,
      expired_subscriptions: 0,
      total_revenue: 0,
      avg_revenue: 0,
    };

    // Get daily subscription counts for chart data
    const dailyStats = await ProSubscription.createQueryBuilder("subscription")
      .select([
        "DATE(subscription.created_at) as date",
        "COUNT(*) as count",
        "SUM(subscription.amount) as revenue",
      ])
      .where("subscription.plan_id = :planId", { planId: id })
      .andWhere("subscription.created_at >= :startDate", { startDate })
      .andWhere("subscription.created_at <= :endDate", { endDate })
      .groupBy("DATE(subscription.created_at)")
      .orderBy("date", "ASC")
      .getRawMany();

    return res.status(200).json({
      success: true,
      analytics: {
        plan,
        period,
        summary: subscriptionStats,
        daily_data: dailyStats,
      },
    });
  } catch (error) {
    console.error("Error fetching pro plan analytics:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch plan analytics",
    });
  }
};
