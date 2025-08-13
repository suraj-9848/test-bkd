// services/judge0Service.ts
import axios from "axios";

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
  timeLimit?: number; // in milliseconds
  memoryLimit?: number; // in MB
}

export interface ProgrammingLanguage {
  id: string;
  name: string;
  judge0Id: number;
  fileExtension: string;
  monacoLanguage: string;
}

export class Judge0Service {
  private static readonly BASE_URL = "http://159.89.166.122:2358";
  private static readonly TIMEOUT = 30000; // 30 seconds
  private static readonly MAX_RETRIES = 3;
  private static readonly POLL_INTERVAL = 1000; // 1 second
  private static readonly MAX_POLL_ATTEMPTS = 30; // 30 seconds max wait

  // Comprehensive language mappings for Judge0
  private static readonly LANGUAGES: ProgrammingLanguage[] = [
    {
      id: "javascript",
      name: "JavaScript",
      judge0Id: 63,
      fileExtension: "js",
      monacoLanguage: "javascript",
    },
    {
      id: "python",
      name: "Python 3",
      judge0Id: 71,
      fileExtension: "py",
      monacoLanguage: "python",
    },
    {
      id: "java",
      name: "Java",
      judge0Id: 62,
      fileExtension: "java",
      monacoLanguage: "java",
    },
    {
      id: "cpp",
      name: "C++",
      judge0Id: 54,
      fileExtension: "cpp",
      monacoLanguage: "cpp",
    },
    {
      id: "c",
      name: "C",
      judge0Id: 50,
      fileExtension: "c",
      monacoLanguage: "c",
    },
    {
      id: "csharp",
      name: "C#",
      judge0Id: 51,
      fileExtension: "cs",
      monacoLanguage: "csharp",
    },
    {
      id: "php",
      name: "PHP",
      judge0Id: 68,
      fileExtension: "php",
      monacoLanguage: "php",
    },
    {
      id: "ruby",
      name: "Ruby",
      judge0Id: 72,
      fileExtension: "rb",
      monacoLanguage: "ruby",
    },
    {
      id: "go",
      name: "Go",
      judge0Id: 60,
      fileExtension: "go",
      monacoLanguage: "go",
    },
    {
      id: "rust",
      name: "Rust",
      judge0Id: 73,
      fileExtension: "rs",
      monacoLanguage: "rust",
    },
    {
      id: "kotlin",
      name: "Kotlin",
      judge0Id: 78,
      fileExtension: "kt",
      monacoLanguage: "kotlin",
    },
    {
      id: "swift",
      name: "Swift",
      judge0Id: 83,
      fileExtension: "swift",
      monacoLanguage: "swift",
    },
    {
      id: "typescript",
      name: "TypeScript",
      judge0Id: 74,
      fileExtension: "ts",
      monacoLanguage: "typescript",
    },
    {
      id: "scala",
      name: "Scala",
      judge0Id: 81,
      fileExtension: "scala",
      monacoLanguage: "scala",
    },
    {
      id: "perl",
      name: "Perl",
      judge0Id: 85,
      fileExtension: "pl",
      monacoLanguage: "perl",
    },
    {
      id: "r",
      name: "R",
      judge0Id: 80,
      fileExtension: "r",
      monacoLanguage: "r",
    },
    {
      id: "nodejs",
      name: "Node.js",
      judge0Id: 63,
      fileExtension: "js",
      monacoLanguage: "javascript",
    },
  ];

  /**
   * Get language configuration by ID
   */
  private static getLanguage(languageId: string): ProgrammingLanguage | null {
    return (
      this.LANGUAGES.find((lang) => lang.id === languageId.toLowerCase()) ||
      null
    );
  }

  /**
   * Get Judge0 language ID for a given language
   */
  private static getJudge0LanguageId(language: string): number {
    const lang = this.getLanguage(language);
    if (!lang) {
      throw new Error(`Unsupported language: ${language}`);
    }
    return lang.judge0Id;
  }

  /**
   * Submit code to Judge0 for execution
   */
  static async submitCode(submission: Judge0Submission): Promise<string> {
    try {
      console.log("Submitting to Judge0:", {
        language_id: submission.language_id,
        stdin: submission.stdin,
        expected_output: submission.expected_output,
        cpu_time_limit: submission.cpu_time_limit,
        memory_limit: submission.memory_limit,
      });

      const response = await axios.post(
        `${this.BASE_URL}/submissions?base64_encoded=false&wait=false`,
        submission,
        {
          timeout: this.TIMEOUT,
          headers: {
            "Content-Type": "application/json",
            "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
          },
        },
      );

      if (!response.data.token) {
        throw new Error("No token returned from Judge0");
      }

      console.log("Judge0 submission successful, token:", response.data.token);
      return response.data.token;
    } catch (error) {
      console.error("Judge0 submission failed:", error);

      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(
            `Judge0 API Error (${error.response.status}): ${
              error.response.data?.error || error.response.statusText
            }`,
          );
        } else if (error.request) {
          throw new Error("Network error: Could not connect to Judge0 server");
        }
      }

