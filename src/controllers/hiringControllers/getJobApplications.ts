import { Request, Response } from "express";
import { Job } from "../../db/mysqlModels/Job";
import { JobApplication } from "../../db/mysqlModels/JobApplication";
import {
  getSingleRecord,
  getAllRecordsWithFilter,
} from "../../lib/dbLib/sqlUtils";

// Get all applications for a specific job
export const getJobApplications = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        message: "Job ID is required",
        details: "Please provide a valid job ID to get applications",
        success: false,
      });
    }

    // First verify the job exists
    const job = await getSingleRecord(Job, { where: { id: jobId } });
    if (!job) {
      return res.status(404).json({
        message: "Job not found",
        details: "The specified job does not exist",
        success: false,
      });
    }

    // Get all applications for this job
    const applications = await getAllRecordsWithFilter(JobApplication, {
      where: { job_id: jobId },
      relations: ["user"],
    });

    return res.status(200).json({
      message: "Applications retrieved successfully",
      applications: applications.map((app) => ({
        id: app.id,
        status: app.status,
        appliedAt: app.appliedAt,
        updatedAt: app.updatedAt,
        resumePath: app.resumePath,
        user: {
          id: app.user.id,
          username: app.user.username,
          email: app.user.email,
        },
      })),
      count: applications.length,
      success: true,
    });
  } catch (error) {
    console.error("Error retrieving job applications:", error);
    return res.status(500).json({
      message: "Failed to retrieve job applications",
      details: error instanceof Error ? error.message : "Unknown error",
      success: false,
    });
  }
};
