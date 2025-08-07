import axios from "axios";
import * as cheerio from "cheerio";
import { getLogger } from "../utils/logger";

const logger = getLogger();

export interface LeetCodeStats {
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  contestSolvedCount: number; // LCCSC - calculated from contest history
  practiceSolvedCount: number; // LCPSC - calculated as total - contest
  acceptanceRate: number;
  ranking: number;
  contributionPoints: number;
  reputation: number;
  contestsParticipated: number;
  currentRating: number;
}

export interface CodeForcesStats {
  handle: string;
  rating: number;
  maxRating: number;
  rank: string;
  maxRank: string;
  contribution: number;
}

export interface CodeChefStats {
  username: string;
  rating: number;
  maxRating: number;
  stars: string;
  division: number;
  countryRank: number;
  globalRank: number;
  contests: number;
  problemsSolved: number;
}

export interface AtCoderStats {
  username: string;
  rating: number;
  maxRating: number;
  rank: string;
  kyu: number;
  competitions: number;
  wins: number;
}

export class CPPlatformCrawler {
  private static readonly TIMEOUT = 10000; // 10 seconds timeout

  // LeetCode GraphQL API
  static async getLeetCodeStats(
    username: string,
  ): Promise<LeetCodeStats | null> {
    try {
      // Try simpler query first to avoid 400 errors
      const simpleQuery = `
        query userPublicProfile($username: String!) {
          matchedUser(username: $username) {
            username
            submitStatsGlobal {
              acSubmissionNum {
                difficulty
                count
                submissions
              }
            }
          }
        }
      `;

      const response = await axios.post(
        "https://leetcode.com/graphql",
        {
          query: simpleQuery,
          variables: { username },
        },
        {
          timeout: this.TIMEOUT,
          headers: {
            "Content-Type": "application/json",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            Referer: "https://leetcode.com/",
            Accept: "application/json",
            "Accept-Language": "en-US,en;q=0.9",
          },
        },
      );

      if (response.data.errors) {
        logger.warn(
          `LeetCode GraphQL errors for ${username}:`,
          response.data.errors,
        );
        // Try fallback approach
        return await this.getLeetCodeStatsFallback(username);
      }

      const userData = response.data.data?.matchedUser;
      if (!userData) {
        logger.warn(`LeetCode user not found: ${username}`);
        return await this.getLeetCodeStatsFallback(username);
      }

      const acSubmissions = userData.submitStatsGlobal?.acSubmissionNum || [];

      // Get contest data separately
      const contestData = await this.getLeetCodeContests(username);

      const stats = {
        totalSolved: 0,
        easySolved: 0,
        mediumSolved: 0,
        hardSolved: 0,
        contestSolvedCount: contestData.contestSolved || 0, // Use contest solved count from contest data
        practiceSolvedCount: 0,
        acceptanceRate: 0,
        ranking: 0,
        contributionPoints: 0,
        reputation: 0,
        contestsParticipated: contestData.participated,
        currentRating: contestData.rating,
      };

      acSubmissions.forEach((submission: any) => {
        const count = submission.count;
        stats.totalSolved += count;

        switch (submission.difficulty) {
          case "Easy":
            stats.easySolved = count;
            break;
          case "Medium":
            stats.mediumSolved = count;
            break;
          case "Hard":
            stats.hardSolved = count;
            break;
        }
      });

      // Calculate practice solved count (total - contest problems)
      stats.practiceSolvedCount = Math.max(
        0,
        stats.totalSolved - stats.contestSolvedCount,
      );

      logger.info(
        `LeetCode stats fetched for ${username}: ${stats.totalSolved} total (${stats.contestSolvedCount} contest, ${stats.practiceSolvedCount} practice), ${stats.contestsParticipated} contests, rating: ${stats.currentRating}`,
      );
      return stats;
    } catch (error) {
      if (error.response?.status === 400) {
        logger.error(
          `LeetCode API returned 400 for ${username}. Trying fallback approach.`,
        );
        return await this.getLeetCodeStatsFallback(username);
      } else {
        logger.error(
          `Error fetching LeetCode stats for ${username}:`,
          error.message,
        );
      }
      return null;
    }
  }