      throw new Error(
        `Submission failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get submission result from Judge0
   */
  static async getResult(token: string): Promise<Judge0Result> {
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

      return response.data;
    } catch (error) {
      console.error("Judge0 result fetch failed:", error);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error("Submission not found");
        }
        if (error.response) {
          throw new Error(
            `Judge0 API Error (${error.response.status}): ${
              error.response.data?.error || error.response.statusText
            }`,
          );
        }
      }

      throw new Error(
        `Failed to get result: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Wait for submission to complete and return result
   */
  static async waitForResult(token: string): Promise<Judge0Result> {
    let attempts = 0;

    while (attempts < this.MAX_POLL_ATTEMPTS) {
      try {
        const result = await this.getResult(token);

        // Check if processing is complete
        // Status IDs: 1 = In Queue, 2 = Processing
        if (result.status.id !== 1 && result.status.id !== 2) {
          console.log(
            `Judge0 execution completed with status: ${result.status.description}`,
          );
          return result;
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, this.POLL_INTERVAL));
        attempts++;

        console.log(
          `Polling attempt ${attempts}/${this.MAX_POLL_ATTEMPTS}, status: ${result.status.description}`,
        );
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
      "Execution timeout - Judge0 took too long to process the submission",
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
        error_message: `Unsupported language: ${language}`,
      };
    }

    const timeLimit = (options.timeLimit || 5000) / 1000; // Convert to seconds
    const memoryLimit = (options.memoryLimit || 256) * 1024; // Convert to KB

    try {
      console.log(`Executing test case for language: ${lang.name}`);

      // Submit code
      const token = await this.submitCode({
        source_code: code,
        language_id: lang.judge0Id,
        stdin: input,
        expected_output: expectedOutput,
        cpu_time_limit: timeLimit,
        memory_limit: memoryLimit,
        wall_time_limit: timeLimit + 1,
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
        error_message: error instanceof Error ? error.message : "Unknown error",
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

    // Execute test cases sequentially to avoid overwhelming Judge0
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];

      try {
        console.log(`Executing test case ${i + 1}/${testCases.length}`);

        const result = await this.executeTestCase(
          code,
          language,
          testCase.input,
          testCase.expected_output,
          options,
        );

        results.push(result);

        // Small delay between executions to be respectful to the service
        if (i < testCases.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
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
      actual_output: result.stdout?.trim() || "",
      status: "ERROR", // Default status, will be overridden below
      execution_time: result.time ? parseFloat(result.time) * 1000 : undefined, // Convert to ms
      memory_used: result.memory ? result.memory / 1024 : undefined, // Convert to MB
    };

    // Determine status based on Judge0 status ID
    switch (result.status.id) {
      case 3: {
        // Accepted
        const actualTrimmed = (result.stdout || "").trim();
        const expectedTrimmed = expectedOutput.trim();
        testCase.status =
          actualTrimmed === expectedTrimmed ? "PASSED" : "FAILED";

        if (testCase.status === "FAILED") {
          testCase.error_message = `Output mismatch. Expected: "${expectedTrimmed}", Got: "${actualTrimmed}"`;
        }
        break;
      }

      case 4: // Wrong Answer
        testCase.status = "FAILED";
        testCase.error_message = `Wrong Answer. Expected: "${expectedOutput.trim()}", Got: "${(result.stdout || "").trim()}"`;
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
          result.message || result.status.description || "Unknown error";
    }

    // Add stderr to error message if available
    if (result.stderr && testCase.status !== "PASSED") {
      testCase.error_message = testCase.error_message
        ? `${testCase.error_message}\nStderr: ${result.stderr}`
        : result.stderr;
    }

    return testCase;
  }

  /**
   * Validate code syntax before execution
   */
  static validateCode(
    code: string,
    language: string,
  ): { isValid: boolean; error?: string } {
    if (!code || code.trim().length === 0) {
      return { isValid: false, error: "Code cannot be empty" };
    }

    const lang = this.getLanguage(language);
    if (!lang) {
      return { isValid: false, error: `Unsupported language: ${language}` };
    }

    // Basic language-specific validation
    switch (language.toLowerCase()) {
      case "javascript":
      case "nodejs":
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
      case "c": {
        if (!code.includes("main")) {
          return {
            isValid: false,
            error: "C/C++ code must contain a main function",
          };
        }
        break;
      }

      case "csharp":
        if (!code.includes("class") || !code.includes("Main")) {
          return {
            isValid: false,
            error: "C# code must contain a class with a Main method",
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
   * Get supported programming languages
   */
  static getSupportedLanguages(): ProgrammingLanguage[] {
    return [...this.LANGUAGES];
  }

  /**
   * Get language name from ID
   */
  static getLanguageName(languageId: string): string {
    const lang = this.getLanguage(languageId);
    return lang ? lang.name : languageId;
  }

  /**
   * Get Monaco editor language from language ID
   */
  static getMonacoLanguage(languageId: string): string {
    const lang = this.getLanguage(languageId);
    return lang ? lang.monacoLanguage : languageId;
  }

  /**
   * Test Judge0 connectivity
   */
  static async testConnection(): Promise<{
    connected: boolean;
    error?: string;
  }> {
    try {
      const response = await axios.get(`${this.BASE_URL}/languages`, {
        timeout: 5000,
      });

      if (response.status === 200) {
        return { connected: true };
      } else {
        return { connected: false, error: "Unexpected response from Judge0" };
      }
    } catch (error) {
      console.error("Judge0 connection test failed:", error);

      return {
        connected: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  /**
   * Get Judge0 system info
   */
  static async getSystemInfo(): Promise<Record<string, unknown>> {
    try {
      const response = await axios.get(`${this.BASE_URL}/system_info`, {
        timeout: 5000,
      });

      return response.data;
    } catch (error) {
      console.error("Failed to get Judge0 system info:", error);
      throw error;
    }
  }
}
