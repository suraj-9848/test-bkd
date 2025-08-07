import * as cron from "node-cron";
import { CPTrackerDataUpdater } from "./cpTrackerDataUpdater";
import { getLogger } from "../utils/logger";

const logger = getLogger();

export class CPTrackerCronService {
  private static jobs: Map<string, cron.ScheduledTask> = new Map();

  // Initialize all cron jobs
  static initializeCronJobs(): void {
    logger.info("Initializing CPTracker cron jobs...");

    // ⚠️ TESTING MODE: Running every 30 seconds instead of daily
    // TODO: Change back to daily schedule for production
    this.scheduleDailyUpdate();

    // Weekly cleanup on Sundays at 3:00 AM
    this.scheduleWeeklyCleanup();

    // Batch updates every 6 hours
    this.scheduleBatchUpdates();

    logger.info(
      "CPTracker cron jobs initialized successfully (TESTING MODE: 30-second intervals)",
    );
  }

  // Schedule daily update of all active profiles (every 30 seconds for testing)
  private static scheduleDailyUpdate(): void {
    const job = cron.schedule(
      "0 2 * * *", // Every 30 seconds for testing (was "0 2 * * *" for daily)
      async () => {
        try {
          logger.info(
            " Starting CPTracker data update (every 30 seconds for testing)...",
          );

          const startTime = Date.now();
          const result = await CPTrackerDataUpdater.updateAllProfiles();
          const endTime = Date.now();
          const duration = Math.round((endTime - startTime) / 1000);
          logger.info(
            `CPTracker update completed in ${duration} seconds. ` +
              `Success: ${result.success}, Failed: ${result.failed}, Total: ${result.total}`,
          );

          // Log detailed platform-specific statistics for leaderboard
          const leaderboardData =
            await CPTrackerDataUpdater.getLeaderboardData();
          if (leaderboardData && leaderboardData.length > 0) {
            leaderboardData.slice(0, 10).forEach((student, index) => {
              const platformDetails = [];

              // LeetCode detailed info
              if (student.leetcode_problems > 0) {
                const lcDetails = [];
                lcDetails.push(`Total: ${student.leetcode_problems}`);
                lcDetails.push(`Contest: ${student.leetcode_contest_solved}`);
                lcDetails.push(`Practice: ${student.leetcode_practice_solved}`);
                if (student.leetcode_rating > 0)
                  lcDetails.push(`Rating: ${student.leetcode_rating}`);
                if (student.leetcode_contests > 0)
                  lcDetails.push(`${student.leetcode_contests} contests`);
                if (student.leetcode_last_contest_name) {
                  const lastContestDate = student.leetcode_last_contest_date
                    ? new Date(
                        student.leetcode_last_contest_date,
                      ).toLocaleDateString("en-IN")
                    : "Unknown";
                  lcDetails.push(
                    `Last: ${student.leetcode_last_contest_name} (${lastContestDate})`,
                  );
                }
                platformDetails.push(
                  `🟢 LC[${student.leetcode_score}pts]: ${lcDetails.join(", ")}`,
                );
              }

              // CodeForces info
              if (
                student.codeforces_rating > 0 ||
                student.codeforces_contests > 0
              ) {
                const cfDetails = [];
                if (student.codeforces_rating > 0)
                  cfDetails.push(`Rating: ${student.codeforces_rating}`);
                if (student.codeforces_contests > 0)
                  cfDetails.push(`${student.codeforces_contests} contests`);
                if (student.codeforces_problems > 0)
                  cfDetails.push(`${student.codeforces_problems} problems`);
                platformDetails.push(
                  `🔵 CF[${student.codeforces_score}pts]: ${cfDetails.join(", ")}`,
                );
              }

              // CodeChef info
              if (
                student.codechef_rating > 0 ||
                student.codechef_contests > 0
              ) {
                const ccDetails = [];
                if (student.codechef_rating > 0)
                  ccDetails.push(`Rating: ${student.codechef_rating}`);
                if (student.codechef_contests > 0)
                  ccDetails.push(`${student.codechef_contests} contests`);
                if (student.codechef_problems > 0)
                  ccDetails.push(`${student.codechef_problems} problems`);
                platformDetails.push(
                  `🟤 CC[${student.codechef_score}pts]: ${ccDetails.join(", ")}`,
                );
              }

              // AtCoder info
              if (student.atcoder_rating > 0 || student.atcoder_contests > 0) {
                const atDetails = [];
                if (student.atcoder_rating > 0)
                  atDetails.push(`Rating: ${student.atcoder_rating}`);
                if (student.atcoder_contests > 0)
                  atDetails.push(`${student.atcoder_contests} contests`);
                if (student.atcoder_problems > 0)
                  atDetails.push(`${student.atcoder_problems} problems`);
                platformDetails.push(
                  `🟠 AT[${student.atcoder_score}pts]: ${atDetails.join(", ")}`,
                );
              }

              const rank = index + 1;
              const medal =
                rank === 1
                  ? "🥇"
                  : rank === 2
                    ? "🥈"
                    : rank === 3
                      ? "🥉"
                      : `#${rank}`;

              logger.info(
                `${medal} ${student.user?.username || "Unknown"} | Total Score: ${Number(student.performance_score || 0).toFixed(2)}pts`,
              );
              if (platformDetails.length > 0) {
                platformDetails.forEach((detail) =>
                  logger.info(`    ${detail}`),
                );
              } else {
                logger.info("    No platforms connected");
              }
              logger.info(""); // Empty line for readability
            });
            logger.info("=======================================\n");
          }

          // Log statistics
          const stats = await CPTrackerDataUpdater.getUpdateStats();
          logger.info(
            `CPTracker Statistics: ` +
              `Total: ${stats.totalProfiles}, Active: ${stats.activeProfiles}, ` +
              `Recently Updated: ${stats.recentlyUpdated}, Needs Update: ${stats.needsUpdate}`,
          );
        } catch (error) {
          logger.error("CPTracker update failed:", error);
        }
      },
      {
        timezone: "Asia/Kolkata", // Indian timezone
      },
    );

    // Stop the job initially since we want to control when it starts
    job.stop();
    this.jobs.set("dailyUpdate", job);
    logger.info(
      "CPTracker update cron job scheduled (every 30 seconds for testing)",
    );
  }