  // Fallback method for LeetCode when main API fails
  static async getLeetCodeStatsFallback(
    username: string,
  ): Promise<LeetCodeStats | null> {
    try {
      logger.info(`Trying LeetCode fallback approach for ${username}`);

      // Try to scrape from profile page
      let totalSolved = 0;
      let easySolved = 0;
      let mediumSolved = 0;
      let hardSolved = 0;

      try {
        const profileUrl = `https://leetcode.com/${username}/`;
        const profileResponse = await axios.get(profileUrl, {
          timeout: this.TIMEOUT,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          },
        });

        const profileHtml = profileResponse.data;

        // Look for problem counts in the HTML
        const totalMatch = profileHtml.match(/(\d+)\s*\/\s*\d+\s*Solved/i);
        if (totalMatch) {
          totalSolved = parseInt(totalMatch[1]);
        }

        // Look for difficulty breakdown
        const easyMatch = profileHtml.match(/Easy[^:]*:\s*(\d+)/i);
        if (easyMatch) {
          easySolved = parseInt(easyMatch[1]);
        }

        const mediumMatch = profileHtml.match(/Medium[^:]*:\s*(\d+)/i);
        if (mediumMatch) {
          mediumSolved = parseInt(mediumMatch[1]);
        }

        const hardMatch = profileHtml.match(/Hard[^:]*:\s*(\d+)/i);
        if (hardMatch) {
          hardSolved = parseInt(hardMatch[1]);
        }

        logger.info(
          `Scraped LeetCode profile for ${username}: ${totalSolved} total problems`,
        );
      } catch (scrapeError) {
        logger.warn(
          `Profile scraping failed for ${username}:`,
          scrapeError.message,
        );
      }

      // Get contest data which seems to be working
      const contestData = await this.getLeetCodeContests(username);

      // Return stats with scraped and contest data
      const stats = {
        totalSolved: totalSolved,
        easySolved: easySolved,
        mediumSolved: mediumSolved,
        hardSolved: hardSolved,
        contestSolvedCount: contestData.contestSolved,
        practiceSolvedCount: Math.max(
          0,
          totalSolved - contestData.contestSolved,
        ),
        acceptanceRate: 0,
        ranking: 0,
        contributionPoints: 0,
        reputation: 0,
        contestsParticipated: contestData.participated,
        currentRating: contestData.rating,
      };

      logger.info(
        `LeetCode fallback stats for ${username}: ${totalSolved} total, contests: ${stats.contestsParticipated}, rating: ${stats.currentRating}`,
      );
      return stats;
    } catch (error) {
      logger.error(
        `LeetCode fallback also failed for ${username}:`,
        error.message,
      );
      return null;
    }
  }

  // CodeForces API
  static async getCodeForcesStats(
    handle: string,
  ): Promise<CodeForcesStats | null> {
    try {
      const response = await axios.get(
        `https://codeforces.com/api/user.info?handles=${handle}`,
        {
          timeout: this.TIMEOUT,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        },
      );

      if (response.data.status !== "OK" || !response.data.result.length) {
        logger.warn(`CodeForces user not found: ${handle}`);
        return null;
      }

      const userData = response.data.result[0];
      const stats: CodeForcesStats = {
        handle: userData.handle,
        rating: userData.rating || 0,
        maxRating: userData.maxRating || 0,
        rank: userData.rank || "unrated",
        maxRank: userData.maxRank || "unrated",
        contribution: userData.contribution || 0,
      };

      logger.info(
        `CodeForces stats fetched for ${handle}: ${stats.rating} rating`,
      );
      return stats;
    } catch (error) {
      logger.error(
        `Error fetching CodeForces stats for ${handle}:`,
        error.message,
      );
      return null;
    }
  }

  // CodeChef scraping (no official API)
  static async getCodeChefStats(
    username: string,
  ): Promise<CodeChefStats | null> {
    try {
      logger.info(`Fetching CodeChef stats for: ${username}`);

      const profileUrl = `https://www.codechef.com/users/${username}`;

      const response = await axios.get(profileUrl, {
        timeout: this.TIMEOUT,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      });

      const $ = cheerio.load(response.data);

      // Extract rating information
      const ratingElement = $(".rating-number");
      const rating =
        ratingElement.length > 0
          ? parseInt(ratingElement.first().text().trim()) || 0
          : 0;

      // Extract highest rating
      const highestRatingElement = $(".rating-header .inline-list li");
      let maxRating = rating;
      highestRatingElement.each((i, element) => {
        const text = $(element).text();
        if (text.includes("Highest Rating")) {
          const ratingMatch = text.match(/(\d+)/);
          if (ratingMatch) {
            maxRating = parseInt(ratingMatch[1]);
          }
        }
      });

      // Extract stars
      const starsElement = $(".rating");
      let stars = "0★";
      if (starsElement.length > 0) {
        const starText = starsElement.text();
        const starMatch = starText.match(/(\d+)\s*★/);
        if (starMatch) {
          stars = `${starMatch[1]}★`;
        }
      }

      // Extract contest participation and problems solved with better selectors
      let contests = 0;
      let problemsSolved = 0;

      // Try multiple approaches to find contest count
      $(".rating-header").each((i, element) => {
        const text = $(element).text();
        const contestMatch = text.match(/(\d+)\s*contests?/i);
        if (contestMatch) {
          contests = Math.max(contests, parseInt(contestMatch[1]));
        }
      });

      // Try rating table for contest info
      $(".rating-data-section table tr").each((i, row) => {
        const rowText = $(row).text();
        if (rowText.includes("Contests")) {
          const contestMatch = rowText.match(/(\d+)/);
          if (contestMatch) {
            contests = Math.max(contests, parseInt(contestMatch[1]));
          }
        }
      });

      // Extract problems solved with better selectors for current CodeChef structure
      $(".problem-solved-count, .number-solved, .stats-number").each(
        (i, element) => {
          const text = $(element).text().trim();
          const problemsMatch = text.match(/(\d+)/);
          if (problemsMatch) {
            problemsSolved = Math.max(
              problemsSolved,
              parseInt(problemsMatch[1]),
            );
          }
        },
      );

      // Try finding problems in profile stats section
      $(
        ".rating-data-section .stat-item, .profile-info-list li, .user-stats .stat",
      ).each((i, element) => {
        const text = $(element).text();
        // Look for patterns like "Problems Solved: 123" or "123 Problems"
        if (text.toLowerCase().includes("problem")) {
          const problemsMatch = text.match(/(\d+)/);
          if (problemsMatch) {
            const count = parseInt(problemsMatch[1]);
            if (count > problemsSolved && count < 10000) {
              // Sanity check
              problemsSolved = count;
            }
          }
        }
      });

      // Look in user details or stats tables
      $("table tr, .user-details-container .row, .stats-row").each(
        (i, element) => {
          const text = $(element).text();
          if (
            text.toLowerCase().includes("problem") &&
            text.toLowerCase().includes("solved")
          ) {
            const problemsMatch = text.match(/(\d+)/);
            if (problemsMatch) {
              const count = parseInt(problemsMatch[1]);
              if (count > problemsSolved && count < 10000) {
                // Sanity check
                problemsSolved = count;
              }
            }
          }
        },
      );

      // Alternative approach: Look for numbers near "problem" text
      if (problemsSolved === 0) {
        const bodyText = $("body").text();
        const problemsPattern =
          /problems?\s*solved\s*[:-]?\s*(\d+)|(\d+)\s*problems?\s*solved/gi;
        const matches = bodyText.match(problemsPattern);
        if (matches) {
          matches.forEach((match) => {
            const numbers = match.match(/\d+/g);
            if (numbers) {
              const count = parseInt(numbers[0]);
              if (count > problemsSolved && count < 10000) {
                problemsSolved = count;
              }
            }
          });
        }
      }

      // Fallback: scan entire content for patterns
      if (contests === 0) {
        const fullText = $("body").text();
        const contestMatches = fullText.match(/(\d+)\s*contest/gi);
        if (contestMatches) {
          contests = Math.max(
            ...contestMatches.map((m) => parseInt(m.match(/\d+/)[0])),
          );
        }
      }

      logger.info(
        `CodeChef parsing for ${username}: Rating: ${rating}, Contests: ${contests}, Problems: ${problemsSolved}`,
      );

      const stats: CodeChefStats = {
        username,
        rating,
        maxRating,
        stars,
        division: rating >= 2000 ? 1 : rating >= 1600 ? 2 : 3,
        countryRank: 0, // Would need additional API calls
        globalRank: 0, // Would need additional API calls
        contests,
        problemsSolved,
      };

      logger.info(`CodeChef stats retrieved for ${username}:`, stats);
      return stats;
    } catch (error) {
      logger.error(
        `Error fetching CodeChef stats for ${username}:`,
        error.message,
      );

      // Return default stats if scraping fails
      return {
        username,
        rating: 0,
        maxRating: 0,
        stars: "0★",
        division: 3,
        countryRank: 0,
        globalRank: 0,
        contests: 0,
        problemsSolved: 0,
      };
    }
  }

  // AtCoder API
  static async getAtCoderStats(username: string): Promise<AtCoderStats | null> {
    try {
      // AtCoder has unofficial APIs, using a public one
      const response = await axios.get(
        `https://kenkoooo.com/atcoder/atcoder-api/results?user=${username}`,
        {
          timeout: this.TIMEOUT,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        },
      );

      if (!response.data || response.data.length === 0) {
        logger.warn(`AtCoder user not found: ${username}`);
        return null;
      }

      // Get user info from another endpoint
      const userInfoResponse = await axios.get(
        `https://kenkoooo.com/atcoder/atcoder-api/user_info?user=${username}`,
        {
          timeout: this.TIMEOUT,
        },
      );

      const userInfo = userInfoResponse.data;
      const problemResults = response.data;

      const stats: AtCoderStats = {
        username,
        rating: userInfo?.rating || 0,
        maxRating: userInfo?.max_rating || 0,
        rank: this.getAtCoderRank(userInfo?.rating || 0),
        kyu: 0, // AtCoder doesn't use kyu system anymore
        competitions: 0, // Would need contest participation data
        wins: 0, // Would need detailed contest results
      };

      logger.info(
        `AtCoder stats fetched for ${username}: ${stats.rating} rating, ${problemResults.length} submissions`,
      );
      return stats;
    } catch (error) {
      logger.error(
        `Error fetching AtCoder stats for ${username}:`,
        error.message,
      );
      return null;
    }
  }

  // Helper method to determine AtCoder rank based on rating
  private static getAtCoderRank(rating: number): string {
    if (rating >= 3200) return "Red";
    if (rating >= 2800) return "Orange";
    if (rating >= 2400) return "Yellow";
    if (rating >= 2000) return "Blue";
    if (rating >= 1600) return "Cyan";
    if (rating >= 1200) return "Green";
    if (rating >= 800) return "Brown";
    if (rating >= 400) return "Gray";
    return "Unrated";
  }

  // Get contest participation count for CodeForces
  static async getCodeForcesContests(handle: string): Promise<number> {
    try {
      const response = await axios.get(
        `https://codeforces.com/api/user.rating?handle=${handle}`,
        {
          timeout: this.TIMEOUT,
        },
      );

      if (response.data.status === "OK") {
        return response.data.result.length;
      }
      return 0;
    } catch (error) {
      logger.error(
        `Error fetching CodeForces contest count for ${handle}:`,
        error.message,
      );
      return 0;
    }
  }

  // Get problem count for CodeForces
  static async getCodeForcesProblems(handle: string): Promise<number> {
    try {
      const response = await axios.get(
        `https://codeforces.com/api/user.status?handle=${handle}`,
        {
          timeout: this.TIMEOUT,
        },
      );

      if (response.data.status === "OK") {
        // Count unique problems that were accepted
        const acceptedProblems = new Set();
        response.data.result.forEach((submission: any) => {
          if (submission.verdict === "OK") {
            acceptedProblems.add(
              `${submission.problem.contestId}-${submission.problem.index}`,
            );
          }
        });
        return acceptedProblems.size;
      }
      return 0;
    } catch (error) {
      logger.error(
        `Error fetching CodeForces problem count for ${handle}:`,
        error.message,
      );
      return 0;
    }
  }

  // Get LeetCode contest stats
  static async getLeetCodeContests(username: string): Promise<{
    participated: number;
    rating: number;
    maxRating: number;
    contestSolved: number;
    lastContestDate: string | null;
    lastContestName: string | null;
  }> {
    try {
      // First try simpler query to avoid 400 errors
      const query = `
        query userContestRankingInfo($username: String!) {
          userContestRanking(username: $username) {
            attendedContestsCount
            rating
            globalRanking
            totalParticipants
            topPercentage
            badge {
              name
            }
          }
        }
      `;

      const response = await axios.post(
        "https://leetcode.com/graphql",
        {
          query,
          variables: { username },
        },
        {
          timeout: this.TIMEOUT,
          headers: {
            "Content-Type": "application/json",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            Referer: "https://leetcode.com/",
          },
        },
      );

      const contestData = response.data.data?.userContestRanking;

      if (!contestData) {
        logger.warn(`No LeetCode contest data found for ${username}`);
        return {
          participated: 0,
          rating: 0,
          maxRating: 0,
          contestSolved: 0,
          lastContestDate: null,
          lastContestName: null,
        };
      }

      // Try to get contest history with a separate request if needed
      let contestHistory = [];
      let maxRating = contestData.rating || 0;
      let contestSolved = 0;
      let lastContestDate = null;
      let lastContestName = null;

      try {
        const historyQuery = `
          query userContestRankingHistory($username: String!) {
            userContestRankingHistory(username: $username) {
              attended
              trendDirection
              problemsSolved
              totalProblems
              finishTimeInSeconds
              rating
              ranking
              contest {
                title
                startTime
              }
            }
          }
        `;

        const historyResponse = await axios.post(
          "https://leetcode.com/graphql",
          {
            query: historyQuery,
            variables: { username },
          },
          {
            timeout: this.TIMEOUT,
            headers: {
              "Content-Type": "application/json",
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
              Referer: "https://leetcode.com/",
            },
          },
        );

        contestHistory =
          historyResponse.data.data?.userContestRankingHistory || [];

        if (contestHistory.length > 0) {
          maxRating = Math.max(
            maxRating,
            ...contestHistory.map((h: any) => h.rating || 0),
          );

          // Calculate total problems solved in contests
          contestSolved = contestHistory.reduce(
            (total: number, contest: any) => {
              return total + (contest.problemsSolved || 0);
            },
            0,
          );

          // Get last contest information
          const sortedHistory = contestHistory
            .filter((h: any) => h.attended && h.contest)
            .sort(
              (a: any, b: any) => b.contest.startTime - a.contest.startTime,
            );

          if (sortedHistory.length > 0) {
            const lastContest = sortedHistory[0];
            lastContestDate = new Date(
              lastContest.contest.startTime * 1000,
            ).toISOString();
            lastContestName = lastContest.contest.title;
          }
        }
      } catch (historyError) {
        logger.warn(
          `Could not fetch contest history for ${username}:`,
          historyError.message,
        );
      }

      logger.info(
        `LeetCode contests for ${username}: ${contestData?.attendedContestsCount || 0} participated, rating: ${contestData?.rating || 0}, contest problems solved: ${contestSolved}, last contest: ${lastContestName || "None"}`,
      );

      return {
        participated: contestData?.attendedContestsCount || 0,
        rating: contestData?.rating || 0,
        maxRating,
        contestSolved,
        lastContestDate,
        lastContestName,
      };
    } catch (error) {
      logger.error(
        `Error fetching LeetCode contest stats for ${username}:`,
        error.message,
      );
      return {
        participated: 0,
        rating: 0,
        maxRating: 0,
        contestSolved: 0,
        lastContestDate: null,
        lastContestName: null,
      };
    }
  }
}
