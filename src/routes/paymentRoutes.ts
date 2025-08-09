// Razorpay backend integration for course purchase
// Place this file in nirudhyog-backend/src/routes/paymentRoutes.ts

import { Router } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { User } from "../db/mysqlModels/User";
import { Course } from "../db/mysqlModels/Course";
import { Enrollment } from "../db/mysqlModels/enrollment";
import { UserCourse } from "../db/mysqlModels/UserCourse";
import { config } from "../config";
const router = Router();

const razorpay = new Razorpay({
  key_id: config.RAZORPAY_KEY_ID,
  key_secret: config.RAZORPAY_KEY_SECRET,
});

// Create Razorpay order
router.post("/create-order", async (req, res) => {
  try {
    const { amount, currency = "INR", courseId } = req.body;
    if (!amount || !courseId)
      return res.status(400).json({ error: "Missing amount or courseId" });

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: "Razorpay credentials not set" });
    }

    // Ensure receipt is <= 40 characters
    const shortCourseId = String(courseId).slice(0, 10);
    const receiptRaw = `rcpt_${shortCourseId}_${Date.now()}`;
    const receipt = receiptRaw.slice(0, 40);
    const options = {
      amount: Math.round(amount * 100), // Razorpay expects paise
      currency,
      receipt,
    };
    const order = await razorpay.orders.create(options);
    res.json({ order });
  } catch (err) {
    console.error("Error creating Razorpay order:", err);
    res.status(500).json({
      error: "Failed to create order",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// Verify payment and store transaction
router.post("/verify", async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    courseId,
    userId,
  } = req.body;

  console.log("/verify called with body:", req.body);
  if (
    !razorpay_order_id ||
    !razorpay_payment_id ||
    !razorpay_signature ||
    !courseId ||
    !userId
  ) {
    console.warn("Missing payment details", req.body);
    return res.status(400).json({ error: "Missing payment details" });
  }

  // Verify signature
  const generated_signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");
  if (generated_signature !== razorpay_signature) {
    console.warn("Invalid signature", {
      generated_signature,
      razorpay_signature,
    });
    return res.status(400).json({ error: "Invalid signature" });
  }

  try {
    // Find user and course using TypeORM findOne
    const user = await User.findOne({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const course = await Course.findOne({ where: { id: courseId } });
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Check if user already enrolled in this course (idempotency)
    const existingUserCourse = await UserCourse.findOne({
      where: {
        user: { id: user.id },
        course: { id: course.id },
      },
    });
    if (existingUserCourse) {
      // Enrollment already exists, check for Enrollment record
      const existingEnrollment = await Enrollment.findOne({
        where: {
          user: { id: user.id },
          course: { id: course.id },
          userCourse: { id: existingUserCourse.id },
        },
      });
      if (existingEnrollment) {
        return res
          .status(400)
          .json({ error: "Already enrolled in this course" });
      }
    }

    // Create UserCourse if not exists
    let userCourse: UserCourse;
    if (!existingUserCourse) {
      userCourse = await UserCourse.create({
        user: { id: user.id },
        course: { id: course.id },
      });
      await userCourse.save();
    } else {
      userCourse = existingUserCourse;
    }

    // Create Enrollment
    const enrollment = await Enrollment.create({
      user: { id: user.id },
      course: { id: course.id },
      userCourse: { id: userCourse.id },
      razorpay_payment_id,
      razorpay_order_id,
      status: "active",
      completed: false,
    });
    await enrollment.save();

    console.log("Payment verified and enrollment created", {
      userId,
      courseId,
      razorpay_order_id,
      razorpay_payment_id,
    });
    return res.json({ success: true });
  } catch (err) {
    console.error("Payment verification failed", err);
    return res.status(500).json({
      error: "Payment verification failed",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
