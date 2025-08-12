import { Request, Response } from "express";
import { Job, JobStatus } from "../../db/mysqlModels/Job";
import { JobApplication } from "../../db/mysqlModels/JobApplication";
import {
  countProApplicantsBetween,
  countShortlistedBetween,
  getAvgReviewTimeHours,
  countNewProUsersSince,
} from "../../utils/recruiterAnalytics";

// Get recruiter dashboard analytics
export const getDashboardData = async (req: Request, res: Response) => {
  try {
    // All recruiters see global stats now (org_id removed)
    const totalJobs = await Job.count();
    const openJobs = await Job.count({ where: { status: JobStatus.OPEN } });
    const closedJobs = await Job.count({
      where: { status: JobStatus.CLOSED },
    });
    const totalApplications = await JobApplication.count();

    // Candidate insights
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    // Pro applicants in last 7 days
    const proApplicants7d = await countProApplicantsBetween(sevenDaysAgo, now);

    // Shortlisted in last 7 days
    const shortlisted7d = await countShortlistedBetween(sevenDaysAgo, now);

    // Avg time to review (hours) for applications moved beyond APPLIED
    const avgTimeToReviewHours = await getAvgReviewTimeHours();

    // New Pro users in last 7 days (becameProAt within 7 days)
    const proUsers7d = await countNewProUsersSince(sevenDaysAgo);

    return res.status(200).json({
      message: "Recruiter dashboard data",
      data: {
        totalJobs,
        openJobs,
        closedJobs,
        totalApplications,
        insights: {
          proApplicants7d,
          shortlisted7d,
          avgTimeToReviewHours,
          proUsers7d,
        },
      },
      success: true,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
