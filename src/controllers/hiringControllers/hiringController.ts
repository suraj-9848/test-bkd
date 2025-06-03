import { Request, Response } from "express";
import { Job, JobStatus } from "../../db/mysqlModels/Job";
import {
  JobApplication,
  ApplicationStatus,
} from "../../db/mysqlModels/JobApplication";
import { Org } from "../../db/mysqlModels/Org";
import {
  createRecord,
  getSingleRecord,
  getAllRecords,
  updateRecords,
  deleteRecords,
  getAllRecordsWithFilter,
} from "../../lib/dbLib/sqlUtils";
import { User } from "../../db/mysqlModels/User";
import s3Service from "../../utils/s3Service";

// ==================== ADMIN CONTROLLERS ====================

// Create a new job
export const createJob = async (req: Request, res: Response) => {
  try {
    const {
      title,
      companyName,
      description,
      skills,
      eligibleBranches,
      org_id,
      location, // New field here
    } = req.body;

    // Basic required fields validation
    if (!org_id) {
      return res.status(400).json({
        message: "Organization ID is required",
        details: "Please provide a valid organization ID for the job posting",
        success: false,
      });
    }
    if (!title || !description) {
      return res.status(400).json({
        message: "Title and description are required",
        success: false,
      });
    }
    if (!location) {
      return res.status(400).json({
        message: "Location is required",
        success: false,
      });
    }

    // Validate organization exists
    try {
      const organization = await getSingleRecord(Org, {
        where: { id: org_id },
      });
      if (!organization) {
        return res.status(404).json({
          message: "Organization not found",
          details: "Please provide a valid organization ID",
          success: false,
        });
      }
    } catch (orgError) {
      console.error("Error validating organization:", orgError);
      return res.status(500).json({
        message: "Error validating organization",
        details:
          "There was an error verifying the organization. Please try again.",
        success: false,
      });
    }

    // Ensure skills and eligibleBranches are arrays
    const skillsArray = Array.isArray(skills) ? skills : skills ? [skills] : [];
    const branchesArray = Array.isArray(eligibleBranches)
      ? eligibleBranches
      : eligibleBranches
        ? [eligibleBranches]
        : [];

    // Create new job with location included
    const job = Job.create({
      title,
      companyName,
      description,
      skills: skillsArray,
      eligibleBranches: branchesArray,
      status: JobStatus.OPEN,
      org_id,
      location, // Include location here
    });

    await job.save();

    // Fetch job with organization details
    const createdJob = await getSingleRecord(Job, {
      where: { id: job.id },
      relations: ["organization"],
    });

    return res.status(201).json({
      message: "Job created successfully",
      job: createdJob,
      success: true,
    });
  } catch (error) {
    console.error("Error creating job:", error);
    return res.status(500).json({
      message: "Internal server error",
      details: "Failed to create job. Please try again later.",
      success: false,
    });
  }
};

// Update an existing job
export const updateJob = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const {
      title,
      companyName,
      description,
      skills,
      eligibleBranches,
      status,
      location, // ✅ included here
    } = req.body;

    if (!jobId) {
      return res.status(400).json({
        message: "Job ID is required",
        success: false,
      });
    }

    try {
      // Find the job
      const job = await getSingleRecord(Job, { where: { id: jobId } });
      if (!job) {
        return res.status(404).json({
          message: "Job not found",
          details:
            "The job you're trying to update doesn't exist or has been removed.",
          success: false,
        });
      }

      // Validate status if provided
      if (status && !Object.values(JobStatus).includes(status as JobStatus)) {
        return res.status(400).json({
          message: "Invalid job status",
          details: `Valid status values are: ${Object.values(JobStatus).join(", ")}`,
          success: false,
        });
      }

      // Update job fields
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (companyName !== undefined) updateData.companyName = companyName;
      if (description !== undefined) updateData.description = description;
      if (location !== undefined) updateData.location = location; // ✅ new line
      if (skills !== undefined)
        updateData.skills = Array.isArray(skills) ? skills : [skills];
      if (eligibleBranches !== undefined)
        updateData.eligibleBranches = Array.isArray(eligibleBranches)
          ? eligibleBranches
          : [eligibleBranches];
      if (
        status !== undefined &&
        Object.values(JobStatus).includes(status as JobStatus)
      )
        updateData.status = status;

      // If closing a job with active applications, add additional validation
      if (status === JobStatus.CLOSED || status === JobStatus.COMPLETED) {
        const applications = await getAllRecordsWithFilter(JobApplication, {
          where: {
            job_id: jobId,
            status: ApplicationStatus.APPLIED,
          },
        });

        if (applications.length > 0) {
          // Still allow closure but warn about pending applications
          updateData.status = status;
        }
      }

      await updateRecords(Job, { id: jobId }, updateData, false);

      const updatedJob = await getSingleRecord(Job, {
        where: { id: jobId },
        relations: ["organization"],
      });

      return res.status(200).json({
        message: "Job updated successfully",
        job: updatedJob,
        success: true,
      });
    } catch (dbError) {
      console.error("Database error updating job:", dbError);
      return res.status(500).json({
        message: "Failed to update job",
        details: "There was an error updating the job in the database.",
        success: false,
      });
    }
  } catch (error) {
    console.error("Error updating job:", error);
    return res.status(500).json({
      message: "Internal server error",
      details: "An unexpected error occurred while updating the job.",
      success: false,
    });
  }
};

