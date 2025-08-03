import { Request, Response } from "express";
import { Job, JobStatus } from "../../db/mysqlModels/Job";
import { JobApplication } from "../../db/mysqlModels/JobApplication";

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
    return res.status(200).json({
      message: "Recruiter dashboard data",
      data: { totalJobs, openJobs, closedJobs, totalApplications },
      success: true,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
