/**
 * Utility functions for constructing competitive programming profile URLs
 * Updated with correct URL patterns as per platform requirements
 */

import { getLogger } from "./logger";

const logger = getLogger();

export interface ProfileURLs {
  leetcode?: string;
  codeforces?: string;
  codechef?: string;
  atcoder?: string;
}

export class CPPlatformURLs {
  /**
   * Generate profile URLs for competitive programming platforms
   * @param usernames Object containing usernames for different platforms
   * @returns Object with profile URLs for each platform
   */
  static generateProfileURLs(usernames: {
    leetcode?: string;
    codeforces?: string;
    codechef?: string;
    atcoder?: string;
  }): ProfileURLs {
    const urls: ProfileURLs = {};

    if (usernames.leetcode) {
      // Correct LeetCode URL format: https://leetcode.com/u/username/
      urls.leetcode = `https://leetcode.com/u/${usernames.leetcode}/`;
    }

    if (usernames.codeforces) {
      // Correct CodeForces URL format: https://codeforces.com/profile/handle
      urls.codeforces = `https://codeforces.com/profile/${usernames.codeforces}`;
    }

    if (usernames.codechef) {
      // CodeChef URL format: https://www.codechef.com/users/username
      urls.codechef = `https://www.codechef.com/users/${usernames.codechef}`;
    }

    if (usernames.atcoder) {
      // AtCoder URL format: https://atcoder.jp/users/username
      urls.atcoder = `https://atcoder.jp/users/${usernames.atcoder}`;
    }

    return urls;
  }

  /**
   * Validate username format for different platforms
   */
  static validateUsername(platform: string, username: string): boolean {
    if (!username || username.trim().length === 0) {
      return false;
    }

    const trimmed = username.trim();

    switch (platform.toLowerCase()) {
      case "leetcode":
        // LeetCode usernames: alphanumeric, hyphens, underscores, 1-30 chars
        return /^[a-zA-Z0-9_-]{1,30}$/.test(trimmed);

      case "codeforces":
        // CodeForces handles: alphanumeric, underscores, 3-24 chars
        return /^[a-zA-Z0-9_]{3,24}$/.test(trimmed);

      case "codechef":
        // CodeChef usernames: alphanumeric, underscores, 3-15 chars
        return /^[a-zA-Z0-9_]{3,15}$/.test(trimmed);

      case "atcoder":
        // AtCoder usernames: alphanumeric, underscores, 3-16 chars
        return /^[a-zA-Z0-9_]{3,16}$/.test(trimmed);

      default:
        return false;
    }
  }

  /**
   * Test profile URLs to ensure they're accessible
   * @param urls ProfileURLs object
   * @returns Promise<{ [platform: string]: boolean }>
   */
  static async testProfileURLs(
    urls: ProfileURLs,
  ): Promise<{ [platform: string]: boolean }> {
    const results: { [platform: string]: boolean } = {};

    // Note: This is a basic implementation. In a real application,
    // you might want to do actual HTTP requests to verify accessibility
    // For now, just validate the URL format

    for (const [platform, url] of Object.entries(urls)) {
      if (url) {
        try {
          const urlObj = new URL(url);
          results[platform] =
            urlObj.protocol === "https:" && urlObj.hostname.length > 0;
        } catch (error) {
          logger.error("error : ", error);
          results[platform] = false;
        }
      }
    }

    return results;
  }
}

// Example usage:
/*
const usernames = {
  leetcode: 'suraj-9849',
  codeforces: 'mr_suraj_99',
  codechef: 'suraj_chef',
  atcoder: 'suraj_at'
};

const urls = CPPlatformURLs.generateProfileURLs(usernames);
console.log(urls);
// Output:
// {
//   leetcode: 'https://leetcode.com/u/suraj-9849/',
//   codeforces: 'https://codeforces.com/profile/mr_suraj_99',
//   codechef: 'https://www.codechef.com/users/suraj_chef',
//   atcoder: 'https://atcoder.jp/users/suraj_at'
// }
*/
