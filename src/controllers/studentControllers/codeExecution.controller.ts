import { Request, Response } from "express";
import { Judge0Service } from "../../services/judge0Service";
import { logger } from "../../utils/logger";
import { getSingleRecord } from "../../lib/dbLib/sqlUtils";
import { Test } from "../../db/mysqlModels/Test";
import { Question } from "../../db/mysqlModels/Question";
import { TestResponse } from "../../db/mysqlModels/TestResponse";
import { TestSubmission } from "../../db/mysqlModels/TestSubmission";

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
 * Execute code against visible test cases only (for testing/debugging)
 */
export const executeCode = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const { questionId, code, language }: ExecuteCodeRequest = req.body;
    const studentId = (req as any).user?.id;

    console.log("Execute code request:", {
      testId,
      questionId,
      language,
      studentId,
      codeLength: code?.length,
    });

    // Validate input
    if (!questionId || !code || !language) {
      return res.status(400).json({
        success: false,
        error: "Question ID, code, and language are required",
      });
    }

    // Fetch test and question
    const test = await getSingleRecord<Test, any>(Test, {
      where: { id: testId },
      relations: ["questions"],
    });

    if (!test) {
      return res.status(404).json({
        success: false,
        error: "Test not found",
      });
    }

    // Find the specific question
    const question = test.questions?.find((q: Question) => q.id === questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        error: "Question not found",
      });
    }

    // Verify it's a coding question
    if (question.type !== "CODE") {
      return res.status(400).json({
        success: false,
        error: "This endpoint is only for coding questions",
      });
    }

    // Parse visible test cases only
    let visibleTestCases: TestCase[] = [];
    try {
      if (question.visible_testcases) {
        const parsed = JSON.parse(question.visible_testcases);
        visibleTestCases = Array.isArray(parsed) ? parsed : [];
      }
    } catch (error) {
      console.error("Failed to parse visible test cases:", error);
      return res.status(500).json({
        success: false,
        error: "Invalid test case format",
      });
    }

    if (visibleTestCases.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No sample test cases available for this question",
      });
    }

    console.log(
      `Executing against ${visibleTestCases.length} visible test cases`,
    );

    // Execute code against visible test cases using Judge0Service
    try {
      const results = await Judge0Service.executeMultipleTestCases(
        code,
        language,
        visibleTestCases,
        {
          timeLimit: question.time_limit_ms || 5000,
          memoryLimit: question.memory_limit_mb || 256,
        },
      );

      const passedCount = results.filter((r) => r.status === "PASSED").length;
      const totalCount = results.length;

      // Log execution attempt
      logger.info("Code execution completed", {
        studentId,
        testId,
        questionId,
        language,
        totalTestCases: totalCount,
        passedTestCases: passedCount,
        executionType: "sample",
      });

      return res.status(200).json({
        success: true,
        results,
        summary: {
          total: totalCount,
          passed: passedCount,
          failed: results.filter((r) => r.status === "FAILED").length,
          errors: results.filter((r) => r.status === "ERROR").length,
        },
      });
    } catch (executionError) {
      console.error("Code execution failed:", executionError);
      return res.status(500).json({
        success: false,
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
      success: false,
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Submit code solution (final submission with all test cases)
 */
export const submitCode = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const { questionId, code, language }: ExecuteCodeRequest = req.body;
    const studentId = (req as any).user?.id;

    console.log("Submit code request:", {
      testId,
      questionId,
      language,
      studentId,
      codeLength: code?.length,
    });

    // Validate input
    if (!questionId || !code || !language) {
      return res.status(400).json({
        success: false,
        error: "Question ID, code, and language are required",
      });
    }

    // Fetch test and question
    const test = await getSingleRecord<Test, any>(Test, {
      where: { id: testId },
      relations: ["questions"],
    });

    if (!test) {
      return res.status(404).json({
        success: false,
        error: "Test not found",
      });
    }

    const question = test.questions?.find((q: Question) => q.id === questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        error: "Question not found",
      });
    }

    if (question.type !== "CODE") {
      return res.status(400).json({
        success: false,
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

      // Combine all test cases
      allTestCases = [
        ...(Array.isArray(visibleTestCases) ? visibleTestCases : []),
        ...(Array.isArray(hiddenTestCases) ? hiddenTestCases : []),
      ];
    } catch (error) {
      console.error("Failed to parse test cases:", error);
      return res.status(500).json({
        success: false,
        error: "Invalid test case format",
      });
    }

    if (allTestCases.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No test cases available for this question",
      });
    }

    console.log(`Submitting against ${allTestCases.length} total test cases`);

    try {
      // Execute code against all test cases using Judge0Service
      const results = await Judge0Service.executeMultipleTestCases(
        code,
        language,
        allTestCases,
        {
          timeLimit: question.time_limit_ms || 5000,
          memoryLimit: question.memory_limit_mb || 256,
        },
      );

      const passedCount = results.filter((r) => r.status === "PASSED").length;
      const totalCount = results.length;
      const allPassed = passedCount === totalCount;

      // Calculate score - only full marks if ALL tests pass
      const score = allPassed ? question.marks : 0;

      // Find or create test submission
      const testSubmission = await getSingleRecord<TestSubmission, any>(
        TestSubmission,
        {
          where: {
            test: { id: testId },
            user: { id: studentId },
          },
          relations: ["responses"],
        },
      );

      // If no submission exists, we need to handle this appropriately
      // For now, we'll create a response without a submission (this might need adjustment based on your flow)

      // Find existing response for this question or create new one
      let testResponse = await getSingleRecord<TestResponse, any>(
        TestResponse,
        {
          where: {
            question: { id: questionId },
            submission: testSubmission ? { id: testSubmission.id } : undefined,
          },
        },
      );

      if (!testResponse) {
        testResponse = new TestResponse();
        testResponse.question = question;
        if (testSubmission) {
          testResponse.submission = testSubmission;
        }
      }

      // Update response with code submission data
      testResponse.code_submission = code;
      testResponse.programming_language = language;
      testResponse.score = score;
      testResponse.testcases_passed = passedCount;
      testResponse.total_testcases = totalCount;
      testResponse.testcase_results = JSON.stringify(results);
      testResponse.evaluationStatus = "EVALUATED"; // Mark as evaluated since it's auto-graded

      // Save the response
      await testResponse.save();

      // Log submission
      logger.info("Code submission completed", {
        studentId,
        testId,
        questionId,
        language,
        totalTestCases: totalCount,
        passedTestCases: passedCount,
        score,
        maxScore: question.marks,
        allPassed,
      });

      return res.status(200).json({
        success: true,
        message: allPassed
          ? "All test cases passed!"
          : `${passedCount}/${totalCount} test cases passed`,
        score,
        maxScore: question.marks,
        results, // Return all results for frontend display
        summary: {
          total: totalCount,
          passed: passedCount,
          failed: results.filter((r) => r.status === "FAILED").length,
          errors: results.filter((r) => r.status === "ERROR").length,
          percentage: (passedCount / totalCount) * 100,
          allPassed,
        },
      });
    } catch (executionError) {
      console.error("Code submission execution failed:", executionError);
      return res.status(500).json({
        success: false,
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
      success: false,
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get question details with visible test cases
 */
export const getQuestionDetails = async (req: Request, res: Response) => {
  try {
    const { testId, questionId } = req.params;

    const test = await getSingleRecord<Test, any>(Test, {
      where: { id: testId },
      relations: ["questions"],
    });

    if (!test) {
      return res.status(404).json({
        success: false,
        error: "Test not found",
      });
    }

    const question = test.questions?.find((q: Question) => q.id === questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        error: "Question not found",
      });
    }

    // Parse visible test cases for display
    let visibleTestCases: TestCase[] = [];
    try {
      if (question.visible_testcases) {
        const parsed = JSON.parse(question.visible_testcases);
        visibleTestCases = Array.isArray(parsed) ? parsed : [];
      }
    } catch (error) {
      console.error("Failed to parse visible test cases:", error);
    }

    return res.status(200).json({
      success: true,
      question: {
        id: question.id,
        questionText: question.questionText,
        type: question.type,
        marks: question.marks,
        timeLimit: question.time_limit_ms || 5000,
        memoryLimit: question.memory_limit_mb || 256,
        constraints: question.constraints,
        visibleTestCases,
      },
    });
  } catch (error) {
    console.error("Get question details error:", error);
    return res.status(500).json({
      success: false,
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
    const languages = Judge0Service.getSupportedLanguages();

    return res.status(200).json({
      success: true,
      languages,
    });
  } catch (error) {
    console.error("Get supported languages error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