// Delete a job
export const deleteJob = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        message: "Job ID is required",
        success: false,
      });
    }

    try {
      // First check if the job exists
      const job = await getSingleRecord(Job, { where: { id: jobId } });
      if (!job) {
        return res.status(404).json({
          message: "Job not found",
          details:
            "The job you're trying to delete doesn't exist or has already been removed.",
          success: false,
        });
      }

      // Check if there are any applications
      const applications = await getAllRecordsWithFilter(JobApplication, {
        where: { job_id: jobId },
      });

      if (applications.length > 0) {
        return res.status(409).json({
          message: "Cannot delete job with existing applications",
          details: `This job has ${applications.length} applications. Consider closing the job instead of deleting it.`,
          applicationCount: applications.length,
          success: false,
        });
      }

      // Delete job
      await deleteRecords(Job, { id: jobId });

      return res.status(200).json({
        message: "Job deleted successfully",
        deletedJobId: jobId,
        success: true,
      });
    } catch (dbError) {
      console.error("Database error deleting job:", dbError);
      return res.status(500).json({
        message: "Failed to delete job",
        details: "There was an error deleting the job from the database.",
        success: false,
      });
    }
  } catch (error) {
    console.error("Error deleting job:", error);
    return res.status(500).json({
      message: "Internal server error",
      details: "An unexpected error occurred while deleting the job.",
      success: false,
    });
  }
};

// Get all jobs (admin view)
export const getAllJobs = async (req: Request, res: Response) => {
  try {
    const { org_id, status } = req.query;

    // Build the where condition
    let whereCondition: any = {};

    if (org_id) {
      whereCondition.org_id = org_id.toString();
    }

    if (status && Object.values(JobStatus).includes(status as JobStatus)) {
      whereCondition.status = status;
    }

    try {
      const jobs = await getAllRecordsWithFilter(Job, {
        where: whereCondition,
        order: { createdAt: "DESC" },
        relations: ["organization"],
      });

      return res.status(200).json({
        message: "Jobs fetched successfully",
        count: jobs.length,
        jobs,
        success: true,
        filters: { org_id, status },
      });
    } catch (dbError) {
      console.error("Database error fetching jobs:", dbError);
      return res.status(500).json({
        message: "Failed to fetch jobs",
        details: "There was an error retrieving jobs from the database.",
        success: false,
      });
    }
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return res.status(500).json({
      message: "Internal server error",
      details: "An unexpected error occurred while retrieving jobs.",
      success: false,
    });
  }
};

// Get a single job by ID (admin view)
export const getJobById = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        message: "Job ID is required",
        success: false,
      });
    }

    try {
      const job = await getSingleRecord(Job, {
        where: { id: jobId },
        relations: ["applications", "applications.user", "organization"],
      });

      if (!job) {
        return res.status(404).json({
          message: "Job not found",
          details: "The requested job does not exist or has been removed.",
          success: false,
        });
      }

      return res.status(200).json({
        message: "Job fetched successfully",
        job,
        applicationCount: job.applications?.length || 0,
        success: true,
      });
    } catch (dbError) {
      console.error("Database error fetching job:", dbError);
      return res.status(500).json({
        message: "Failed to fetch job details",
        details:
          "There was an error retrieving the job details from the database.",
        success: false,
      });
    }
  } catch (error) {
    console.error("Error fetching job:", error);
    return res.status(500).json({
      message: "Internal server error",
      details: "An unexpected error occurred while retrieving the job details.",
      success: false,
    });
  }
};

