import axios from "axios";
import { logger } from "../utils/logger";

export interface Judge0Submission {
  source_code: string;
  language_id: number;
  stdin?: string;
  expected_output?: string;
  cpu_time_limit?: number;
  memory_limit?: number;
  wall_time_limit?: number;
}

export interface Judge0Result {
  token: string;
  status: {
    id: number;
    description: string;
  };
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  message?: string;
  time?: string;
  memory?: number;
  exit_code?: number;
}

export interface TestCaseResult {
  input: string;
  expected_output: string;
  actual_output: string;
  status: "PASSED" | "FAILED" | "ERROR";
  execution_time?: number;
  memory_used?: number;
  error_message?: string;
}

export class Judge0Service {
  private static readonly BASE_URL = "http://159.89.166.122:2358";
  private static readonly TIMEOUT = 30000; // 30 seconds

  // Language ID mappings for Judge0
  private static readonly LANGUAGE_MAP: Record<string, number> = {
    javascript: 63,
    python: 71,
    java: 62,
    cpp: 54,
    c: 50,
    csharp: 51,
    php: 68,
    ruby: 72,
    go: 60,
    rust: 73,
    kotlin: 78,
    swift: 83,
    typescript: 74,
  };

  /**
   * Submit code to Judge0 for execution
   */
  static async submitCode(submission: Judge0Submission): Promise<string> {
    try {
      const response = await axios.post(
        `${this.BASE_URL}/submissions?base64_encoded=false&wait=false`,
        submission,
        {
          timeout: this.TIMEOUT,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.data.token) {
        throw new Error("No token returned from Judge0");
      }

      return response.data.token;
    } catch (error: any) {
      logger.error("Error submitting to Judge0:", error);
      throw new Error(`Judge0 submission failed: ${error.message}`);
    }
  }

  /**
   * Get execution result from Judge0
   */
  static async getResult(token: string): Promise<Judge0Result> {
    try {
      const response = await axios.get(
        `${this.BASE_URL}/submissions/${token}?base64_encoded=false`,
        {
          timeout: this.TIMEOUT,
        },
      );

      return response.data;
    } catch (error: any) {
      logger.error("Error getting Judge0 result:", error);
      throw new Error(`Judge0 result fetch failed: ${error.message}`);
    }
  }

  /**
   * Wait for submission to complete and return result
   */
  static async waitForResult(
    token: string,
    maxWaitTime = 30000,
  ): Promise<Judge0Result> {
    const startTime = Date.now();
    const pollInterval = 1000; // 1 second

    while (Date.now() - startTime < maxWaitTime) {
      const result = await this.getResult(token);

      // Status IDs: 1 = In Queue, 2 = Processing
      if (result.status.id !== 1 && result.status.id !== 2) {
        return result;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error("Judge0 execution timeout");
  }

  /**
   * Execute code with multiple test cases
   */
  static async executeWithTestCases(
    sourceCode: string,
    language: string,
    testCases: Array<{ input: string; expected_output: string }>,
    timeLimitMs = 5000,
    memoryLimitMb = 256,
  ): Promise<TestCaseResult[]> {
    const languageId = this.getLanguageId(language);
    const results: TestCaseResult[] = [];

    for (const testCase of testCases) {
      try {
        const submission: Judge0Submission = {
          source_code: sourceCode,
          language_id: languageId,
          stdin: testCase.input,
          cpu_time_limit: timeLimitMs / 1000, // Convert to seconds
          memory_limit: memoryLimitMb * 1024, // Convert to KB
          wall_time_limit: (timeLimitMs + 2000) / 1000, // Add buffer
        };

        const token = await this.submitCode(submission);
        const result = await this.waitForResult(token);

        const testResult: TestCaseResult = {
          input: testCase.input,
          expected_output: testCase.expected_output,
          actual_output: result.stdout || "",
          status: this.determineTestCaseStatus(
            result,
            testCase.expected_output,
          ),
          execution_time: result.time
            ? parseFloat(result.time) * 1000
            : undefined,
          memory_used: result.memory ? result.memory / 1024 : undefined, // Convert to MB
          error_message:
            result.stderr ||
            result.compile_output ||
            result.message ||
            undefined,
        };

        results.push(testResult);
      } catch (error: any) {
        logger.error(`Error executing test case:`, error);
        results.push({
          input: testCase.input,
          expected_output: testCase.expected_output,
          actual_output: "",
          status: "ERROR",
          error_message: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Get language ID for Judge0
   */
  private static getLanguageId(language: string): number {
    const normalizedLang = language.toLowerCase();
    const languageId = this.LANGUAGE_MAP[normalizedLang];

    if (!languageId) {
      throw new Error(`Unsupported programming language: ${language}`);
    }

    return languageId;
  }

  /**
   * Determine if test case passed
   */
  private static determineTestCaseStatus(
    result: Judge0Result,
    expectedOutput: string,
  ): "PASSED" | "FAILED" | "ERROR" {
    // Check for compilation or runtime errors
    if (result.status.id === 6) {
      // Compilation Error
      return "ERROR";
    }

    if (result.status.id === 5) {
      // Time Limit Exceeded
      return "ERROR";
    }

    if (result.status.id === 4) {
      // Wrong Answer (but executed successfully)
      return "FAILED";
    }

    if (result.status.id !== 3) {
      // Not Accepted
      return "ERROR";
    }

    // Compare outputs (normalize whitespace)
    const actualOutput = (result.stdout || "").trim();
    const expected = expectedOutput.trim();

    return actualOutput === expected ? "PASSED" : "FAILED";
  }

  /**
   * Get supported programming languages
   */
  static getSupportedLanguages(): Array<{ name: string; id: number }> {
    return Object.entries(this.LANGUAGE_MAP).map(([name, id]) => ({
      name,
      id,
    }));
  }
}
