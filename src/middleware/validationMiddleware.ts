import { Request, Response, NextFunction } from "express";
import { S3TestCaseService } from "../services/S3TestCaseService";
import { Judge0Service } from "../services/judge0Service";

/**
 * Validate coding question data
 */
export const validateCodingQuestion = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { questions } = req.body;

    if (!Array.isArray(questions)) {
      return res.status(400).json({
        error: "Questions must be an array",
      });
    }

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];

      // Validate common fields
      if (
        !question.question_text ||
        typeof question.question_text !== "string"
      ) {
        return res.status(400).json({
          error: `Question ${i + 1}: question_text is required and must be a string`,
        });
      }

      if (
        !question.type ||
        !["MCQ", "DESCRIPTIVE", "CODE"].includes(question.type)
      ) {
        return res.status(400).json({
          error: `Question ${i + 1}: Invalid question type. Must be MCQ, DESCRIPTIVE, or CODE`,
        });
      }

      if (
        !question.marks ||
        typeof question.marks !== "number" ||
        question.marks <= 0
      ) {
        return res.status(400).json({
          error: `Question ${i + 1}: marks must be a positive number`,
        });
      }

      // Validate MCQ specific fields
      if (question.type === "MCQ") {
        if (
          !question.options ||
          !Array.isArray(question.options) ||
          question.options.length < 2
        ) {
          return res.status(400).json({
            error: `Question ${i + 1}: MCQ must have at least 2 options`,
          });
        }

        const hasCorrectOption = question.options.some(
          (opt: any) => opt.correct === true,
        );
        if (!hasCorrectOption) {
          return res.status(400).json({
            error: `Question ${i + 1}: MCQ must have at least one correct option`,
          });
        }

        for (let j = 0; j < question.options.length; j++) {
          const option = question.options[j];
          if (
            !option.text ||
            typeof option.text !== "string" ||
            !option.text.trim()
          ) {
            return res.status(400).json({
              error: `Question ${i + 1}, Option ${j + 1}: text is required and must be non-empty`,
            });
          }
        }
      }

      // Validate CODING specific fields
      if (question.type === "CODE") {
        if (
          !question.codeLanguage ||
          typeof question.codeLanguage !== "string"
        ) {
          return res.status(400).json({
            error: `Question ${i + 1}: codeLanguage is required for coding questions`,
          });
        }

        // Validate language is supported
        const supportedLanguages = Judge0Service.getSupportedLanguages().map(
          (lang) => lang.name,
        );
        if (!supportedLanguages.includes(question.codeLanguage.toLowerCase())) {
          return res.status(400).json({
            error: `Question ${i + 1}: Unsupported programming language '${question.codeLanguage}'. Supported languages: ${supportedLanguages.join(", ")}`,
          });
        }

        // Validate test cases
        if (
          !question.visible_testcases ||
          !Array.isArray(question.visible_testcases)
        ) {
          return res.status(400).json({
            error: `Question ${i + 1}: visible_testcases is required and must be an array`,
          });
        }

        if (
          !question.hidden_testcases ||
          !Array.isArray(question.hidden_testcases)
        ) {
          return res.status(400).json({
            error: `Question ${i + 1}: hidden_testcases is required and must be an array`,
          });
        }

        // Validate test case structure
        const validateTestCases = (testCases: any[], type: string) => {
          if (testCases.length === 0) {
            throw new Error(`${type} test cases cannot be empty`);
          }

          testCases.forEach((testCase, index) => {
            if (!testCase.input && testCase.input !== "") {
              throw new Error(
                `${type} test case ${index + 1}: input is required`,
              );
            }
            if (!testCase.expected_output && testCase.expected_output !== "") {
              throw new Error(
                `${type} test case ${index + 1}: expected_output is required`,
              );
            }
            if (typeof testCase.input !== "string") {
              throw new Error(
                `${type} test case ${index + 1}: input must be a string`,
              );
            }
            if (typeof testCase.expected_output !== "string") {
              throw new Error(
                `${type} test case ${index + 1}: expected_output must be a string`,
              );
            }
          });
        };

        try {
          validateTestCases(question.visible_testcases, "Visible");
          validateTestCases(question.hidden_testcases, "Hidden");
        } catch (error: any) {
          return res.status(400).json({
            error: `Question ${i + 1}: ${error.message}`,
          });
        }

        // Validate time and memory limits
        if (question.time_limit_ms !== undefined) {
          if (
            typeof question.time_limit_ms !== "number" ||
            question.time_limit_ms <= 0
          ) {
            return res.status(400).json({
              error: `Question ${i + 1}: time_limit_ms must be a positive number`,
            });
          }
          if (question.time_limit_ms > 30000) {
            // 30 seconds max
            return res.status(400).json({
              error: `Question ${i + 1}: time_limit_ms cannot exceed 30000ms (30 seconds)`,
            });
          }
        }

        if (question.memory_limit_mb !== undefined) {
          if (
            typeof question.memory_limit_mb !== "number" ||
            question.memory_limit_mb <= 0
          ) {
            return res.status(400).json({
              error: `Question ${i + 1}: memory_limit_mb must be a positive number`,
            });
          }
          if (question.memory_limit_mb > 1024) {
            // 1GB max
            return res.status(400).json({
              error: `Question ${i + 1}: memory_limit_mb cannot exceed 1024MB (1GB)`,
            });
          }
        }

        // Validate constraints if provided
        if (
          question.constraints !== undefined &&
          typeof question.constraints !== "string"
        ) {
          return res.status(400).json({
            error: `Question ${i + 1}: constraints must be a string`,
          });
        }
      }

      // Validate DESCRIPTIVE specific fields
      if (question.type === "DESCRIPTIVE") {
        if (question.expectedWordCount !== undefined) {
          if (
            typeof question.expectedWordCount !== "number" ||
            question.expectedWordCount <= 0
          ) {
            return res.status(400).json({
              error: `Question ${i + 1}: expectedWordCount must be a positive number`,
            });
          }
        }
      }
    }

    next();
  } catch (error: any) {
    return res.status(500).json({
      error: "Validation error",
      details: error.message,
    });
  }
};

