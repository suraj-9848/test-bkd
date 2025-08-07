import { LessThan, MoreThanOrEqual } from "typeorm";
import { CPTracker } from "../db/mysqlModels/CPTracker";
import { CPPlatformCrawler } from "./cpPlatformCrawler";
import { getAllRecordsWithFilter, updateRecords } from "../lib/dbLib/sqlUtils";
import { getLogger } from "../utils/logger";
import { AppDataSource } from "../db/connect";

const logger = getLogger();

export class CPTrackerDataUpdater {
  // Update all active CPTracker profiles
  static async updateAllProfiles(): Promise<{
    success: number;
    failed: number;
    total: number;
  }> {
    try {
      logger.info("Starting CPTracker data update for all users...");

      // Get all active CPTracker profiles
      const cpTrackers = await getAllRecordsWithFilter<CPTracker, any>(
        CPTracker,
        {
          where: { is_active: true },
          relations: ["user"],
        },
      );

      let successCount = 0;
      let failedCount = 0;
      const total = cpTrackers.length;

      logger.info(`Found ${total} active CPTracker profiles to update`);

      // Process each profile
      for (const tracker of cpTrackers) {
        try {
          await this.updateSingleProfile(tracker.user_id);
          successCount++;
          logger.info(
            `Updated profile for user: ${tracker.user?.username || tracker.user_id}`,
          );
        } catch (error) {
          failedCount++;
          logger.error(
            `Failed to update profile for user: ${tracker.user?.username || tracker.user_id}`,
            error,
          );
        }

        // Add delay between requests to avoid rate limiting (reduced for testing)
        await this.delay(500); // 0.5 second delay for testing (was 2000ms)
      }

      logger.info(
        `CPTracker update completed: ${successCount} success, ${failedCount} failed, ${total} total`,
      );

      return { success: successCount, failed: failedCount, total };
    } catch (error) {
      logger.error("Error updating all CPTracker profiles:", error);
      throw error;
    }
  }