// Update application status
export const updateApplicationStatus = async (req: Request, res: Response) => {
  try {
    const { applicationId } = req.params;
    const { status } = req.body;

    // Validate parameters
    if (!applicationId) {
      return res.status(400).json({
        message: "Application ID is required",
        success: false,
      });
    }

    if (!status) {
      return res.status(400).json({
        message: "Status value is required",
        success: false,
      });
    }

    // Validate status value
    if (
      !Object.values(ApplicationStatus).includes(status as ApplicationStatus)
    ) {
      return res.status(400).json({
        message: "Invalid status value",
        details: `Valid status values are: ${Object.values(ApplicationStatus).join(", ")}`,
        success: false,
      });
    }

    try {
      // Find the application
      const application = await getSingleRecord(JobApplication, {
        where: { id: applicationId },
      });
      if (!application) {
        return res.status(404).json({
          message: "Application not found",
          success: false,
        });
      }

      // Prevent invalid status transitions
      if (
        application.status === ApplicationStatus.HIRED &&
        status !== ApplicationStatus.HIRED
      ) {
        return res.status(400).json({
          message: "Cannot change status from HIRED to another status",
          success: false,
        });
      }

      // Update the application status
      await updateRecords(
        JobApplication,
        { id: applicationId },
        { status },
        false,
      );

      // Get updated application with relations
      const updatedApplication = await getSingleRecord(JobApplication, {
        where: { id: applicationId },
        relations: ["user", "job", "job.organization"],
      });

      return res.status(200).json({
        message: "Application status updated successfully",
        application: updatedApplication,
        success: true,
      });
    } catch (dbError) {
      console.error("Database error updating application status:", dbError);
      return res.status(500).json({
        message: "Failed to update application status",
        details:
          "There was an error updating the application status in the database.",
        success: false,
      });
    }
  } catch (error) {
    console.error("Error updating application status:", error);
    return res.status(500).json({
      message: "Internal server error",
      details:
        "An unexpected error occurred while updating the application status.",
      success: false,
    });
  }
};

// ==================== USER CONTROLLERS ====================

// Get all open jobs (student/user view)
export const getOpenJobs = async (req: Request, res: Response) => {
  try {
    const jobs = await getAllRecordsWithFilter(Job, {
      where: { status: JobStatus.OPEN },
      order: { createdAt: "DESC" },
      relations: ["organization"],
    });

    return res.status(200).json({
      message: "Open jobs fetched successfully",
      count: jobs.length,
      jobs,
      success: true,
    });
  } catch (error) {
    console.error("Error fetching open jobs:", error);
    return res.status(500).json({
      message: "Failed to fetch open jobs",
      details:
        "There was an error retrieving the job listings. Please try again later.",
      success: false,
    });
  }
};

// Apply for a job
export const applyForJob = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    // Get userId from req.user if available (authenticated) or use null for anonymous applications
    const userId = req.user?.id || null;
    const applicantName = req.body.applicantName || "Anonymous Applicant";
    const applicantEmail = req.body.applicantEmail || null;
    const college = req.body.college || null;
    const graduationYear = req.body.graduationYear || null;
    const branch = req.body.branch || null;
    const skills = req.body.skills || [];

    // Validate parameters
    if (!jobId) {
      return res.status(400).json({
        message: "Job ID is required",
        success: false,
      });
    }

    // Validate required fields for anonymous applications
    if (!userId && (!applicantName || !applicantEmail)) {
      return res.status(400).json({
        message: "Name and email are required for anonymous applications",
        success: false,
      });
    }

    // Find the job with organization details
    const job = await getSingleRecord(Job, {
      where: { id: jobId },
      relations: ["organization"],
    });

    if (!job) {
      return res.status(404).json({
        message: "Job not found",
        success: false,
      });
    }

    // Check if job is open for applications
    if (job.status !== JobStatus.OPEN) {
      return res.status(400).json({
        message: "This job is not open for applications",
        details: `Current job status is: ${job.status}`,
        success: false,
      });
    }

    // If user is authenticated, check if they have already applied
    if (userId) {
      const existingApplication = await getSingleRecord(JobApplication, {
        where: { user_id: userId, job_id: jobId },
      });

      if (existingApplication) {
        return res.status(400).json({
          message: "You have already applied for this job",
          applicationId: existingApplication.id,
          status: existingApplication.status,
          success: false,
        });
      }
    }

    let resumePath = null;

    // Handle resume file upload to S3
    if (req.file) {
      try {
        // Validate file type (additional check)
        const validTypes = ["application/pdf"];
        if (!validTypes.includes(req.file.mimetype)) {
          return res.status(400).json({
            message: "Invalid file type. Only PDF files are allowed.",
            success: false,
          });
        }

        // Generate a unique identifier for anonymous users
        const userIdentifier = userId
          ? `user_${userId}`
          : `anon_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

        // Generate a unique file name for S3
        const fileName = s3Service.generateUniqueFileName(
          req.file.originalname,
          userIdentifier,
        );

        // Upload the file to S3
        resumePath = await s3Service.uploadFile(
          req.file.buffer,
          fileName,
          "application/pdf",
          "resumes",
        );
      } catch (uploadError) {
        console.error("Error uploading resume:", uploadError);
        // Log more detailed error information
        if (uploadError instanceof Error) {
          console.error(
            "Error details:",
            uploadError.message,
            uploadError.stack,
          );
        }
        return res.status(500).json({
          message: "Failed to upload resume",
          details:
            "There was an error uploading your resume to storage. Please try again.",
          error:
            uploadError instanceof Error
              ? uploadError.message
              : "Unknown error",
          success: false,
        });
      }
    } else {
      return res.status(400).json({
        message: "Resume file is required",
        success: false,
      });
    }

    // Create job application
    try {
      // Generate unique identifier for anonymous applications
      const applicationIdentifier = !userId
        ? `app_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
        : null;

      const application = JobApplication.create({
        user_id: userId, // This will be null for anonymous users
        job_id: jobId,
        resumePath,
        status: ApplicationStatus.APPLIED,
        applicationIdentifier,
        applicantName,
        applicantEmail,
        college,
        graduationYear: graduationYear ? graduationYear.toString() : null,
        branch,
        skills: Array.isArray(skills) ? skills : skills ? [skills] : [],
      });

      await application.save();

      // Get the full application with related data
      const createdApplication = await getSingleRecord(JobApplication, {
        where: { id: application.id },
        relations: ["job", "job.organization"],
      });

      return res.status(201).json({
        message: "Job application submitted successfully",
        application: createdApplication,
        applicationIdentifier,
        success: true,
      });
    } catch (dbError) {
      console.error("Error saving application:", dbError);
      return res.status(500).json({
        message: "Failed to save application",
        details:
          "There was an error saving your application. Please try again.",
        success: false,
      });
    }
  } catch (error) {
    console.error("Error applying for job:", error);
    return res.status(500).json({
      message: "Internal server error",
      details:
        "An unexpected error occurred while processing your application.",
      success: false,
    });
  }
};

