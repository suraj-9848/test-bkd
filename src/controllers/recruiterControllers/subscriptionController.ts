import { Request, Response } from "express";
import { User } from "../../db/mysqlModels/User";
import {
  Subscription,
  SubscriptionStatus,
  SubscriptionPlan,
} from "../../db/mysqlModels/Subscription";
import { validate } from "class-validator";
import {
  getSingleRecord,
  getAllRecordsWithFilter,
  updateRecords,
  deleteRecords,
  createRecord,
} from "../../lib/dbLib/sqlUtils";

// Create a new subscription
export const createSubscription = async (req: Request, res: Response) => {
  try {
    const { user_id, plan } = req.body;
    // Validate plan value
    if (!Object.values(SubscriptionPlan).includes(plan)) {
      return res.status(400).json({
        success: false,
        message: `Invalid plan. Valid plans: ${Object.values(SubscriptionPlan).join(", ")}`,
      });
    }
    if (!user_id || !plan) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: user_id and plan are required",
      });
    }
    const user = await getSingleRecord(User, { where: { id: user_id } });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    const existingSubscription = await Subscription.findOne({
      where: { user_id, status: SubscriptionStatus.ACTIVE },
    });
    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: "User already has an active subscription",
        subscription: existingSubscription,
      });
    }
    const subscription = new Subscription();
    subscription.user_id = user_id;
    subscription.plan = plan;
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.amount = 999; // INR 999 as specified
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1);
    subscription.expiresAt = expiryDate;
    const errors = await validate(subscription);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }
    const createdSubscription = await createRecord(Subscription, subscription);
    return res.status(201).json({
      success: true,
      message: "Subscription created successfully",
      subscription: createdSubscription,
    });
  } catch (error) {
    console.error("Error creating subscription:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get all subscriptions for recruiter
export const getSubscriptions = async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const subscriptions = await getAllRecordsWithFilter(Subscription, {
      where: { user_id: user.id },
      relations: ["user"],
    });
    return res.status(200).json({ success: true, subscriptions });
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update subscription status
export const updateSubscription = async (req: Request, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const { status } = req.body;
    if (!status || !Object.values(SubscriptionStatus).includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: active, canceled, expired",
      });
    }
    const subscription = await getSingleRecord(Subscription, {
      where: { id: subscriptionId },
    });
    if (!subscription) {
      return res
        .status(404)
        .json({ success: false, message: "Subscription not found" });
    }
    const user = req.user as User;
    if (subscription.user_id !== user.id) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    await updateRecords(
      Subscription,
      { id: subscriptionId },
      { status },
      false,
    );
    const updated = await getSingleRecord(Subscription, {
      where: { id: subscriptionId },
    });
    return res.status(200).json({
      success: true,
      message: "Subscription updated successfully",
      subscription: updated,
    });
  } catch (error) {
    console.error("Error updating subscription:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Delete subscription
export const deleteSubscription = async (req: Request, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const subscription = await getSingleRecord(Subscription, {
      where: { id: subscriptionId },
    });
    if (!subscription) {
      return res
        .status(404)
        .json({ success: false, message: "Subscription not found" });
    }
    const user = req.user as User;
    if (subscription.user_id !== user.id) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    await deleteRecords(Subscription, { id: subscriptionId });
    return res.status(200).json({
      success: true,
      message: "Subscription deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting subscription:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