/**
 * Validate test case file upload
 */
export const validateTestCaseFile = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        error: "No file uploaded",
      });
    }

    // Check file type
    if (
      !file.originalname.toLowerCase().endsWith(".txt") &&
      !file.originalname.toLowerCase().endsWith(".json")
    ) {
      return res.status(400).json({
        error: "Only .txt and .json files are allowed",
      });
    }

    // Check file size (max 1MB)
    if (file.size > 1024 * 1024) {
      return res.status(400).json({
        error: "File size cannot exceed 1MB",
      });
    }

    // Validate file content
    const fileContent = file.buffer.toString("utf-8");

    if (!fileContent.trim()) {
      return res.status(400).json({
        error: "File cannot be empty",
      });
    }

    try {
      S3TestCaseService.parseTestCaseFile(fileContent);
    } catch (parseError: any) {
      return res.status(400).json({
        error: "Invalid test case file format",
        details: parseError.message,
      });
    }

    next();
  } catch (error: any) {
    return res.status(500).json({
      error: "File validation error",
      details: error.message,
    });
  }
};

/**
 * Validate code submission
 */
export const validateCodeSubmission = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { responses } = req.body;

    if (!Array.isArray(responses)) {
      return res.status(400).json({
        error: "Responses must be an array",
      });
    }

    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];

      if (!response.questionId || typeof response.questionId !== "string") {
        return res.status(400).json({
          error: `Response ${i + 1}: questionId is required and must be a string`,
        });
      }

      if (response.type === "code") {
        if (!response.code || typeof response.code !== "string") {
          return res.status(400).json({
            error: `Response ${i + 1}: code is required and must be a string`,
          });
        }

        if (!response.language || typeof response.language !== "string") {
          return res.status(400).json({
            error: `Response ${i + 1}: language is required and must be a string`,
          });
        }

        // Validate language is supported
        const supportedLanguages = Judge0Service.getSupportedLanguages().map(
          (lang) => lang.name,
        );
        if (!supportedLanguages.includes(response.language.toLowerCase())) {
          return res.status(400).json({
            error: `Response ${i + 1}: Unsupported programming language '${response.language}'`,
          });
        }

        // Basic code validation
        if (response.code.trim().length === 0) {
          return res.status(400).json({
            error: `Response ${i + 1}: code cannot be empty`,
          });
        }

        // Check for potentially malicious code (basic check)
        const maliciousPatterns = [
          /system\s*\(/i,
          /exec\s*\(/i,
          /eval\s*\(/i,
          /os\s*\./i,
          /subprocess/i,
          /__import__/i,
          /import\s+os/i,
          /from\s+os/i,
        ];

        const containsMalicious = maliciousPatterns.some((pattern) =>
          pattern.test(response.code),
        );

        if (containsMalicious) {
          return res.status(400).json({
            error: `Response ${i + 1}: Code contains potentially malicious patterns`,
          });
        }
      }
    }

    next();
  } catch (error: any) {
    return res.status(500).json({
      error: "Code submission validation error",
      details: error.message,
    });
  }
};
