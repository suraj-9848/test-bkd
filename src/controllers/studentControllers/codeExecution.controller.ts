// controllers/studentControllers/codeExecution.controller.ts

import { Request, Response } from "express";
import { Judge0Service, TestCaseResult } from "../../services/judge0Service";
import { logger } from "../../utils/logger";
import { getSingleRecord } from "../../lib/dbLib/sqlUtils";
import { Test } from "../../db/mysqlModels/Test";
import { Question } from "../../db/mysqlModels/Question";

interface ExecuteCodeRequest {
  questionId: string;
  code: string;
  language: string;
}

interface TestCase {
  input: string;
  expected_output: string;
}

/**
 * Execute code against visible test cases
 */
export const executeCode = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const { questionId, code, language }: ExecuteCodeRequest = req.body;
    const studentId = (req as any).user?.id;

    // Validate input
    if (!questionId || !code || !language) {
      return res.status(400).json({
        error: "Question ID, code, and language are required",
      });
    }

    // Fetch test and question
    const test = await getSingleRecord<Test, any>(Test, {
      where: { id: testId },
      relations: ["questions"],
    });

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    // Find the specific question
    const question = test.questions?.find((q: Question) => q.id === questionId);
    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    // Verify it's a coding question
    if (question.type !== "CODE") {
      return res.status(400).json({
        error: "This endpoint is only for coding questions",
      });
    }

    // Parse visible test cases
    let visibleTestCases: TestCase[] = [];
    try {
      if (question.visible_testcases) {
        visibleTestCases = JSON.parse(question.visible_testcases);
      }
    } catch (error) {
      console.error("Failed to parse visible test cases:", error);
      return res.status(500).json({
        error: "Invalid test case format",
      });
    }

    if (visibleTestCases.length === 0) {
      return res.status(400).json({
        error: "No test cases available for this question",
      });
    }

    // Execute code against test cases
    const results: TestCaseResult[] = [];

    try {
      for (const testCase of visibleTestCases) {
        try {
          const result = await Judge0Service.executeTestCase(
            code,
            language,
            testCase.input,
            testCase.expected_output,
            {
              timeLimit: question.time_limit_ms || 5000,
              memoryLimit: question.memory_limit_mb || 256,
            },
          );

          results.push(result);
        } catch (testError) {
          console.error(`Test case execution failed:`, testError);
          results.push({
            input: testCase.input,
            expected_output: testCase.expected_output,
            actual_output: "",
            status: "ERROR",
            error_message:
              testError instanceof Error ? testError.message : "Unknown error",
          });
        }
      }

      // Log execution attempt
      logger.info("Code execution completed", {
        studentId,
        testId,
        questionId,
        language,
        totalTestCases: visibleTestCases.length,
        passedTestCases: results.filter((r) => r.status === "PASSED").length,
      });

      return res.status(200).json({
        success: true,
        results,
        summary: {
          total: results.length,
          passed: results.filter((r) => r.status === "PASSED").length,
          failed: results.filter((r) => r.status === "FAILED").length,
          errors: results.filter((r) => r.status === "ERROR").length,
        },
      });
    } catch (executionError) {
      console.error("Code execution failed:", executionError);
      return res.status(500).json({
        error: "Code execution failed",
        details:
          executionError instanceof Error
            ? executionError.message
            : "Unknown error",
      });
    }
  } catch (error) {
    console.error("Execute code error:", error);
    logger.error("Execute code error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Submit code solution (final submission)
 */
export const submitCode = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const { questionId, code, language }: ExecuteCodeRequest = req.body;
    const studentId = (req as any).user?.id;

    // Validate input
    if (!questionId || !code || !language) {
      return res.status(400).json({
        error: "Question ID, code, and language are required",
      });
    }

    // Fetch test and question
    const test = await getSingleRecord<Test, any>(Test, {
      where: { id: testId },
      relations: ["questions"],
    });

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const question = test.questions?.find((q: Question) => q.id === questionId);
    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    if (question.type !== "CODE") {
      return res.status(400).json({
        error: "This endpoint is only for coding questions",
      });
    }

    // Parse both visible and hidden test cases
    let allTestCases: TestCase[] = [];
    try {
      const visibleTestCases = question.visible_testcases
        ? JSON.parse(question.visible_testcases)
        : [];
      const hiddenTestCases = question.hidden_testcases
        ? JSON.parse(question.hidden_testcases)
        : [];

      allTestCases = [...visibleTestCases, ...hiddenTestCases];
    } catch (error) {
      console.error("Failed to parse test cases:", error);
      return res.status(500).json({
        error: "Invalid test case format",
      });
    }

    if (allTestCases.length === 0) {
      return res.status(400).json({
        error: "No test cases available for this question",
      });
    }

    // Execute code against all test cases
    const results: TestCaseResult[] = [];
    let totalPassed = 0;

    try {
      for (const testCase of allTestCases) {
        try {
          const result = await Judge0Service.executeTestCase(
            code,
            language,
            testCase.input,
            testCase.expected_output,
            {
              timeLimit: question.time_limit_ms || 5000,
              memoryLimit: question.memory_limit_mb || 256,
            },
          );

          results.push(result);
          if (result.status === "PASSED") {
            totalPassed++;
          }
        } catch (testError) {
          console.error(`Test case execution failed:`, testError);
          results.push({
            input: testCase.input,
            expected_output: testCase.expected_output,
            actual_output: "",
            status: "ERROR",
            error_message:
              testError instanceof Error ? testError.message : "Unknown error",
          });
        }
      }

      // Calculate score
      const score = (totalPassed / allTestCases.length) * question.marks;

      // Save submission (you'll need to implement this based on your submission model)
      // await saveCodeSubmission(studentId, testId, questionId, code, language, score, results);

      logger.info("Code submission completed", {
        studentId,
        testId,
        questionId,
        language,
        totalTestCases: allTestCases.length,
        passedTestCases: totalPassed,
        score,
      });

      return res.status(200).json({
        success: true,
        message: "Code submitted successfully",
        results: {
          total: allTestCases.length,
          passed: totalPassed,
          score,
          maxScore: question.marks,
          percentage: (totalPassed / allTestCases.length) * 100,
        },
      });
    } catch (executionError) {
      console.error("Code submission execution failed:", executionError);
      return res.status(500).json({
        error: "Code execution failed during submission",
        details:
          executionError instanceof Error
            ? executionError.message
            : "Unknown error",
      });
    }
  } catch (error) {
    console.error("Submit code error:", error);
    logger.error("Submit code error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get question details with visible test cases only
 */
export const getQuestionDetails = async (req: Request, res: Response) => {
  try {
    const { testId, questionId } = req.params;

    // Fetch test and question
    const test = await getSingleRecord<Test, any>(Test, {
      where: { id: testId },
      relations: ["questions"],
    });

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const question = test.questions?.find((q: Question) => q.id === questionId);
    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    // Parse only visible test cases for students
    let visibleTestCases: TestCase[] = [];
    try {
      if (question.visible_testcases) {
        visibleTestCases = JSON.parse(question.visible_testcases);
      }
    } catch (error) {
      console.error("Failed to parse visible test cases:", error);
    }

    return res.status(200).json({
      success: true,
      question: {
        id: question.id,
        question_text: question.question_text,
        type: question.type,
        marks: question.marks,
        constraints: question.constraints,
        visible_testcases: visibleTestCases,
        time_limit_ms: question.time_limit_ms,
        memory_limit_mb: question.memory_limit_mb,
        codeLanguage: question.codeLanguage,
      },
    });
  } catch (error) {
    console.error("Get question details error:", error);
    logger.error("Get question details error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get supported programming languages
 */
export const getSupportedLanguages = async (req: Request, res: Response) => {
  try {
    const languages = [
      { id: "javascript", name: "JavaScript", extension: "js" },
      { id: "python", name: "Python", extension: "py" },
      { id: "java", name: "Java", extension: "java" },
      { id: "cpp", name: "C++", extension: "cpp" },
      { id: "c", name: "C", extension: "c" },
      { id: "csharp", name: "C#", extension: "cs" },
      { id: "php", name: "PHP", extension: "php" },
      { id: "ruby", name: "Ruby", extension: "rb" },
      { id: "go", name: "Go", extension: "go" },
      { id: "rust", name: "Rust", extension: "rs" },
    ];

    return res.status(200).json({
      success: true,
      languages,
    });
  } catch (error) {
    console.error("Get supported languages error:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
};
