import { Request, Response } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { User } from "../../db/mysqlModels/User";
import { ProPlan } from "../../db/mysqlModels/ProPlan";
import {
  ProSubscription,
  ProSubscriptionStatus,
  ProPlanType,
} from "../../db/mysqlModels/ProSubscription";
import { ProSubscriptionService } from "../../utils/proSubscriptionService";
import { validate } from "class-validator";
import {
  getSingleRecord,
  getAllRecordsWithFilter,
  updateRecords,
  createRecord,
} from "../../lib/dbLib/sqlUtils";
import { config } from "../../config";

const razorpay = new Razorpay({
  key_id: config.RAZORPAY_KEY_ID,
  key_secret: config.RAZORPAY_KEY_SECRET,
});

// Get available pro plans for students
export const getAvailablePlans = async (req: Request, res: Response) => {
  try {
    const plans = await getAllRecordsWithFilter(ProPlan, {
      where: { is_active: true },
      order: { price: "ASC" },
    });

    return res.status(200).json({
      success: true,
      plans,
    });
  } catch (error) {
    console.error("Error fetching pro plans:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pro plans",
    });
  }
};

// Create Razorpay order for subscription
export const createSubscriptionOrder = async (req: Request, res: Response) => {
  try {
    // Ensure Razorpay is configured
    if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({
        success: false,
        message:
          "Razorpay credentials not configured on server. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
      });
    }

    const { plan_id } = req.body;
    const user = req.user as User;

    if (!plan_id) {
      return res.status(400).json({
        success: false,
        message: "Plan ID is required",
      });
    }

    // Get the plan details
    const plan = await getSingleRecord(ProPlan, {
      where: { id: plan_id, is_active: true },
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found or inactive",
      });
    }

    // Check if user already has an active subscription
    const existingSubscription = await getSingleRecord(ProSubscription, {
      where: {
        user_id: user.id,
        status: ProSubscriptionStatus.ACTIVE,
      },
    });

    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: "User already has an active subscription",
        subscription: existingSubscription,
      });
    }

    // Create Razorpay order
    const receipt = `sub_${plan.id.slice(0, 8)}_${Date.now()}`.slice(0, 40);
    const options = {
      amount: Math.round(plan.price * 100), // Convert to paise
      currency: plan.currency,
      receipt,
      notes: {
        plan_id: plan.id,
        user_id: user.id,
        plan_name: plan.name,
      },
    };

    const order = await razorpay.orders.create(options);

    // Create pending subscription record
    const subscription = new ProSubscription();
    subscription.user_id = user.id;
    subscription.plan_id = plan.id;
    subscription.plan_type =
      plan.duration_months === 1
        ? ProPlanType.PRO_MONTHLY
        : ProPlanType.PRO_YEARLY;
    subscription.status = ProSubscriptionStatus.PENDING;
    subscription.amount = plan.price;
    subscription.currency = plan.currency;
    subscription.razorpay_order_id = order.id;

    const errors = await validate(subscription);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    await createRecord(ProSubscription, subscription);

    return res.status(200).json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      key: config.RAZORPAY_KEY_ID,
      plan,
    });
  } catch (error) {
    console.error("Error creating subscription order:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create subscription order",
    });
  }
};

// Verify payment and activate subscription
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    // Ensure Razorpay is configured
    if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({
        success: false,
        message:
          "Razorpay credentials not configured on server. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
      });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan_id,
    } = req.body;
    const user = req.user as User;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !plan_id
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing payment verification details",
      });
    }

    // Verify signature
    const generated_signature = crypto
      .createHmac("sha256", config.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    // Find the pending subscription
    const subscription = await getSingleRecord(ProSubscription, {
      where: {
        user_id: user.id,
        razorpay_order_id,
        status: ProSubscriptionStatus.PENDING,
      },
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    // Get plan details for subscription duration
    const plan = await getSingleRecord(ProPlan, {
      where: { id: plan_id },
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    // Calculate subscription dates
    const now = new Date();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + plan.duration_months);

    // Update subscription with payment details
    await updateRecords(
      ProSubscription,
      { id: subscription.id },
      {
        status: ProSubscriptionStatus.ACTIVE,
        razorpay_payment_id,
        razorpay_signature,
        starts_at: now,
        expires_at: expiryDate,
      },
      false,
    );

    // Cancel any other active subscriptions for this user
    await updateRecords(
      ProSubscription,
      {
        user_id: user.id,
        status: ProSubscriptionStatus.ACTIVE,
        id: { $ne: subscription.id } as any,
      },
      { status: ProSubscriptionStatus.CANCELED },
      true,
    );

    // Update user's Pro status
    await ProSubscriptionService.updateUserProStatus(user.id);

    const updatedSubscription = await getSingleRecord(ProSubscription, {
      where: { id: subscription.id },
    });

    return res.status(200).json({
      success: true,
      message: "Payment verified and subscription activated",
      subscription: updatedSubscription,
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify payment",
    });
  }
};

// Get current subscription status
export const getCurrentSubscription = async (req: Request, res: Response) => {
  try {
    const user = req.user as User;

    // Use the ProSubscriptionService to get detailed Pro information
    const proDetails = await ProSubscriptionService.getUserProDetails(user.id);

    return res.status(200).json({
      success: true,
      proDetails,
      // Legacy compatibility
      subscription: proDetails.currentSubscription,
    });
  } catch (error) {
    console.error("Error fetching current subscription:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription",
    });
  }
};

// Cancel subscription
export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    const { subscription_id } = req.params;
    const user = req.user as User;

    const subscription = await getSingleRecord(ProSubscription, {
      where: {
        id: subscription_id,
        user_id: user.id,
        status: ProSubscriptionStatus.ACTIVE,
      },
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Active subscription not found",
      });
    }

    await updateRecords(
      ProSubscription,
      { id: subscription_id },
      {
        status: ProSubscriptionStatus.CANCELED,
        auto_renew: false,
      },
      false,
    );

    // TODO: Implement refund logic if needed
    // const refundAmount = calculateRefund(subscription);
    // if (refundAmount > 0) {
    //   await processRefund(subscription.razorpay_payment_id, refundAmount);
    // }

    // Update user's Pro status after cancellation
    await ProSubscriptionService.updateUserProStatus(user.id);

    return res.status(200).json({
      success: true,
      message: "Subscription canceled successfully",
    });
  } catch (error) {
    console.error("Error canceling subscription:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel subscription",
    });
  }
};

// Get subscription history
export const getSubscriptionHistory = async (req: Request, res: Response) => {
  try {
    const user = req.user as User;

    const subscriptions = await getAllRecordsWithFilter(ProSubscription, {
      where: { user_id: user.id },
      order: { created_at: "DESC" },
      relations: ["user"],
    });

    return res.status(200).json({
      success: true,
      subscriptions,
    });
  } catch (error) {
    console.error("Error fetching subscription history:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription history",
    });
  }
};

// Check if user has active pro subscription (for middleware)
export const checkProSubscriptionStatus = async (
  userId: string,
): Promise<boolean> => {
  try {
    const subscription = await getSingleRecord(ProSubscription, {
      where: {
        user_id: userId,
        status: ProSubscriptionStatus.ACTIVE,
      },
    });

    // Check if subscription has expired
    if (
      subscription &&
      subscription.expires_at &&
      new Date() > subscription.expires_at
    ) {
      await updateRecords(
        ProSubscription,
        { id: subscription.id },
        { status: ProSubscriptionStatus.EXPIRED },
        false,
      );
      return false;
    }

    return !!subscription;
  } catch (error) {
    console.error("Error checking pro subscription status:", error);
    return false;
  }
};
