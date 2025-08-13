// services/judge0Service.ts

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

export interface ExecutionOptions {
  timeLimit?: number; // in milliseconds
  memoryLimit?: number; // in MB
}

export class Judge0Service {
  private static readonly BASE_URL =
    process.env.JUDGE0_URL || "http://159.89.166.122:2358";
  private static readonly TIMEOUT = 30000; // 30 seconds
  private static readonly MAX_RETRIES = 3;

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
   * Get language ID for Judge0
   */
  private static getLanguageId(language: string): number {
    const languageId = this.LANGUAGE_MAP[language.toLowerCase()];
    if (!languageId) {
      throw new Error(`Unsupported language: ${language}`);
    }
    return languageId;
  }

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
   * Get submission result from Judge0
   */
  static async getResult(token: string): Promise<Judge0Result> {
    let retries = 0;

    while (retries < this.MAX_RETRIES) {
      try {
        const response = await axios.get(
          `${this.BASE_URL}/submissions/${token}?base64_encoded=false`,
          {
            timeout: this.TIMEOUT,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        const result = response.data;

        // Check if execution is still in progress
        if (result.status.id <= 2) {
          // Status 1: In Queue, Status 2: Processing
          await new Promise((resolve) => setTimeout(resolve, 1000));
          retries++;
          continue;
        }

        return result;
      } catch (error: any) {
        logger.error(
          `Error getting result from Judge0 (attempt ${retries + 1}):`,
          error,
        );
        retries++;
        if (retries >= this.MAX_RETRIES) {
          throw new Error(
            `Judge0 result fetch failed after ${this.MAX_RETRIES} attempts: ${error.message}`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    throw new Error("Failed to get result from Judge0");
  }

  /**
   * Execute code against a single test case
   */
  static async executeTestCase(
    code: string,
    language: string,
    input: string,
    expectedOutput: string,
    options: ExecutionOptions = {},
  ): Promise<TestCaseResult> {
    try {
      const languageId = this.getLanguageId(language);

      // Prepare submission
      const submission: Judge0Submission = {
        source_code: code,
        language_id: languageId,
        stdin: input,
        cpu_time_limit: Math.ceil((options.timeLimit || 5000) / 1000), // Convert to seconds
        memory_limit: (options.memoryLimit || 256) * 1024, // Convert to KB
        wall_time_limit: Math.ceil((options.timeLimit || 5000) / 1000) + 2, // Add buffer
      };

      // Submit code
      const token = await this.submitCode(submission);

      // Get result
      const result = await this.getResult(token);

      // Process result
      return this.processTestCaseResult(input, expectedOutput, result);
    } catch (error) {
      logger.error("Test case execution failed:", error);
      return {
        input,
        expected_output: expectedOutput,
        actual_output: "",
        status: "ERROR",
        error_message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Execute code against multiple test cases
   */
  static async executeTestCases(
    code: string,
    language: string,
    testCases: Array<{ input: string; expected_output: string }>,
    options: ExecutionOptions = {},
  ): Promise<TestCaseResult[]> {
    const results: TestCaseResult[] = [];

    // Execute test cases sequentially to avoid overwhelming Judge0
    for (const testCase of testCases) {
      try {
        const result = await this.executeTestCase(
          code,
          language,
          testCase.input,
          testCase.expected_output,
          options,
        );
        results.push(result);
      } catch (error) {
        logger.error("Test case execution failed:", error);
        results.push({
          input: testCase.input,
          expected_output: testCase.expected_output,
          actual_output: "",
          status: "ERROR",
          error_message:
            error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  }

  /**
   * Process Judge0 result into TestCaseResult
   */
  private static processTestCaseResult(
    input: string,
    expectedOutput: string,
    result: Judge0Result,
  ): TestCaseResult {
    const testCaseResult: TestCaseResult = {
      input,
      expected_output: expectedOutput,
      actual_output: "",
      status: "ERROR",
    };

    // Add execution metrics
    if (result.time) {
      testCaseResult.execution_time = parseFloat(result.time) * 1000; // Convert to ms
    }
    if (result.memory) {
      testCaseResult.memory_used = result.memory; // Already in KB
    }

    // Handle different status codes
    switch (result.status.id) {
      case 3: // Accepted
        testCaseResult.actual_output = result.stdout?.trim() || "";
        testCaseResult.status = this.compareOutputs(
          expectedOutput.trim(),
          testCaseResult.actual_output,
        )
          ? "PASSED"
          : "FAILED";
        break;

      case 4: // Wrong Answer
        testCaseResult.actual_output = result.stdout?.trim() || "";
        testCaseResult.status = "FAILED";
        break;

      case 5: // Time Limit Exceeded
        testCaseResult.status = "ERROR";
        testCaseResult.error_message = "Time Limit Exceeded";
        break;

      case 6: // Compilation Error
        testCaseResult.status = "ERROR";
        testCaseResult.error_message = `Compilation Error: ${result.compile_output || "Unknown compilation error"}`;
        break;

      case 7: // Runtime Error (SIGSEGV)
      case 8: // Runtime Error (SIGXFSZ)
      case 9: // Runtime Error (SIGFPE)
      case 10: // Runtime Error (SIGABRT)
      case 11: // Runtime Error (NZEC)
      case 12: // Runtime Error (Other)
        testCaseResult.status = "ERROR";
        testCaseResult.error_message = `Runtime Error: ${result.stderr || result.message || "Unknown runtime error"}`;
        break;

      case 13: // Internal Error
        testCaseResult.status = "ERROR";
        testCaseResult.error_message =
          "Internal Error in execution environment";
        break;

      case 14: // Exec Format Error
        testCaseResult.status = "ERROR";
        testCaseResult.error_message = "Execution format error";
        break;

      default:
        testCaseResult.status = "ERROR";
        testCaseResult.error_message = `Unknown status: ${result.status.description}`;
        if (result.stderr) {
          testCaseResult.error_message += ` - ${result.stderr}`;
        }
        break;
    }

    return testCaseResult;
  }

  /**
   * Compare expected and actual outputs
   */
  private static compareOutputs(expected: string, actual: string): boolean {
    // Normalize whitespace and line endings
    const normalizeOutput = (output: string): string => {
      return output
        .replace(/\r\n/g, "\n") // Convert CRLF to LF
        .replace(/\r/g, "\n") // Convert CR to LF
        .trim() // Remove leading/trailing whitespace
        .replace(/\s+$/gm, "") // Remove trailing whitespace from each line
        .replace(/^\s+/gm, ""); // Remove leading whitespace from each line
    };

    const normalizedExpected = normalizeOutput(expected);
    const normalizedActual = normalizeOutput(actual);

    return normalizedExpected === normalizedActual;
  }

  /**
   * Validate code before submission
   */
  static validateCode(
    code: string,
    language: string,
  ): { isValid: boolean; error?: string } {
    if (!code || code.trim().length === 0) {
      return { isValid: false, error: "Code cannot be empty" };
    }

    // Language-specific basic validation
    switch (language.toLowerCase()) {
      case "javascript":
        if (
          !code.includes("function") &&
          !code.includes("=>") &&
          !code.includes("console.log")
        ) {
          return {
            isValid: false,
            error:
              "JavaScript code should contain at least a function or console.log statement",
          };
        }
        break;

      case "python":
        if (
          !code.includes("def") &&
          !code.includes("print") &&
          !code.includes("input")
        ) {
          return {
            isValid: false,
            error:
              "Python code should contain at least a function definition or print statement",
          };
        }
        break;

      case "java":
        if (!code.includes("class") || !code.includes("main")) {
          return {
            isValid: false,
            error: "Java code must contain a class with a main method",
          };
        }
        break;

      case "cpp":
      case "c":
        if (!code.includes("main")) {
          return {
            isValid: false,
            error: "C/C++ code must contain a main function",
          };
        }
        break;
    }

    return { isValid: true };
  }

  /**
   * Get execution status description
   */
  static getStatusDescription(statusId: number): string {
    const statusMap: Record<number, string> = {
      1: "In Queue",
      2: "Processing",
      3: "Accepted",
      4: "Wrong Answer",
      5: "Time Limit Exceeded",
      6: "Compilation Error",
      7: "Runtime Error (SIGSEGV)",
      8: "Runtime Error (SIGXFSZ)",
      9: "Runtime Error (SIGFPE)",
      10: "Runtime Error (SIGABRT)",
      11: "Runtime Error (NZEC)",
      12: "Runtime Error (Other)",
      13: "Internal Error",
      14: "Exec Format Error",
    };

    return statusMap[statusId] || "Unknown Status";
  }

  /**
   * Get supported languages
   */
  static getSupportedLanguages(): Array<{
    id: string;
    name: string;
    judge0Id: number;
  }> {
    return Object.entries(this.LANGUAGE_MAP).map(([id, judge0Id]) => ({
      id,
      name: this.getLanguageName(id),
      judge0Id,
    }));
  }

  /**
   * Get language display name
   */
  private static getLanguageName(id: string): string {
    const nameMap: Record<string, string> = {
      javascript: "JavaScript",
      python: "Python",
      java: "Java",
      cpp: "C++",
      c: "C",
      csharp: "C#",
      php: "PHP",
      ruby: "Ruby",
      go: "Go",
      rust: "Rust",
      kotlin: "Kotlin",
      swift: "Swift",
      typescript: "TypeScript",
    };

    return nameMap[id] || id.toUpperCase();
  }

  /**
   * Test Judge0 connection
   */
  static async testConnection(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.BASE_URL}/config_info`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      logger.error("Judge0 connection test failed:", error);
      return false;
    }
  }

  /**
   * Get Judge0 system information
   */
  static async getSystemInfo(): Promise<any> {
    try {
      const response = await axios.get(`${this.BASE_URL}/config_info`, {
        timeout: 5000,
      });
      return response.data;
    } catch (error) {
      logger.error("Failed to get Judge0 system info:", error);
      throw error;
    }
  }
}
