import { Request, Response } from "express";
import { Like } from "typeorm";
import { CPTracker } from "../../db/mysqlModels/CPTracker";
import {
  getSingleRecord,
  createRecord,
  updateRecords,
  getAllRecordsWithFilter,
} from "../../lib/dbLib/sqlUtils";
import { getUserFromRequest } from "../../utils/userHelpers";
import { getLogger } from "../../utils/logger";
import { CPTrackerDataUpdater } from "../../services/cpTrackerDataUpdater";
import { CPTrackerCronService } from "../../services/cpTrackerCronService";
import { CPEditRequestService } from "../../services/cpEditRequestService";

const logger = getLogger();

// Connect/Update CPTracker profiles for a user
export const connectCPTracker = async (req: Request, res: Response) => {
  try {
    const user = await getUserFromRequest(req);
    const {
      leetcode_username,
      codeforces_username,
      codechef_username,
      atcoder_username,
    } = req.body;

    // Check if user already has a CPTracker profile
    let cpTracker = await getSingleRecord<CPTracker, any>(CPTracker, {
      where: { user_id: user.id },
    });

    // Determine active platforms
    const activePlatforms: string[] = [];
    if (leetcode_username) activePlatforms.push("leetcode");
    if (codeforces_username) activePlatforms.push("codeforces");
    if (codechef_username) activePlatforms.push("codechef");
    if (atcoder_username) activePlatforms.push("atcoder");

    if (cpTracker) {
      // Update existing profile
      await updateRecords(
        CPTracker,
        { user_id: user.id },
        {
          leetcode_username: leetcode_username || cpTracker.leetcode_username,
          codeforces_username:
            codeforces_username || cpTracker.codeforces_username,
          codechef_username: codechef_username || cpTracker.codechef_username,
          atcoder_username: atcoder_username || cpTracker.atcoder_username,
          active_platforms: activePlatforms,
          is_active: true,
          updated_at: new Date(),
        },
        false,
      );

      logger.info(`CPTracker profile updated for user: ${user.id}`);
    } else {
      // Create new profile
      const newCPTracker = new CPTracker();
      newCPTracker.user_id = user.id;
      newCPTracker.leetcode_username = leetcode_username || null;
      newCPTracker.codeforces_username = codeforces_username || null;
      newCPTracker.codechef_username = codechef_username || null;
      newCPTracker.atcoder_username = atcoder_username || null;
      newCPTracker.active_platforms = activePlatforms;
      newCPTracker.is_active = true;

      cpTracker = await createRecord(CPTracker.getRepository(), newCPTracker);
      logger.info(`CPTracker profile created for user: ${user.id}`);
    }

    res.status(200).json({
      success: true,
      message: "CPTracker profiles connected successfully",
      data: cpTracker,
    });
  } catch (error) {
    logger.error("Error connecting CPTracker profiles:", error);
    res.status(500).json({
      success: false,
      message: "Failed to connect CPTracker profiles",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Student: Refresh CPTracker data for current user, with 24h rate limit
export const refreshMyCPTrackerData = async (req: Request, res: Response) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user?.id) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    // Get tracker for user
    const tracker = await getSingleRecord<CPTracker, any>(CPTracker, {
      where: { user_id: user.id },
    });
    if (!tracker) {
      return res
        .status(404)
        .json({ success: false, message: "CPTracker profile not found" });
    }

    // Check if last_updated_by_user is within 24 hours
    if (tracker.last_updated_by_user) {
      const now = new Date();
      const last = new Date(tracker.last_updated_by_user);
      const diffMs = now.getTime() - last.getTime();
      if (diffMs < 24 * 60 * 60 * 1000) {
        const hoursLeft = Math.ceil(
          (24 * 60 * 60 * 1000 - diffMs) / (60 * 60 * 1000),
        );
        return res.status(429).json({
          success: false,
          message: `You can only refresh your CPTracker data once every 24 hours. Please try again in ${hoursLeft} hour(s).`,
        });
      }
    }

    // Update last_updated_by_user before refreshing
    tracker.last_updated_by_user = new Date();
    await tracker.save();

    // Patch req.params for compatibility and call existing refresh logic
    req.params = { userId: user.id };
    return await refreshCPTrackerData(req, res);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to refresh CPTracker data",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get CPTracker profile for current user
export const getMyCPTracker = async (req: Request, res: Response) => {
  try {
    const user = await getUserFromRequest(req);

    const cpTracker = await getSingleRecord<CPTracker, any>(CPTracker, {
      where: { user_id: user.id },
    });

    if (!cpTracker) {
      return res.status(404).json({
        success: false,
        message: "CPTracker profile not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ...cpTracker,
        batch_id: user.batch_id,
      },
    });
  } catch (error) {
    logger.error("Error getting CPTracker profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get CPTracker profile",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get CPTracker leaderboard
export const getCPTrackerLeaderboard = async (req: Request, res: Response) => {
  try {
    const { limit = 50, offset = 0, page = 1, batch_id } = req.query;

    const limitNumber = Number(limit);
    const pageNumber = Number(page);
    const offsetNumber =
      pageNumber > 1 ? (pageNumber - 1) * limitNumber : Number(offset);

    // Build where conditions using TypeORM MySQL syntax
    const whereConditions: any = {
      is_active: true,
    };

    // If batch_id is provided, filter by batch
    let joinConditions = {};
    if (batch_id) {
      joinConditions = {
        relations: ["user"],
        where: [
          {
            ...whereConditions,
            user: {
              batch_id: batch_id,
            },
          },
        ],
      };
    } else {
      joinConditions = {
        relations: ["user"],
        where: whereConditions,
      };
    }

    // Get paginated results
    const cpTrackers = await getAllRecordsWithFilter<CPTracker, any>(
      CPTracker,
      {
        ...joinConditions,
        order: { performance_score: "DESC" },
        take: limitNumber,
        skip: offsetNumber,
      },
    );

    // Get total count for pagination
    const totalCount = await getAllRecordsWithFilter<CPTracker, any>(
      CPTracker,
      {
        ...joinConditions,
        select: ["id"],
      },
    );

    const totalItems = totalCount.length;
    const totalPages = Math.ceil(totalItems / limitNumber);
    const hasNextPage = pageNumber < totalPages;
    const hasPreviousPage = pageNumber > 1;

    // Add rank to each entry with recalculated platform scores
    const leaderboard = cpTrackers.map((tracker, index) => {
      tracker.calculatePerformanceScore();
      const leetcodeSolved = tracker.leetcode_total_problems || 0;
      const codeforcesSolved = tracker.codeforces_problems_solved || 0;
      const codechefSolved = tracker.codechef_problems_solved || 0;
      const atcoderSolved = tracker.atcoder_problems_solved || 0;
      const totalSolved =
        leetcodeSolved + codeforcesSolved + codechefSolved + atcoderSolved;
      return {
        rank: offsetNumber + index + 1,
        user: {
          id: tracker.user?.id,
          username: tracker.user?.username,
          profile_picture: tracker.user?.profile_picture,
        },
        performance_score: Number(tracker.performance_score) || 0,

        // Platform-specific scores (freshly calculated)
        leetcode_score: Number(tracker.leetcode_score) || 0,
        codeforces_score: Number(tracker.codeforces_score) || 0,
        codechef_score: Number(tracker.codechef_score) || 0,
        atcoder_score: Number(tracker.atcoder_score) || 0,

        // Detailed LeetCode metrics
        leetcode_total_problems: leetcodeSolved,
        leetcode_contest_solved_count:
          tracker.leetcode_contest_solved_count || 0,
        leetcode_practice_solved_count:
          tracker.leetcode_practice_solved_count || 0,
        leetcode_current_rating: tracker.leetcode_current_rating || 0,
        leetcode_contests_participated:
          tracker.leetcode_contests_participated || 0,
        leetcode_last_contest_name: tracker.leetcode_last_contest_name,
        leetcode_last_contest_date: tracker.leetcode_last_contest_date,

        // CodeForces metrics
        codeforces_rating: tracker.codeforces_rating || 0,
        codeforces_contests_participated:
          tracker.codeforces_contests_participated || 0,
        codeforces_problems_solved: codeforcesSolved,

        // CodeChef metrics
        codechef_rating: tracker.codechef_rating || 0,
        codechef_contests_participated:
          tracker.codechef_contests_participated || 0,
        codechef_problems_solved: codechefSolved,

        // AtCoder metrics
        atcoder_rating: tracker.atcoder_rating || 0,
        atcoder_contests_participated:
          tracker.atcoder_contests_participated || 0,
        atcoder_problems_solved: atcoderSolved,

        total_solved_count: totalSolved,

        platforms_connected: tracker.active_platforms
          ? tracker.active_platforms.length
          : 0,
        last_updated: tracker.updated_at,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        leaderboard,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalItems,
          itemsPerPage: limitNumber,
          hasNextPage,
          hasPreviousPage,
          offset: offsetNumber,
        },
      },
    });
  } catch (error) {
    logger.error("Error getting CPTracker leaderboard:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get CPTracker leaderboard",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get CPTracker profile by user ID (Admin/Instructor only)
export const getCPTrackerByUserId = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const cpTracker = await getSingleRecord<CPTracker, any>(CPTracker, {
      where: { user_id: userId },
      relations: ["user"],
    });

    if (!cpTracker) {
      return res.status(404).json({
        success: false,
        message: "CPTracker profile not found for this user",
      });
    }

    res.status(200).json({
      success: true,
      data: cpTracker,
    });
  } catch (error) {
    logger.error("Error getting CPTracker profile by user ID:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get CPTracker profile",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Update CPTracker profile by user ID (Admin/Instructor only)
export const updateCPTrackerByUserId = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    // Check if CPTracker profile exists
    const existingTracker = await getSingleRecord<CPTracker, any>(CPTracker, {
      where: { user_id: userId },
    });

    if (!existingTracker) {
      return res.status(404).json({
        success: false,
        message: "CPTracker profile not found for this user",
      });
    }

    // Update the profile
    await updateRecords(
      CPTracker,
      { user_id: userId },
      {
        ...updates,
        updated_at: new Date(),
      },
      false,
    );

    // Get updated profile
    const updatedTracker = await getSingleRecord<CPTracker, any>(CPTracker, {
      where: { user_id: userId },
      relations: ["user"],
    });

    logger.info(
      `CPTracker profile updated for user: ${userId} by admin/instructor`,
    );

    res.status(200).json({
      success: true,
      message: "CPTracker profile updated successfully",
      data: updatedTracker,
    });
  } catch (error) {
    logger.error("Error updating CPTracker profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update CPTracker profile",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get all CPTracker profiles (Admin/Instructor only)
export const getAllCPTrackers = async (req: Request, res: Response) => {
  try {
    const {
      limit = 100,
      offset = 0,
      page = 1,
      batch_id,
      is_active = true,
      platform,
      search,
    } = req.query;

    const limitNumber = Number(limit);
    const pageNumber = Number(page);
    const offsetNumber =
      pageNumber > 1 ? (pageNumber - 1) * limitNumber : Number(offset);

    // Build where conditions using proper TypeORM syntax
    const whereConditions: any = {};

    if (is_active !== undefined) {
      whereConditions.is_active = is_active === "true";
    }

    if (platform) {
      whereConditions.active_platforms = Like(`%${platform}%`);
    }

    const queryOptions: any = {
      relations: ["user"],
      order: { performance_score: "DESC" },
      take: limitNumber,
      skip: offsetNumber,
    };

    // If batch_id is provided or search is provided, we need to join with user
    if (batch_id || search) {
      const userConditions: any = {};

      if (batch_id) {
        userConditions.batch_id = batch_id;
      }

      if (search) {
        userConditions.username = Like(`%${search}%`);
      }

      queryOptions.where = {
        ...whereConditions,
        user: userConditions,
      };
    } else {
      queryOptions.where = whereConditions;
    }

    const cpTrackers = await getAllRecordsWithFilter<CPTracker, any>(
      CPTracker,
      queryOptions,
    );

    // Get total count for pagination
    const totalCountOptions = { ...queryOptions };
    delete totalCountOptions.take;
    delete totalCountOptions.skip;
    totalCountOptions.select = ["id"];

    const totalCount = await getAllRecordsWithFilter<CPTracker, any>(
      CPTracker,
      totalCountOptions,
    );

    const totalItems = totalCount.length;
    const totalPages = Math.ceil(totalItems / limitNumber);
    const hasNextPage = pageNumber < totalPages;
    const hasPreviousPage = pageNumber > 1;

    const formattedData = cpTrackers.map((tracker, index) => ({
      id: tracker.id,
      rank: offsetNumber + index + 1,
      user: {
        id: tracker.user?.id,
        username: tracker.user?.username,
        email: tracker.user?.email,
        profile_picture: tracker.user?.profile_picture,
        batch_id: tracker.user?.batch_id,
      },
      platforms: {
        leetcode: tracker.leetcode_username,
        codeforces: tracker.codeforces_username,
        codechef: tracker.codechef_username,
        atcoder: tracker.atcoder_username,
      },
      stats: {
        performance_score: tracker.performance_score,
        leetcode_total_problems: tracker.leetcode_total_problems,
        codeforces_rating: tracker.codeforces_rating,
        codechef_rating: tracker.codechef_rating,
        atcoder_rating: tracker.atcoder_rating,
      },
      active_platforms: tracker.active_platforms,
      is_active: tracker.is_active,
      last_updated: tracker.updated_at,
      created_at: tracker.created_at,
    }));

    res.status(200).json({
      success: true,
      data: {
        trackers: formattedData,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalItems,
          itemsPerPage: limitNumber,
          hasNextPage,
          hasPreviousPage,
          offset: offsetNumber,
        },
      },
    });
  } catch (error) {
    logger.error("Error getting all CPTracker profiles:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get CPTracker profiles",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Delete CPTracker profile (Admin only)
export const deleteCPTracker = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const cpTracker = await getSingleRecord<CPTracker, any>(CPTracker, {
      where: { user_id: userId },
    });

    if (!cpTracker) {
      return res.status(404).json({
        success: false,
        message: "CPTracker profile not found for this user",
      });
    }

    // Soft delete by setting is_active to false
    await updateRecords(
      CPTracker,
      { user_id: userId },
      { is_active: false, updated_at: new Date() },
      false,
    );

    logger.info(`CPTracker profile deleted for user: ${userId}`);

    res.status(200).json({
      success: true,
      message: "CPTracker profile deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting CPTracker profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete CPTracker profile",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get CPTracker statistics (Admin/Instructor only)
export const getCPTrackerStats = async (req: Request, res: Response) => {
  try {
    const { batch_id } = req.query;

    // Get all active CPTrackers
    const whereConditions: any = { is_active: true };
    const joinConditions: any = { relations: ["user"] };

    if (batch_id) {
      joinConditions.where = {
        ...whereConditions,
        user: {
          batch_id: batch_id, // Direct comparison for batch_id
        },
      };
    } else {
      joinConditions.where = whereConditions;
    }

    const cpTrackers = await getAllRecordsWithFilter<CPTracker, any>(
      CPTracker,
      joinConditions,
    );

    // Calculate statistics
    const stats = {
      total_users: cpTrackers.length,
      active_users: cpTrackers.filter((t) => t.performance_score > 0).length,
      platforms: {
        leetcode: cpTrackers.filter((t) => t.leetcode_username).length,
        codeforces: cpTrackers.filter((t) => t.codeforces_username).length,
        codechef: cpTrackers.filter((t) => t.codechef_username).length,
        atcoder: cpTrackers.filter((t) => t.atcoder_username).length,
      },
      average_performance_score:
        cpTrackers.length > 0
          ? cpTrackers.reduce((sum, t) => sum + t.performance_score, 0) /
            cpTrackers.length
          : 0,
      top_performers: cpTrackers
        .sort((a, b) => b.performance_score - a.performance_score)
        .slice(0, 10)
        .map((tracker, index) => ({
          rank: index + 1,
          username: tracker.user?.username,
          performance_score: tracker.performance_score,
          platforms_connected: tracker.active_platforms.length,
        })),
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error("Error getting CPTracker statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get CPTracker statistics",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Manual refresh for a specific user (Admin/Instructor only)
export const refreshCPTrackerData = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const cpTracker = await getSingleRecord<CPTracker, any>(CPTracker, {
      where: { user_id: userId },
    });

    if (!cpTracker) {
      return res.status(404).json({
        success: false,
        message: "CPTracker profile not found for this user",
      });
    }

    // Trigger actual data refresh using the updater service
    const updatedTracker =
      await CPTrackerDataUpdater.updateSingleProfile(userId);

    if (updatedTracker) {
      logger.info(`CPTracker data refreshed for user: ${userId}`);
      res.status(200).json({
        success: true,
        message: "CPTracker data refreshed successfully",
        data: updatedTracker,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Failed to refresh CPTracker data - no active profile found",
      });
    }
  } catch (error) {
    logger.error("Error refreshing CPTracker data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to refresh CPTracker data",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// === ADMIN/INSTRUCTOR CRON JOB MANAGEMENT ===

// Trigger manual update for all users
export const triggerManualUpdateAll = async (req: Request, res: Response) => {
  try {
    logger.info("Manual update of all CPTracker profiles triggered");

    const result = await CPTrackerDataUpdater.updateAllProfiles();

    res.status(200).json({
      success: true,
      message: "Manual update completed",
      data: result,
    });
  } catch (error) {
    logger.error("Error in manual update:", error);
    res.status(500).json({
      success: false,
      message: "Manual update failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Trigger manual update for specific batch
export const triggerManualUpdateBatch = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: "Batch ID is required",
      });
    }

    logger.info(`Manual update for batch ${batchId} triggered`);

    const result = await CPTrackerDataUpdater.updateBatchProfiles(batchId);

    res.status(200).json({
      success: true,
      message: `Manual update for batch ${batchId} completed`,
      data: result,
    });
  } catch (error) {
    logger.error("Error in batch manual update:", error);
    res.status(500).json({
      success: false,
      message: "Batch manual update failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get cron job status
export const getCronJobStatus = async (req: Request, res: Response) => {
  try {
    const status = CPTrackerCronService.getJobsStatus();

    res.status(200).json({
      success: true,
      message: "Cron job status retrieved",
      data: status,
    });
  } catch (error) {
    logger.error("Error getting cron job status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get cron job status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Start/Stop specific cron job
export const manageCronJob = async (req: Request, res: Response) => {
  try {
    const { jobName } = req.params;
    const { action } = req.body; // 'start' or 'stop'

    if (!jobName || !action) {
      return res.status(400).json({
        success: false,
        message: "Job name and action are required",
      });
    }

    let result: boolean;
    if (action === "start") {
      result = CPTrackerCronService.startJob(jobName);
    } else if (action === "stop") {
      result = CPTrackerCronService.stopJob(jobName);
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Use 'start' or 'stop'",
      });
    }

    if (result) {
      res.status(200).json({
        success: true,
        message: `Cron job ${jobName} ${action}ed successfully`,
      });
    } else {
      res.status(404).json({
        success: false,
        message: `Cron job ${jobName} not found`,
      });
    }
  } catch (error) {
    logger.error("Error managing cron job:", error);
    res.status(500).json({
      success: false,
      message: "Failed to manage cron job",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get update statistics
export const getUpdateStats = async (req: Request, res: Response) => {
  try {
    const stats = await CPTrackerDataUpdater.getUpdateStats();

    res.status(200).json({
      success: true,
      message: "Update statistics retrieved",
      data: stats,
    });
  } catch (error) {
    logger.error("Error getting update stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get update statistics",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Create custom batch cron job
export const createBatchCronJob = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const { cronExpression } = req.body;

    if (!batchId || !cronExpression) {
      return res.status(400).json({
        success: false,
        message: "Batch ID and cron expression are required",
      });
    }

    const result = CPTrackerCronService.createBatchSpecificJob(
      batchId,
      cronExpression,
    );

    if (result) {
      res.status(201).json({
        success: true,
        message: `Custom cron job created for batch ${batchId}`,
      });
    } else {
      res.status(400).json({
        success: false,
        message: `Failed to create cron job for batch ${batchId} - may already exist`,
      });
    }
  } catch (error) {
    logger.error("Error creating batch cron job:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create batch cron job",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Remove custom batch cron job
export const removeBatchCronJob = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: "Batch ID is required",
      });
    }

    const result = CPTrackerCronService.removeBatchJob(batchId);

    if (result) {
      res.status(200).json({
        success: true,
        message: `Custom cron job removed for batch ${batchId}`,
      });
    } else {
      res.status(404).json({
        success: false,
        message: `No custom cron job found for batch ${batchId}`,
      });
    }
  } catch (error) {
    logger.error("Error removing batch cron job:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove batch cron job",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// === EDIT REQUEST MANAGEMENT ===

// Request edit (Student)
export const requestEdit = async (req: Request, res: Response) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const {
      leetcode_username,
      codeforces_username,
      codechef_username,
      atcoder_username,
      reason,
    } = req.body;

    if (!reason || reason.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Reason for edit request is required",
      });
    }

    // Determine active platforms
    const active_platforms: string[] = [];
    if (leetcode_username) active_platforms.push("leetcode");
    if (codeforces_username) active_platforms.push("codeforces");
    if (codechef_username) active_platforms.push("codechef");
    if (atcoder_username) active_platforms.push("atcoder");

    const editRequest = await CPEditRequestService.createEditRequest(user.id, {
      leetcode_username,
      codeforces_username,
      codechef_username,
      atcoder_username,
      active_platforms,
      reason: reason.trim(),
    });

    logger.info(`Edit request created for user: ${user.id}`);

    res.status(201).json({
      success: true,
      message: "Edit request submitted successfully",
      data: editRequest,
    });
  } catch (error) {
    logger.error("Error creating edit request:", error);
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create edit request",
    });
  }
};

// Get all edit requests (Admin/Instructor)
export const getAllEditRequests = async (req: Request, res: Response) => {
  try {
    const { status, limit = 10, page = 1 } = req.query;

    // Convert status string to enum if provided
    let statusEnum = undefined;
    if (status) {
      const statusStr = status as string;
      if (statusStr.toLowerCase() === "pending") statusEnum = "pending";
      else if (statusStr.toLowerCase() === "approved") statusEnum = "approved";
      else if (statusStr.toLowerCase() === "rejected") statusEnum = "rejected";
    }

    const requests = await CPEditRequestService.getEditRequests(
      Number(page),
      Number(limit),
      statusEnum as any,
    );

    res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error) {
    logger.error("Error getting edit requests:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get edit requests",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Approve edit request (Admin/Instructor)
export const approveEditRequest = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { adminNotes } = req.body;
    const user = await getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const result = await CPEditRequestService.approveEditRequest(
      requestId,
      user.id,
      adminNotes,
    );

    logger.info(`Edit request approved: ${requestId} by ${user.id}`);

    res.status(200).json({
      success: true,
      message: "Edit request approved successfully",
      data: result,
    });
  } catch (error) {
    logger.error("Error approving edit request:", error);
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to approve edit request",
    });
  }
};

// Reject edit request (Admin/Instructor)
export const rejectEditRequest = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    const user = await getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!reason || reason.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Reason for rejection is required",
      });
    }

    const result = await CPEditRequestService.rejectEditRequest(
      requestId,
      user.id,
      reason.trim(),
    );

    logger.info(`Edit request rejected: ${requestId} by ${user.id}`);

    res.status(200).json({
      success: true,
      message: "Edit request rejected successfully",
      data: result,
    });
  } catch (error) {
    logger.error("Error rejecting edit request:", error);
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to reject edit request",
    });
  }
};

// Get edit request by ID (Admin/Instructor)
export const getEditRequestById = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;

    // Use getUserEditRequests and filter, or create a specific method
    const allRequests = await CPEditRequestService.getEditRequests(1, 1000); // Get all to find specific one
    const request = allRequests.requests.find((r: any) => r.id === requestId);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Edit request not found",
      });
    }

    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error) {
    logger.error("Error getting edit request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get edit request",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