  // Schedule weekly cleanup
  private static scheduleWeeklyCleanup(): void {
    const job = cron.schedule(
      "0 3 * * 0", // Every Sunday at 3:00 AM
      async () => {
        try {
          logger.info("🧹 Starting weekly CPTracker cleanup...");

          const cleanedCount = await CPTrackerDataUpdater.cleanupProfiles();

          logger.info(
            `Weekly cleanup completed. Cleaned ${cleanedCount} inactive profiles`,
          );
        } catch (error) {
          logger.error("Weekly CPTracker cleanup failed:", error);
        }
      },
      {
        timezone: "Asia/Kolkata",
      },
    );

    // Stop the job initially since we want to control when it starts
    job.stop();
    this.jobs.set("weeklyCleanup", job);
    logger.info(
      "Weekly CPTracker cleanup cron job scheduled (Sunday 3:00 AM IST)",
    );
  }

  // Schedule batch updates every 6 hours
  private static scheduleBatchUpdates(): void {
    const job = cron.schedule(
      "0 */6 * * *", // Every 6 hours
      async () => {
        try {
          logger.info("⚡ Starting 6-hourly batch updates...");

          // Get statistics to see if updates are needed
          const stats = await CPTrackerDataUpdater.getUpdateStats();

          if (stats.needsUpdate > 0) {
            logger.info(
              `Found ${stats.needsUpdate} profiles that need updates`,
            );

            const result = await CPTrackerDataUpdater.updateAllProfiles();

            logger.info(
              `Batch update completed. Success: ${result.success}, Failed: ${result.failed}`,
            );
          } else {
            logger.info("All profiles are up to date, skipping batch update");
          }
        } catch (error) {
          logger.error("Batch CPTracker update failed:", error);
        }
      },
      {
        timezone: "Asia/Kolkata",
      },
    );

    // Stop the job initially since we want to control when it starts
    job.stop();
    this.jobs.set("batchUpdate", job);
    logger.info("Batch CPTracker update cron job scheduled (every 6 hours)");
  }

  // Start all cron jobs
  static startAllJobs(): void {
    logger.info("Starting all CPTracker cron jobs...");

    this.jobs.forEach((job, name) => {
      job.start();
      logger.info(`Started cron job: ${name}`);
    });

    logger.info(` All ${this.jobs.size} CPTracker cron jobs are now running`);
  }

