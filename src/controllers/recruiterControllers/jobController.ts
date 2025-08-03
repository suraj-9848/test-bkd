import { Request, Response } from "express";
import { Job, JobStatus } from "../../db/mysqlModels/Job";
import { validate } from "class-validator";
import { Like } from "typeorm";
import {
  deleteRecords,
  getAllRecordsWithFilter,
  createRecord,
} from "../../lib/dbLib/sqlUtils";

// Create a new job
export const createJob = async (req: Request, res: Response) => {
  try {
    const {
      title,
      companyName,
      description,
      skills,
      eligibleBranches,
      location,
      applyLink,
      salary,
    } = req.body;
    // org_id is no longer required for global jobs
    const requiredFields = { title, companyName, description, location };
    const missingFields = Object.entries(requiredFields)
      .filter(([_, value]) => !value)
      .map(([key]) => key);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        missingFields,
      });
    }
    const job = new Job();
    job.title = title;
    job.companyName = companyName;
    job.description = description;
    job.location = location;
    job.skills = skills || [];
    job.eligibleBranches = eligibleBranches || [];
    job.status = JobStatus.OPEN;
    if (applyLink) job.applyLink = applyLink as string;
    if (salary) job.salary = salary as number;
    const errors = await validate(job);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }
    // Use util function to create job record
    const createdJob = await createRecord(Job, job);
    return res.status(201).json({
      success: true,
      message: "Job created successfully",
      job: createdJob,
    });
  } catch (error) {
    console.error("Error creating job:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get all jobs for recruiter's organization
export const getJobs = async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query;
    const where: any = {};
    if (status && Object.values(JobStatus).includes(status as JobStatus)) {
      where.status = status;
    }
    if (search) {
      where.title = Like(`%${search}%`);
    }
    // Use util function for job fetching
    const jobs = await getAllRecordsWithFilter(
      Job,
      { where, order: { createdAt: "DESC" } },
      `recruiter:jobs:search:${search || ""}:status:${status || ""}`,
      true,
      10 * 60,
    );
    return res.status(200).json({
      success: true,
      jobs,
    });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get a single job by ID
export const getJobById = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = await Job.findOne({ where: { id: jobId } });
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    // Allow access to all jobs (global and org-specific)
    return res.status(200).json({ success: true, job });
  } catch (error) {
    console.error("Error fetching job:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update a job
export const updateJob = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const {
      title,
      companyName,
      description,
      skills,
      eligibleBranches,
      location,
      status,
      applyLink,
      salary,
    } = req.body;
    const job = await Job.findOne({ where: { id: jobId } });
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    // Allow update for all jobs (global and org-specific)
    if (title) job.title = title;
    if (companyName) job.companyName = companyName;
    if (description) job.description = description;
    if (location) job.location = location;
    if (skills) job.skills = skills;
    if (eligibleBranches) job.eligibleBranches = eligibleBranches;
    if (status && Object.values(JobStatus).includes(status as JobStatus))
      job.status = status as JobStatus;
    if (applyLink !== undefined) job.applyLink = applyLink as string;
    if (salary !== undefined) job.salary = salary as number;
    await job.save();
    return res
      .status(200)
      .json({ success: true, message: "Job updated successfully", job });
  } catch (error) {
    console.error("Error updating job:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Delete a job
export const deleteJob = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = await Job.findOne({ where: { id: jobId } });
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    // Use util function for job deletion
    await deleteRecords(Job, { id: jobId });
    return res
      .status(200)
      .json({ success: true, message: "Job deleted successfully" });
  } catch (error) {
    console.error("Error deleting job:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