// Get user's job applications
export const getUserApplications = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    if (!userId) {
      return res.status(400).json({
        message: "User ID is required",
        details: "Authentication issue: User ID not found in request",
        success: false,
      });
    }

    try {
      const applications = await getAllRecordsWithFilter(JobApplication, {
        where: { user_id: userId },
        relations: ["job", "job.organization"],
        order: { appliedAt: "DESC" },
      });

      return res.status(200).json({
        message: "User applications fetched successfully",
        count: applications.length,
        applications,
        success: true,
      });
    } catch (dbError) {
      console.error("Database error fetching applications:", dbError);
      return res.status(500).json({
        message: "Failed to fetch applications",
        details:
          "There was an error retrieving your applications from the database.",
        success: false,
      });
    }
  } catch (error) {
    console.error("Error fetching user applications:", error);
    return res.status(500).json({
      message: "Internal server error",
      details:
        "An unexpected error occurred while retrieving your applications.",
      success: false,
    });
  }
};

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

// Get all applications with full details (admin view)
export const getAllApplicationsWithDetails = async (
  req: Request,
  res: Response,
) => {
  try {
    const { limit = 10, offset = 0 } = req.query;

    try {
      const applications = await getAllRecordsWithFilter(JobApplication, {
        relations: ["job", "job.organization", "user"],
        order: { appliedAt: "DESC" },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      });

      const formattedApplications = applications.map((app) => ({
        id: app.id,
        applicationIdentifier: app.applicationIdentifier,
        // Student details (either from User or anonymous)
        studentInfo: {
          name: app.applicantName || app.user?.username || "N/A",
          email: app.applicantEmail || app.user?.email || "N/A",
          college: app.college || "N/A",
          graduationYear: app.graduationYear || "N/A",
          branch: app.branch || "N/A",
          skills: app.skills || [],
          isAnonymous: !app.user_id,
        },
        // Job details
        jobInfo: {
          title: app.job.title,
          companyName: app.job.companyName,
          location: app.job.location,
        },
        // Application details
        status: app.status,
        resumePath: app.resumePath,
        appliedAt: app.appliedAt,
        updatedAt: app.updatedAt,
      }));

      return res.status(200).json({
        message: "Applications fetched successfully",
        count: applications.length,
        applications: formattedApplications,
        success: true,
      });
    } catch (dbError) {
      console.error("Database error fetching applications:", dbError);
      return res.status(500).json({
        message: "Failed to fetch applications",
        details:
          "There was an error retrieving applications from the database.",
        success: false,
      });
    }
  } catch (error) {
    console.error("Error fetching applications:", error);
    return res.status(500).json({
      message: "Internal server error",
      details: "An unexpected error occurred while retrieving applications.",
      success: false,
    });
  }
};