  // Stop all cron jobs
  static stopAllJobs(): void {
    logger.info("Stopping all CPTracker cron jobs...");

    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`⏹️ Stopped cron job: ${name}`);
    });

    logger.info("⏹️ All CPTracker cron jobs stopped");
  }

  // Stop specific cron job
  static stopJob(jobName: string): boolean {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      logger.info(`⏹️ Stopped cron job: ${jobName}`);
      return true;
    } else {
      logger.warn(`Cron job not found: ${jobName}`);
      return false;
    }
  }

  // Start specific cron job
  static startJob(jobName: string): boolean {
    const job = this.jobs.get(jobName);
    if (job) {
      job.start();
      logger.info(`Started cron job: ${jobName}`);
      return true;
    } else {
      logger.warn(`Cron job not found: ${jobName}`);
      return false;
    }
  }

  // Get status of all cron jobs
  static getJobsStatus(): Array<{
    name: string;
    running: boolean;
    schedule: string;
  }> {
    const status: Array<{ name: string; running: boolean; schedule: string }> =
      [];

    const jobDetails = [
      { name: "dailyUpdate", schedule: "Every 30 seconds (Testing Mode)" },
      { name: "weeklyCleanup", schedule: "Weekly on Sunday at 3:00 AM IST" },
      { name: "batchUpdate", schedule: "Every 6 hours" },
    ];

    jobDetails.forEach((detail) => {
      const job = this.jobs.get(detail.name);
      status.push({
        name: detail.name,
        running: job ? job.getStatus() === "scheduled" : false,
        schedule: detail.schedule,
      });
    });

    return status;
  }

  // Manual trigger for immediate update
  static async triggerManualUpdate(
    type: "all" | "batch",
    batchId?: string,
  ): Promise<any> {
    try {
      logger.info(` Manual CPTracker update triggered: ${type}`);

      let result;
      if (type === "all") {
        result = await CPTrackerDataUpdater.updateAllProfiles();
      } else if (type === "batch" && batchId) {
        result = await CPTrackerDataUpdater.updateBatchProfiles(batchId);
      } else {
        throw new Error("Invalid manual update type or missing batchId");
      }

      logger.info(
        `Manual update completed: Success: ${result.success}, Failed: ${result.failed}, Total: ${result.total}`,
      );

      return result;
    } catch (error) {
      logger.error("Manual CPTracker update failed:", error);
      throw error;
    }
  }

  // Get next run times for all jobs
  static getNextRunTimes(): Array<{ name: string; nextRun: Date | null }> {
    const nextRuns: Array<{ name: string; nextRun: Date | null }> = [];

    this.jobs.forEach((job, name) => {
      // Note: node-cron doesn't provide direct access to next run time
      // This is a simplified approach
      nextRuns.push({
        name,
        nextRun: null, // Would need additional library like cron-parser for exact times
      });
    });

    return nextRuns;
  }

  // Create custom cron job for specific batch
  static createBatchSpecificJob(
    batchId: string,
    cronExpression: string,
  ): boolean {
    try {
      const jobName = `batch_${batchId}`;

      if (this.jobs.has(jobName)) {
        logger.warn(`Cron job already exists for batch: ${batchId}`);
        return false;
      }

      const job = cron.schedule(
        cronExpression,
        async () => {
          try {
            logger.info(`🎯 Running custom update for batch: ${batchId}`);

            const result =
              await CPTrackerDataUpdater.updateBatchProfiles(batchId);

            logger.info(
              `Batch ${batchId} update completed: Success: ${result.success}, Failed: ${result.failed}`,
            );
          } catch (error) {
            logger.error(`Batch ${batchId} update failed:`, error);
          }
        },
        {
          timezone: "Asia/Kolkata",
        },
      );

      this.jobs.set(jobName, job);
      logger.info(
        `Custom cron job created for batch ${batchId}: ${cronExpression}`,
      );

      return true;
    } catch (error) {
      logger.error(
        `Failed to create custom cron job for batch ${batchId}:`,
        error,
      );
      return false;
    }
  }

  // Remove custom batch job
  static removeBatchJob(batchId: string): boolean {
    const jobName = `batch_${batchId}`;
    const job = this.jobs.get(jobName);

    if (job) {
      job.destroy();
      this.jobs.delete(jobName);
      logger.info(`Removed custom cron job for batch: ${batchId}`);
      return true;
    } else {
      logger.warn(`No custom cron job found for batch: ${batchId}`);
      return false;
    }
  }

  // Graceful shutdown
  static shutdown(): void {
    logger.info("Shutting down CPTracker cron service...");

    this.jobs.forEach((job, name) => {
      job.destroy();
      logger.info(`🛑 Destroyed cron job: ${name}`);
    });

    this.jobs.clear();
    logger.info("CPTracker cron service shutdown complete");
  }
}
