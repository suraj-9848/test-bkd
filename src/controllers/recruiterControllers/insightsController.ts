import { Request, Response } from "express";
import {
  JobApplication,
  ApplicationStatus,
} from "../../db/mysqlModels/JobApplication";
import { User } from "../../db/mysqlModels/User";
import { Between } from "typeorm";

// GET /api/recruiter/candidate-insights
// Returns: { proApplicants7d, shortlisted7d, avgTimeToReviewHours }
export const getCandidateInsights = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    // Count Pro applicants in last 7 days: joined applications where user is pro by flag or future expiry
    const proApplicants7d = await JobApplication.createQueryBuilder("app")
      .leftJoin(User, "user", "user.id = app.user_id")
      .where("app.appliedAt BETWEEN :start AND :end", {
        start: sevenDaysAgo,
        end: now,
      })
      .andWhere(
        "(user.isProUser = :isPro OR (user.proExpiresAt IS NOT NULL AND user.proExpiresAt > NOW()))",
        { isPro: true },
      )
      .getCount();

    // Shortlisted in last 7 days (based on updatedAt to capture status change)
    const shortlisted7d = await JobApplication.count({
      where: {
        status: ApplicationStatus.SHORTLISTED,
        updatedAt: Between(sevenDaysAgo, now),
      },
    });

    // Avg time to review: applications moved beyond APPLIED; average difference (hours) between appliedAt and updatedAt
    const rawAvg = await JobApplication.createQueryBuilder("app")
      .select(
        "AVG(TIMESTAMPDIFF(HOUR, app.appliedAt, app.updatedAt))",
        "avgHours",
      )
      .where("app.status != :applied", { applied: ApplicationStatus.APPLIED })
      .andWhere("app.updatedAt IS NOT NULL")
      .getRawOne<{ avgHours: string | number | null }>();

    const avgTimeToReviewHours = rawAvg?.avgHours
      ? Math.round(Number(rawAvg.avgHours))
      : null;

    return res.status(200).json({
      success: true,
      data: {
        proApplicants7d,
        shortlisted7d,
        avgTimeToReviewHours,
      },
    });
  } catch (error) {
    console.error("Error fetching candidate insights:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
