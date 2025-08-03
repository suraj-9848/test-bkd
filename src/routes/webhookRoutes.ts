import { Router } from "express";
import { Request, Response } from "express";
import crypto from "crypto";
import {
  ProSubscription,
  ProSubscriptionStatus,
} from "../db/mysqlModels/ProSubscription";
import { ProPlan } from "../db/mysqlModels/ProPlan";
import { getSingleRecord, updateRecords } from "../lib/dbLib/sqlUtils";
import { config } from "../config";

const router = Router();

// Razorpay webhook handler for payment events
router.post("/razorpay", async (req: Request, res: Response) => {
  try {
    const webhookSignature = req.headers["x-razorpay-signature"] as string;
    const webhookBody = JSON.stringify(req.body);

    // Verify webhook signature
    if (!verifyWebhookSignature(webhookBody, webhookSignature)) {
      console.error("Invalid webhook signature");
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    const { event, payload } = req.body;

    switch (event) {
      case "payment.captured":
        await handlePaymentCaptured(payload.payment.entity);
        break;

      case "payment.failed":
        await handlePaymentFailed(payload.payment.entity);
        break;

      case "subscription.charged":
        await handleSubscriptionCharged(
          payload.subscription.entity,
          payload.payment.entity,
        );
        break;

      case "subscription.cancelled":
        await handleSubscriptionCancelled(payload.subscription.entity);
        break;

      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process webhook",
    });
  }
});

// Verify webhook signature
function verifyWebhookSignature(body: string, signature: string): boolean {
  try {
    const expectedSignature = crypto
      .createHmac(
        "sha256",
        config.RAZORPAY_WEBHOOK_SECRET || config.RAZORPAY_KEY_SECRET,
      )
      .update(body)
      .digest("hex");

    return expectedSignature === signature;
  } catch (error) {
    console.error("Error verifying webhook signature:", error);
    return false;
  }
}

// Handle payment captured event
async function handlePaymentCaptured(payment: any) {
  try {
    const { id: paymentId, order_id: orderId, status } = payment;

    if (status !== "captured") {
      return;
    }

    // Find subscription by order ID
    const subscription = await getSingleRecord(ProSubscription, {
      where: {
        razorpay_order_id: orderId,
        status: ProSubscriptionStatus.PENDING,
      },
    });

    if (!subscription) {
      console.error(`Subscription not found for order ID: ${orderId}`);
      return;
    }

    // Get plan details for subscription duration
    const plan = await getSingleRecord(ProPlan, {
      where: { id: subscription.plan_id },
    });

    if (!plan) {
      console.error(`Plan not found for subscription: ${subscription.id}`);
      return;
    }

    // Calculate subscription dates
    const now = new Date();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + plan.duration_months);

    // Update subscription status
    await updateRecords(
      ProSubscription,
      { id: subscription.id },
      {
        status: ProSubscriptionStatus.ACTIVE,
        razorpay_payment_id: paymentId,
        starts_at: now,
        expires_at: expiryDate,
      },
      false,
    );

    console.log(`Subscription ${subscription.id} activated via webhook`);
  } catch (error) {
    console.error("Error handling payment captured:", error);
  }
}

// Handle payment failed event
async function handlePaymentFailed(payment: any) {
  try {
    const { order_id: orderId, error_reason } = payment;

    // Find subscription by order ID and mark as failed
    const subscription = await getSingleRecord(ProSubscription, {
      where: {
        razorpay_order_id: orderId,
        status: ProSubscriptionStatus.PENDING,
      },
    });

    if (subscription) {
      // You might want to create a separate status for failed payments
      // or keep as pending for retry
      console.log(
        `Payment failed for subscription ${subscription.id}: ${error_reason}`,
      );

      // Optionally update subscription with failure reason
      // await updateRecords(
      //   ProSubscription,
      //   { id: subscription.id },
      //   { status: ProSubscriptionStatus.FAILED, failure_reason: error_reason },
      //   false
      // );
    }
  } catch (error) {
    console.error("Error handling payment failed:", error);
  }
}

// Handle subscription charged event (for auto-renewals)
async function handleSubscriptionCharged(subscription: any, payment: any) {
  try {
    console.log("Subscription charged event:", { subscription, payment });
    // Handle auto-renewal charges here if implementing recurring subscriptions
  } catch (error) {
    console.error("Error handling subscription charged:", error);
  }
}

// Handle subscription cancelled event
async function handleSubscriptionCancelled(subscription: any) {
  try {
    console.log("Subscription cancelled event:", subscription);
    // Handle subscription cancellation via Razorpay dashboard
  } catch (error) {
    console.error("Error handling subscription cancelled:", error);
  }
}

export default router;
