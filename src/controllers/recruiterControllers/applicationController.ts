import { Request, Response } from "express";
import { JobApplication } from "../../db/mysqlModels/JobApplication";
import { getAllRecordsWithFilter } from "../../lib/dbLib/sqlUtils";

// Get all applications for recruiter’s jobs
export const getApplications = async (req: Request, res: Response) => {
  try {
    const applications = await getAllRecordsWithFilter(
      JobApplication,
      {
        relations: ["job", "user"],
        order: { appliedAt: "DESC" },
      },
      "recruiter:applications",
      true,
      10 * 60,
    );
    return res.status(200).json({
      success: true,
      applications,
    });
  } catch (error) {
    console.error("Error fetching applications:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
