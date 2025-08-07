/**
 * Test script to verify CPTracker URL patterns and API connectivity
 * Run this to test the correct URL formats for competitive programming platforms
 */

import axios from "axios";

interface TestResult {
  platform: string;
  username: string;
  url: string;
  accessible: boolean;
  error?: string;
}

export class CPTrackerURLTester {
  static async testLeetCodeURL(username: string): Promise<TestResult> {
    const url = `https://leetcode.com/u/${username}/`;

    try {
      // Test GraphQL API instead of profile page
      const response = await axios.post(
        "https://leetcode.com/graphql",
        {
          query: `
            query userPublicProfile($username: String!) {
              matchedUser(username: $username) {
                username
                profile {
                  realName
                }
              }
            }
          `,
          variables: { username },
        },
        {
          timeout: 10000,
          headers: {
            "Content-Type": "application/json",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        },
      );

      const userExists = response.data?.data?.matchedUser !== null;

      return {
        platform: "LeetCode",
        username,
        url,
        accessible: userExists,
      };
    } catch (error: any) {
      return {
        platform: "LeetCode",
        username,
        url,
        accessible: false,
        error: error.message,
      };
    }
  }

  static async testCodeForcesURL(handle: string): Promise<TestResult> {
    const profileUrl = `https://codeforces.com/profile/${handle}`;

    try {
      // Test API instead of profile page
      const response = await axios.get(
        `https://codeforces.com/api/user.info?handles=${handle}`,
        {
          timeout: 10000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        },
      );

      const userExists =
        response.data.status === "OK" && response.data.result.length > 0;

      return {
        platform: "CodeForces",
        username: handle,
        url: profileUrl,
        accessible: userExists,
      };
    } catch (error: any) {
      return {
        platform: "CodeForces",
        username: handle,
        url: profileUrl,
        accessible: false,
        error: error.message,
      };
    }
  }

  static async testCodeChefURL(username: string): Promise<TestResult> {
    const url = `https://www.codechef.com/users/${username}`;

    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      // Check if page doesn't contain "user does not exist" or similar error messages
      const accessible =
        response.status === 200 &&
        !response.data.includes("user does not exist") &&
        !response.data.includes("404");

      return {
        platform: "CodeChef",
        username,
        url,
        accessible,
      };
    } catch (error: any) {
      return {
        platform: "CodeChef",
        username,
        url,
        accessible: false,
        error: error.message,
      };
    }
  }

  static async testAtCoderURL(username: string): Promise<TestResult> {
    const url = `https://atcoder.jp/users/${username}`;

    try {
      // Test using the unofficial API
      const response = await axios.get(
        `https://kenkoooo.com/atcoder/atcoder-api/user_info?user=${username}`,
        {
          timeout: 10000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        },
      );

      const userExists = response.data && typeof response.data === "object";

      return {
        platform: "AtCoder",
        username,
        url,
        accessible: userExists,
      };
    } catch (error: any) {
      return {
        platform: "AtCoder",
        username,
        url,
        accessible: false,
        error: error.message,
      };
    }
  }

  /**
   * Test all platforms with given usernames
   */
  static async testAllPlatforms(usernames: {
    leetcode?: string;
    codeforces?: string;
    codechef?: string;
    atcoder?: string;
  }): Promise<TestResult[]> {
    const results: TestResult[] = [];

    if (usernames.leetcode) {
      results.push(await this.testLeetCodeURL(usernames.leetcode));
    }

    if (usernames.codeforces) {
      results.push(await this.testCodeForcesURL(usernames.codeforces));
    }

    if (usernames.codechef) {
      results.push(await this.testCodeChefURL(usernames.codechef));
    }

    if (usernames.atcoder) {
      results.push(await this.testAtCoderURL(usernames.atcoder));
    }

    return results;
  }

  /**
   * Print test results in a nice format
   */
  static printResults(results: TestResult[]): void {
    console.log("\n🏆 CPTracker URL Test Results");
    console.log("================================\n");

    results.forEach((result) => {
      const status = result.accessible ? "✅ ACCESSIBLE" : "NOT ACCESSIBLE";
      const errorMsg = result.error ? ` (${result.error})` : "";

      console.log(`${result.platform}:`);
      console.log(`  Username: ${result.username}`);
      console.log(`  URL: ${result.url}`);
      console.log(`  Status: ${status}${errorMsg}`);
      console.log("");
    });
  }
}

// Example usage:
/*
async function runTests() {
  const testUsernames = {
    leetcode: 'suraj-9849',
    codeforces: 'mr_suraj_99',
    codechef: 'suraj_chef',
    atcoder: 'tourist' // Using a known AtCoder user for testing
  };

  console.log('Testing CPTracker URL patterns...');
  
  const results = await CPTrackerURLTester.testAllPlatforms(testUsernames);
  CPTrackerURLTester.printResults(results);
}

// Uncomment to run tests:
// runTests().catch(console.error);
*/
