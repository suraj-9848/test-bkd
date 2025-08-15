import axios from "axios";

const JUDGE0_API_URL =
  process.env.JUDGE0_API_URL || "http://159.89.166.122:2358";

export interface TestCaseResult {
  input: string;
  expected_output: string;
  actual_output?: string;
  status:
    | "PASSED"
    | "FAILED"
    | "ERROR"
    | "RUNTIME_ERROR"
    | "TIME_LIMIT_EXCEEDED"
    | "COMPILATION_ERROR";
  execution_time?: number;
  memory_used?: number;
  error_message?: string;
  compile_output?: string;
}

export interface ExecutionOptions {
  timeLimit?: number;
  memoryLimit?: number;
}

interface Judge0Submission {
  source_code: string;
  language_id: number;
  stdin?: string;
  expected_output?: string;
  cpu_time_limit?: number;
  memory_limit?: number;
  wall_time_limit?: number;
}

interface Judge0Result {
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

interface LanguageInfo {
  id: string;
  name: string;
  judge0Id: number;
}

export class Judge0Service {
  private static readonly MAX_POLL_ATTEMPTS = 30;
  private static readonly POLL_INTERVAL = 1000;
  private static readonly LANGUAGES: LanguageInfo[] = [
    { id: "javascript", name: "JavaScript (Node.js)", judge0Id: 63 },
    { id: "python", name: "Python 3", judge0Id: 71 },
    { id: "java", name: "Java", judge0Id: 62 },
    { id: "cpp", name: "C++", judge0Id: 54 },
    { id: "c", name: "C", judge0Id: 50 },
    { id: "csharp", name: "C#", judge0Id: 51 },
    { id: "kotlin", name: "Kotlin", judge0Id: 78 },
    { id: "go", name: "Go", judge0Id: 60 },
    { id: "ruby", name: "Ruby", judge0Id: 72 },
    { id: "php", name: "PHP", judge0Id: 68 },
    { id: "typescript", name: "TypeScript", judge0Id: 74 },
    { id: "rust", name: "Rust", judge0Id: 73 },
    { id: "swift", name: "Swift", judge0Id: 83 },
  ];

  /**
   * Get supported programming languages
   */
  static getSupportedLanguages(): LanguageInfo[] {
    return this.LANGUAGES;
  }

  /**
   * Get language info by language ID
   */
  static getLanguage(languageId: string): LanguageInfo | null {
    return this.LANGUAGES.find((lang) => lang.id === languageId) || null;
  }

