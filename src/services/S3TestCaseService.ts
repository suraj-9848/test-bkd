import AWS from "aws-sdk";
import { logger } from "../utils/logger";

export interface TestCase {
  input: string;
  expected_output: string;
}

export interface TestCaseFile {
  visible_testcases: TestCase[];
  hidden_testcases: TestCase[];
}

export class S3TestCaseService {
  private static s3Instance: AWS.S3;

  static {
    this.s3Instance = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });
  }

  /**
   * Parse testcase file content
   */
  static parseTestCaseFile(content: string): TestCaseFile {
    try {
      const lines = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line);

      if (lines.length === 0) {
        throw new Error("Empty testcase file");
      }

      // Check if it's JSON format
      if (content.trim().startsWith("{") || content.trim().startsWith("[")) {
        return this.parseJSONFormat(content);
      }

      // Parse custom format
      return this.parseCustomFormat(lines);
    } catch (error: any) {
      logger.error("Error parsing testcase file:", error);
      throw new Error(`Invalid testcase file format: ${error.message}`);
    }
  }

  /**
   * Parse JSON format testcase file
   */
  private static parseJSONFormat(content: string): TestCaseFile {
    const data = JSON.parse(content);

    if (!data.visible_testcases || !data.hidden_testcases) {
      throw new Error(
        "JSON format must contain 'visible_testcases' and 'hidden_testcases' arrays",
      );
    }

    return {
      visible_testcases: this.validateTestCases(data.visible_testcases),
      hidden_testcases: this.validateTestCases(data.hidden_testcases),
    };
  }

  /**
   * Parse custom format testcase file
   * Format:
   * VISIBLE
   * INPUT:
   * 5 3
   * OUTPUT:
   * 8
   * INPUT:
   * 10 20
   * OUTPUT:
   * 30
   * HIDDEN
   * INPUT:
   * 100 200
   * OUTPUT:
   * 300
   */
  private static parseCustomFormat(lines: string[]): TestCaseFile {
    const visible_testcases: TestCase[] = [];
    const hidden_testcases: TestCase[] = [];

    let currentSection: "VISIBLE" | "HIDDEN" | null = null;
    let currentInput = "";
    let currentOutput = "";
    let parsingMode: "INPUT" | "OUTPUT" | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line === "VISIBLE") {
        currentSection = "VISIBLE";
        continue;
      }

      if (line === "HIDDEN") {
        currentSection = "HIDDEN";
        continue;
      }

      if (line === "INPUT:") {
        // Save previous test case if exists
        if (currentInput && currentOutput && currentSection) {
          const testCase = {
            input: currentInput.trim(),
            expected_output: currentOutput.trim(),
          };
          if (currentSection === "VISIBLE") {
            visible_testcases.push(testCase);
          } else {
            hidden_testcases.push(testCase);
          }
        }

        currentInput = "";
        currentOutput = "";
        parsingMode = "INPUT";
        continue;
      }

      if (line === "OUTPUT:") {
        parsingMode = "OUTPUT";
        continue;
      }

      if (parsingMode === "INPUT") {
        currentInput += (currentInput ? "\n" : "") + line;
      } else if (parsingMode === "OUTPUT") {
        currentOutput += (currentOutput ? "\n" : "") + line;
      }
    }

    // Save last test case
    if (currentInput && currentOutput && currentSection) {
      const testCase = {
        input: currentInput.trim(),
        expected_output: currentOutput.trim(),
      };
      if (currentSection === "VISIBLE") {
        visible_testcases.push(testCase);
      } else {
        hidden_testcases.push(testCase);
      }
    }

    if (visible_testcases.length === 0) {
      throw new Error("No visible test cases found");
    }

    if (hidden_testcases.length === 0) {
      throw new Error("No hidden test cases found");
    }

    return { visible_testcases, hidden_testcases };
  }

  /**
   * Validate test cases array
   */
  private static validateTestCases(testCases: any[]): TestCase[] {
    if (!Array.isArray(testCases)) {
      throw new Error("Test cases must be an array");
    }

    return testCases.map((tc, index) => {
      if (!tc.input || !tc.expected_output) {
        throw new Error(
          `Test case ${index + 1} must have 'input' and 'expected_output' fields`,
        );
      }

      return {
        input: String(tc.input),
        expected_output: String(tc.expected_output),
      };
    });
  }

  /**
   * Upload testcase file to S3
   */
  static async uploadTestCaseFile(
    questionId: string,
    fileContent: string,
    fileName: string,
  ): Promise<string> {
    try {
      // Validate file format first
      this.parseTestCaseFile(fileContent);

      const bucketName = process.env.AWS_S3_BUCKET_NAME;
      if (!bucketName) {
        throw new Error("AWS_S3_BUCKET_NAME environment variable not set");
      }

      const key = `testcases/${questionId}/${Date.now()}_${fileName}`;

      const uploadParams = {
        Bucket: bucketName,
        Key: key,
        Body: fileContent,
        ContentType: "text/plain",
      };

      const result = await this.s3Instance.upload(uploadParams).promise();

      logger.info(`Testcase file uploaded to S3: ${result.Location}`);
      return result.Location;
    } catch (error: any) {
      logger.error("Error uploading testcase file to S3:", error);
      throw new Error(`Failed to upload testcase file: ${error.message}`);
    }
  }

  /**
   * Download testcase file from S3
   */
  static async downloadTestCaseFile(s3Url: string): Promise<TestCaseFile> {
    try {
      const bucketName = process.env.AWS_S3_BUCKET_NAME;
      if (!bucketName) {
        throw new Error("AWS_S3_BUCKET_NAME environment variable not set");
      }

      // Extract key from S3 URL
      const url = new URL(s3Url);
      const key = url.pathname.substring(1); // Remove leading slash

      const downloadParams = {
        Bucket: bucketName,
        Key: key,
      };

      const result = await this.s3Instance.getObject(downloadParams).promise();
      const content = result.Body?.toString("utf-8");

      if (!content) {
        throw new Error("Empty file content");
      }

      return this.parseTestCaseFile(content);
    } catch (error: any) {
      logger.error("Error downloading testcase file from S3:", error);
      throw new Error(`Failed to download testcase file: ${error.message}`);
    }
  }

  /**
   * Generate demo testcase file content
   */
  static generateDemoFile(): string {
    return `VISIBLE
INPUT:
5 3
OUTPUT:
8
INPUT:
10 20
OUTPUT:
30
HIDDEN
INPUT:
100 200
OUTPUT:
300
INPUT:
-5 10
OUTPUT:
5`;
  }

  /**
   * Generate demo testcase file in JSON format
   */
  static generateDemoFileJSON(): string {
    return JSON.stringify(
      {
        visible_testcases: [
          {
            input: "5 3",
            expected_output: "8",
          },
          {
            input: "10 20",
            expected_output: "30",
          },
        ],
        hidden_testcases: [
          {
            input: "100 200",
            expected_output: "300",
          },
          {
            input: "-5 10",
            expected_output: "5",
          },
        ],
      },
      null,
      2,
    );
  }
}