  // Update single user's CPTracker profile
  static async updateSingleProfile(userId: string): Promise<CPTracker | null> {
    try {
      logger.info(`Updating CPTracker profile for user: ${userId}`);

      // Get user's CPTracker profile using AppDataSource directly
      const cpTrackerRepository = AppDataSource.getRepository(CPTracker);
      const tracker = await cpTrackerRepository.findOne({
        where: { user_id: userId, is_active: true },
      });

      if (!tracker) {
        logger.warn(`No active CPTracker profile found for user: ${userId}`);
        return null;
      }

      const cpTracker = tracker;
      const updates: any = {};
      let hasUpdates = false;

      // Update LeetCode stats
      if (
        cpTracker.leetcode_username &&
        cpTracker.active_platforms.includes("leetcode")
      ) {
        logger.info(
          `Fetching LeetCode stats for: ${cpTracker.leetcode_username}`,
        );

        const leetcodeStats = await CPPlatformCrawler.getLeetCodeStats(
          cpTracker.leetcode_username,
        );
        const leetcodeContests = await CPPlatformCrawler.getLeetCodeContests(
          cpTracker.leetcode_username,
        );

        if (leetcodeStats) {
          updates.leetcode_total_problems = leetcodeStats.totalSolved;
          updates.leetcode_easy_solved = leetcodeStats.easySolved;
          updates.leetcode_medium_solved = leetcodeStats.mediumSolved;
          updates.leetcode_hard_solved = leetcodeStats.hardSolved;

          // New detailed metrics
          updates.leetcode_contest_solved_count =
            leetcodeStats.contestSolvedCount;
          updates.leetcode_practice_solved_count =
            leetcodeStats.practiceSolvedCount;
          updates.leetcode_contests_participated =
            leetcodeStats.contestsParticipated;
          updates.leetcode_current_rating = leetcodeStats.currentRating;
          updates.leetcode_highest_rating = leetcodeContests.maxRating;

          // Add last contest information
          if (leetcodeContests.lastContestDate) {
            updates.leetcode_last_contest_date = new Date(
              leetcodeContests.lastContestDate,
            );
            updates.leetcode_last_contest_name =
              leetcodeContests.lastContestName;
          }

          updates.leetcode_last_updated = new Date();
          hasUpdates = true;

          logger.info(
            `LeetCode update for ${cpTracker.leetcode_username}: ${leetcodeStats.totalSolved} total (${leetcodeStats.contestSolvedCount} contest + ${leetcodeStats.practiceSolvedCount} practice), rating: ${leetcodeStats.currentRating}, last contest: ${leetcodeContests.lastContestName || "None"}`,
          );
        }
      }

      // Update CodeForces stats
      if (
        cpTracker.codeforces_username &&
        cpTracker.active_platforms.includes("codeforces")
      ) {
        logger.info(
          `Fetching CodeForces stats for: ${cpTracker.codeforces_username}`,
        );

        const codeforcesStats = await CPPlatformCrawler.getCodeForcesStats(
          cpTracker.codeforces_username,
        );
        const contestCount = await CPPlatformCrawler.getCodeForcesContests(
          cpTracker.codeforces_username,
        );
        const problemCount = await CPPlatformCrawler.getCodeForcesProblems(
          cpTracker.codeforces_username,
        );

        if (codeforcesStats) {
          updates.codeforces_handle = codeforcesStats.handle;
          updates.codeforces_rating = codeforcesStats.rating;
          updates.codeforces_max_rating = codeforcesStats.maxRating;
          updates.codeforces_rank = codeforcesStats.rank;
          updates.codeforces_contests_participated = contestCount;
          updates.codeforces_problems_solved = problemCount;
          updates.codeforces_last_updated = new Date();
          hasUpdates = true;
        }
      }

      // Update CodeChef stats
      if (
        cpTracker.codechef_username &&
        cpTracker.active_platforms.includes("codechef")
      ) {
        logger.info(
          `Fetching CodeChef stats for: ${cpTracker.codechef_username}`,
        );

        const codechefStats = await CPPlatformCrawler.getCodeChefStats(
          cpTracker.codechef_username,
        );

        if (codechefStats) {
          updates.codechef_rating = codechefStats.rating;
          updates.codechef_highest_rating = codechefStats.maxRating;
          updates.codechef_stars = codechefStats.stars;
          updates.codechef_contests_participated = codechefStats.contests;
          updates.codechef_problems_solved = codechefStats.problemsSolved;
          updates.codechef_last_updated = new Date();
          hasUpdates = true;
        }
      }

      // Update AtCoder stats
      if (
        cpTracker.atcoder_username &&
        cpTracker.active_platforms.includes("atcoder")
      ) {
        logger.info(
          `Fetching AtCoder stats for: ${cpTracker.atcoder_username}`,
        );

        const atcoderStats = await CPPlatformCrawler.getAtCoderStats(
          cpTracker.atcoder_username,
        );

        if (atcoderStats) {
          updates.atcoder_rating = atcoderStats.rating;
          updates.atcoder_highest_rating = atcoderStats.maxRating;
          updates.atcoder_color = atcoderStats.rank;
          updates.atcoder_contests_participated = atcoderStats.competitions;
          updates.atcoder_problems_solved = 0; // AtCoder API doesn't provide this easily
          updates.atcoder_last_updated = new Date();
          hasUpdates = true;
        }
      }

      // Calculate new performance score if we have updates
      if (hasUpdates) {
        const tempTracker = Object.assign(new CPTracker(), cpTracker, updates);
        updates.performance_score = tempTracker.calculatePerformanceScore();
        updates.updated_at = new Date();

        // Update the database using AppDataSource
        const cpTrackerRepository = AppDataSource.getRepository(CPTracker);
        await cpTrackerRepository.update({ user_id: userId }, updates);

        logger.info(
          `Successfully updated CPTracker profile for user: ${userId}, new score: ${updates.performance_score}`,
        );

        // Return updated tracker
        const updatedTracker = await cpTrackerRepository.findOne({
          where: { user_id: userId },
          relations: ["user"],
        });

        return updatedTracker || null;
      } else {
        logger.info(`No updates needed for user: ${userId}`);
        return cpTracker;
      }
    } catch (error) {
      logger.error(
        `Error updating CPTracker profile for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  // Update profiles for users in a specific batch
  static async updateBatchProfiles(
    batchId: string,
  ): Promise<{ success: number; failed: number; total: number }> {
    try {
      logger.info(`Starting CPTracker update for batch: ${batchId}`);

      // Get CPTracker profiles for users in the specified batch
      const cpTrackers = await getAllRecordsWithFilter<CPTracker, any>(
        CPTracker,
        {
          where: {
            is_active: true,
            user: {
              batch_id: { $like: `%${batchId}%` },
            },
          },
          relations: ["user"],
        },
      );

      let successCount = 0;
      let failedCount = 0;
      const total = cpTrackers.length;

      logger.info(`Found ${total} CPTracker profiles in batch ${batchId}`);

      // Process each profile
      for (const tracker of cpTrackers) {
        try {
          await this.updateSingleProfile(tracker.user_id);
          successCount++;
          logger.info(
            `Updated profile for user: ${tracker.user?.username || tracker.user_id}`,
          );
        } catch (error) {
          failedCount++;
          logger.error(
            `Failed to update profile for user: ${tracker.user?.username || tracker.user_id}`,
            error,
          );
        }

        // Add delay between requests
        await this.delay(2000);
      }

      logger.info(
        `Batch ${batchId} update completed: ${successCount} success, ${failedCount} failed, ${total} total`,
      );

      return { success: successCount, failed: failedCount, total };
    } catch (error) {
      logger.error(
        `Error updating batch ${batchId} CPTracker profiles:`,
        error,
      );
      throw error;
    }
  }

  // Update profiles for specific users
  static async updateSpecificUsers(
    userIds: string[],
  ): Promise<{ success: number; failed: number; total: number }> {
    try {
      logger.info(
        `Starting CPTracker update for ${userIds.length} specific users`,
      );

      let successCount = 0;
      let failedCount = 0;
      const total = userIds.length;

      // Process each user
      for (const userId of userIds) {
        try {
          await this.updateSingleProfile(userId);
          successCount++;
          logger.info(`Updated profile for user: ${userId}`);
        } catch (error) {
          failedCount++;
          logger.error(`Failed to update profile for user: ${userId}`, error);
        }

        // Add delay between requests
        await this.delay(2000);
      }

      logger.info(
        `Specific users update completed: ${successCount} success, ${failedCount} failed, ${total} total`,
      );

      return { success: successCount, failed: failedCount, total };
    } catch (error) {
      logger.error("Error updating specific users' CPTracker profiles:", error);
      throw error;
    }
  }

  // Cleanup inactive or outdated profiles
  static async cleanupProfiles(): Promise<number> {
    try {
      logger.info("Starting CPTracker profiles cleanup...");

      // Find profiles that haven't been updated in more than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const inactiveTrackers = await getAllRecordsWithFilter<CPTracker, any>(
        CPTracker,
        {
          where: {
            is_active: true,
            updated_at: LessThan(thirtyDaysAgo),
          },
        },
      );

      let cleanedCount = 0;

      for (const tracker of inactiveTrackers) {
        // Mark as inactive instead of deleting
        await updateRecords(
          CPTracker,
          { id: tracker.id },
          { is_active: false, updated_at: new Date() },
          false,
        );
        cleanedCount++;
      }

      logger.info(`Cleaned up ${cleanedCount} inactive CPTracker profiles`);
      return cleanedCount;
    } catch (error) {
      logger.error("Error cleaning up CPTracker profiles:", error);
      throw error;
    }
  }

  // Helper method to add delay between API calls
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Get update statistics
  static async getUpdateStats(): Promise<{
    totalProfiles: number;
    activeProfiles: number;
    recentlyUpdated: number;
    needsUpdate: number;
  }> {
    try {
      // Get all profiles count
      const allProfiles = await getAllRecordsWithFilter<CPTracker, any>(
        CPTracker,
        { where: {} },
      );

      // Get active profiles count
      const activeProfiles = await getAllRecordsWithFilter<CPTracker, any>(
        CPTracker,
        { where: { is_active: true } },
      );

      // Get recently updated profiles (last 24 hours)
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const recentlyUpdated = await getAllRecordsWithFilter<CPTracker, any>(
        CPTracker,
        {
          where: {
            is_active: true,
            updated_at: MoreThanOrEqual(twentyFourHoursAgo),
          },
        },
      );

      // Get profiles that need update (not updated in last 24 hours)
      const needsUpdate = await getAllRecordsWithFilter<CPTracker, any>(
        CPTracker,
        {
          where: {
            is_active: true,
            updated_at: LessThan(twentyFourHoursAgo),
          },
        },
      );

      return {
        totalProfiles: allProfiles.length,
        activeProfiles: activeProfiles.length,
        recentlyUpdated: recentlyUpdated.length,
        needsUpdate: needsUpdate.length,
      };
    } catch (error) {
      logger.error("Error getting CPTracker update stats:", error);
      throw error;
    }
  }

  // Get leaderboard data for logging
  static async getLeaderboardData(): Promise<any[]> {
    try {
      const leaderboardData = await getAllRecordsWithFilter<CPTracker, any>(
        CPTracker,
        {
          where: { is_active: true },
          relations: ["user"],
          order: { performance_score: "DESC" },
          take: 50, // Top 50 for logging
        },
      );

      return leaderboardData.map((item, index) => ({
        rank: index + 1,
        user: item.user,
        performance_score: item.performance_score,

        // Platform-specific scores
        leetcode_score: item.leetcode_score || 0,
        codeforces_score: item.codeforces_score || 0,
        codechef_score: item.codechef_score || 0,
        atcoder_score: item.atcoder_score || 0,

        // Detailed LeetCode metrics
        leetcode_problems: item.leetcode_total_problems || 0,
        leetcode_contest_solved: item.leetcode_contest_solved_count || 0,
        leetcode_practice_solved: item.leetcode_practice_solved_count || 0,
        leetcode_rating: item.leetcode_current_rating || 0,
        leetcode_contests: item.leetcode_contests_participated || 0,
        leetcode_last_contest_name: item.leetcode_last_contest_name,
        leetcode_last_contest_date: item.leetcode_last_contest_date,

        // Other platforms
        codeforces_rating: item.codeforces_rating || 0,
        codeforces_contests: item.codeforces_contests_participated || 0,
        codeforces_problems: item.codeforces_problems_solved || 0,

        codechef_rating: item.codechef_rating || 0,
        codechef_contests: item.codechef_contests_participated || 0,
        codechef_problems: item.codechef_problems_solved || 0,

        atcoder_rating: item.atcoder_rating || 0,
        atcoder_contests: item.atcoder_contests_participated || 0,
        atcoder_problems: item.atcoder_problems_solved || 0,

        platforms_connected: item.active_platforms?.length || 0,
        last_updated: item.updated_at,
      }));
    } catch (error) {
      logger.error("Error getting leaderboard data:", error);
      return [];
    }
  }
}