  /**
   * Submit code to Judge0 for execution
   */
  private static async submitCode(
    submission: Judge0Submission,
  ): Promise<string> {
    try {
      console.log("Submitting to Judge0 (Self-Hosted):", {
        url: JUDGE0_API_URL,
        language_id: submission.language_id,
        stdin_length: submission.stdin?.length || 0,
        source_code_length: submission.source_code.length,
        cpu_time_limit: submission.cpu_time_limit,
        memory_limit: submission.memory_limit,
      });

      const response = await axios.post(
        `${JUDGE0_API_URL}/submissions?base64_encoded=false&wait=false`,
        submission,
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 15000, // 15 second timeout for submission
        },
      );

      if (response.data && response.data.token) {
        console.log(
          "Judge0 submission successful, token:",
          response.data.token,
        );
        return response.data.token;
      } else {
        throw new Error("Invalid response from Judge0: missing token");
      }
    } catch (error) {
      console.error("Judge0 submission failed:", error);

      if (axios.isAxiosError(error)) {
        if (error.response) {
          console.error("Judge0 error response:", {
            status: error.response.status,
            data: error.response.data,
          });
          throw new Error(
            `Judge0 API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
          );
        } else if (error.request) {
          console.error("Network request failed - Judge0 server may be down");
          throw new Error(
            `Network error: Unable to reach Judge0 server at ${JUDGE0_API_URL}`,
          );
        }
      }

      throw new Error(
        `Judge0 submission failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get execution result from Judge0
   */
  private static async getResult(token: string): Promise<Judge0Result> {
    try {
      const response = await axios.get(
        `${JUDGE0_API_URL}/submissions/${token}?base64_encoded=false`,
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 8000, // 8 second timeout for result fetching
        },
      );

      if (response.data) {
        return response.data;
      } else {
        throw new Error("Invalid response from Judge0: no data");
      }
    } catch (error) {
      console.error("Judge0 result fetch failed:", error);

      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(
            `Judge0 API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
          );
        } else if (error.request) {
          throw new Error(
            `Network error: Unable to reach Judge0 server at ${JUDGE0_API_URL}`,
          );
        }
      }

      throw new Error(
        `Judge0 result fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Wait for submission to complete and return result
   */
  private static async waitForResult(token: string): Promise<Judge0Result> {
    let attempts = 0;

    console.log(`Polling for result with token: ${token}`);

    while (attempts < this.MAX_POLL_ATTEMPTS) {
      try {
        const result = await this.getResult(token);

        // Check if processing is complete
        // Status IDs: 1 = In Queue, 2 = Processing
        if (result.status.id !== 1 && result.status.id !== 2) {
          console.log(
            `Judge0 execution completed with status: ${result.status.description} (ID: ${result.status.id})`,
          );
          return result;
        }

        console.log(
          `Polling attempt ${attempts + 1}/${this.MAX_POLL_ATTEMPTS}, status: ${result.status.description}`,
        );

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, this.POLL_INTERVAL));
        attempts++;
      } catch (error) {
        console.error(`Polling attempt ${attempts + 1} failed:`, error);
        attempts++;

        if (attempts >= this.MAX_POLL_ATTEMPTS) {
          throw error;
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, this.POLL_INTERVAL));
      }
    }

    throw new Error(
      `Execution timeout - Judge0 took too long to process submission (token: ${token})`,
    );
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
    const lang = this.getLanguage(language);
    if (!lang) {
      return {
        input,
        expected_output: expectedOutput,
        actual_output: "",
        status: "ERROR",
        error_message: `Unsupported language: ${language}. Supported: ${this.LANGUAGES.map((l) => l.id).join(", ")}`,
      };
    }

    // Convert time limit from milliseconds to seconds
    const timeLimit = Math.min((options.timeLimit || 5000) / 1000, 10); // Max 10 seconds
    // Convert memory limit from MB to KB
    const memoryLimit = Math.min(
      (options.memoryLimit || 256) * 1024,
      512 * 1024,
    ); // Max 512MB

    try {
      console.log(
        `Executing test case for ${lang.name} (ID: ${lang.judge0Id})`,
      );
      console.log(`Input: "${input}", Expected: "${expectedOutput}"`);

      // Submit code to Judge0
      const token = await this.submitCode({
        source_code: code,
        language_id: lang.judge0Id,
        stdin: input,
        expected_output: expectedOutput,
        cpu_time_limit: timeLimit,
        memory_limit: memoryLimit,
        wall_time_limit: timeLimit + 2, // Give extra time for wall clock
      });

      // Wait for result
      const result = await this.waitForResult(token);

      // Parse and return result
      return this.parseResult(result, input, expectedOutput);
    } catch (error) {
      console.error("Test case execution error:", error);

      return {
        input,
        expected_output: expectedOutput,
        actual_output: "",
        status: "ERROR",
        error_message:
          error instanceof Error ? error.message : "Unknown execution error",
      };
    }
  }

  /**
   * Execute code against multiple test cases
   */
  static async executeMultipleTestCases(
    code: string,
    language: string,
    testCases: Array<{ input: string; expected_output: string }>,
    options: ExecutionOptions = {},
  ): Promise<TestCaseResult[]> {
    const results: TestCaseResult[] = [];

    console.log(`Executing ${testCases.length} test cases for ${language}`);

    // Execute test cases sequentially to avoid overwhelming the Judge0 server
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];

      try {
        console.log(
          `\n--- Executing test case ${i + 1}/${testCases.length} ---`,
        );

        const result = await this.executeTestCase(
          code,
          language,
          testCase.input,
          testCase.expected_output,
          options,
        );

        results.push(result);
        console.log(`Test case ${i + 1} result: ${result.status}`);

        // Small delay between executions to be respectful to the self-hosted server
        if (i < testCases.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
      } catch (error) {
        console.error(`Test case ${i + 1} execution failed:`, error);

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

    const passedCount = results.filter((r) => r.status === "PASSED").length;
    console.log(
      `\nExecution summary: ${passedCount}/${results.length} test cases passed`,
    );

    return results;
  }

  /**
   * Parse Judge0 result into TestCaseResult
   */
  private static parseResult(
    result: Judge0Result,
    input: string,
    expectedOutput: string,
  ): TestCaseResult {
    const testCase: TestCaseResult = {
      input,
      expected_output: expectedOutput,
      actual_output: (result.stdout || "").trim(),
      status: "ERROR", // Default status, will be overridden below
      execution_time: result.time ? parseFloat(result.time) : undefined,
      memory_used: result.memory
        ? Math.round((result.memory / 1024) * 100) / 100
        : undefined, // Convert to MB with 2 decimals
    };

    console.log(
      `Parsing result - Status ID: ${result.status.id}, Description: ${result.status.description}`,
    );

    // Determine status based on Judge0 status ID
    switch (result.status.id) {
      case 3: {
        // Accepted - Check if output matches expected
        const actualTrimmed = (result.stdout || "").trim();
        const expectedTrimmed = expectedOutput.trim();
        testCase.status =
          actualTrimmed === expectedTrimmed ? "PASSED" : "FAILED";

        if (testCase.status === "FAILED") {
          testCase.error_message = `Output mismatch.\nExpected: "${expectedTrimmed}"\nActual: "${actualTrimmed}"`;
        }
        break;
      }

      case 4: // Wrong Answer
        testCase.status = "FAILED";
        testCase.error_message = `Wrong Answer.\nExpected: "${expectedOutput.trim()}"\nActual: "${(result.stdout || "").trim()}"`;
        break;

      case 5: // Time Limit Exceeded
        testCase.status = "TIME_LIMIT_EXCEEDED";
        testCase.error_message = "Time limit exceeded";
        break;

      case 6: // Compilation Error
        testCase.status = "COMPILATION_ERROR";
        testCase.error_message = "Compilation failed";
        testCase.compile_output = result.compile_output;
        break;

      case 7: // Runtime Error (SIGSEGV)
        testCase.status = "RUNTIME_ERROR";
        testCase.error_message = "Runtime Error: Segmentation fault (SIGSEGV)";
        break;

      case 8: // Runtime Error (SIGXFSZ)
        testCase.status = "RUNTIME_ERROR";
        testCase.error_message =
          "Runtime Error: File size limit exceeded (SIGXFSZ)";
        break;

      case 9: // Runtime Error (SIGFPE)
        testCase.status = "RUNTIME_ERROR";
        testCase.error_message =
          "Runtime Error: Floating point exception (SIGFPE)";
        break;

      case 10: // Runtime Error (SIGABRT)
        testCase.status = "RUNTIME_ERROR";
        testCase.error_message = "Runtime Error: Aborted (SIGABRT)";
        break;

      case 11: // Runtime Error (NZEC)
        testCase.status = "RUNTIME_ERROR";
        testCase.error_message = "Runtime Error: Non-zero exit code";
        break;

      case 12: // Runtime Error (Other)
        testCase.status = "RUNTIME_ERROR";
        testCase.error_message = "Runtime Error: Unknown runtime error";
        break;

      case 13: // Internal Error
        testCase.status = "ERROR";
        testCase.error_message = "Internal Judge0 error";
        break;

      case 14: // Exec Format Error
        testCase.status = "ERROR";
        testCase.error_message = "Executable format error";
        break;

      default:
        testCase.status = "ERROR";
        testCase.error_message =
          result.message ||
          result.status.description ||
          `Unknown status ID: ${result.status.id}`;
    }

    // Add stderr to error message if available and status is not PASSED
    if (result.stderr && result.stderr.trim() && testCase.status !== "PASSED") {
      const stderrMsg = result.stderr.trim();
      testCase.error_message = testCase.error_message
        ? `${testCase.error_message}\n\nStderr: ${stderrMsg}`
        : `Stderr: ${stderrMsg}`;
    }

    // Add compile output for compilation errors
    if (
      result.compile_output &&
      result.compile_output.trim() &&
      testCase.status === "COMPILATION_ERROR"
    ) {
      testCase.compile_output = result.compile_output.trim();
    }

    return testCase;
  }

  /**
   * Validate code syntax before execution (basic validation)
   */
  static validateCode(
    code: string,
    language: string,
  ): { isValid: boolean; error?: string } {
    if (!code || code.trim().length === 0) {
      return { isValid: false, error: "Code cannot be empty" };
    }

    if (code.length > 50000) {
      return {
        isValid: false,
        error: "Code is too long (maximum 50,000 characters)",
      };
    }

    const lang = this.getLanguage(language);
    if (!lang) {
      return {
        isValid: false,
        error: `Unsupported language: ${language}. Supported languages: ${this.LANGUAGES.map((l) => l.id).join(", ")}`,
      };
    }

    return { isValid: true };
  }

  /**
   * Test connection to Judge0 server
   */
  static async testConnection(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      console.log(`Testing connection to Judge0 at: ${JUDGE0_API_URL}`);

      // Test basic connectivity
      const aboutResponse = await axios.get(`${JUDGE0_API_URL}/about`, {
        timeout: 5000,
      });

      if (aboutResponse.status === 200) {
        return {
          success: true,
          message: "Judge0 connection successful",
          details: aboutResponse.data,
        };
      } else {
        return {
          success: false,
          message: `Judge0 returned status: ${aboutResponse.status}`,
        };
      }
    } catch (error) {
      console.error("Judge0 connection test failed:", error);

      if (axios.isAxiosError(error)) {
        if (error.response) {
          return {
            success: false,
            message: `Judge0 server error: ${error.response.status} - ${error.response.statusText}`,
            details: error.response.data,
          };
        } else if (error.request) {
          return {
            success: false,
            message: `Cannot reach Judge0 server at ${JUDGE0_API_URL}. Please check if the server is running and accessible.`,
          };
        }
      }

      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }
}
