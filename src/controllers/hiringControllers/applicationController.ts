import { Request, Response } from "express";
import { JobApplication } from "../../db/mysqlModels/JobApplication";
import { getSingleRecord } from "../../lib/dbLib/sqlUtils";

// Get application by identifier - useful for anonymous users to check their application status
export const getApplicationByIdentifier = async (
  req: Request,
  res: Response,
) => {
  try {
    const { identifier } = req.params;

    if (!identifier) {
      return res.status(400).json({
        message: "Application identifier is required",
        success: false,
      });
    }

    const application = await getSingleRecord(JobApplication, {
      where: { applicationIdentifier: identifier },
      relations: ["job", "job.organization"],
    });

    if (!application) {
      return res.status(404).json({
        message: "Application not found",
        details: "No application found with the provided identifier.",
        success: false,
      });
    }

    return res.status(200).json({
      message: "Application fetched successfully",
      application,
      success: true,
    });
  } catch (error) {
    console.error("Error fetching application:", error);
    return res.status(500).json({
      message: "Internal server error",
      details: "An unexpected error occurred while retrieving the application.",
      success: false,
    });
  }
};
