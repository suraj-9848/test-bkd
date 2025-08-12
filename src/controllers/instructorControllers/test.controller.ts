import { Request, Response } from "express";
import { UserCourse } from "../../db/mysqlModels/UserCourse";
import { Test, TestStatus } from "../../db/mysqlModels/Test";
import { Question, QuestionType } from "../../db/mysqlModels/Question";
import { Course } from "../../db/mysqlModels/Course";
import { QuizOptions } from "../../db/mysqlModels/QuizOptions";
import {
  createRecord,
  getSingleRecord,
  deleteRecords,
  getAllRecordsWithFilter,
} from "../../lib/dbLib/sqlUtils";
import { TestSubmission } from "../../db/mysqlModels/TestSubmission";
import {
  ResponseEvaluationStatus,
  TestResponse,
} from "../../db/mysqlModels/TestResponse";

import { validate } from "class-validator";
import sanitizeHtml from "sanitize-html";
import { getLoggerByName } from "../../utils/logger";
import { redisClient } from "../../db/connect";

const logger = getLoggerByName("QuestionController");

export const getTestAnalytics = async (req: Request, res: Response) => {
  try {
    const { courseId, testId } = req.params;

    // Get all enrolled students
    const userCourses = await getAllRecordsWithFilter(UserCourse, {
      where: { course: { id: courseId } },
      relations: ["user"],
    });
    const allStudentIds = userCourses.map((uc) => uc.user.id);

    // Get all submissions for the test
    const testSubmissions = await getAllRecordsWithFilter(TestSubmission, {
      where: { test: { id: testId } },
      relations: [
        "user",
        "responses",
        "responses.question",
        "responses.question.options",
      ],
      order: { submittedAt: "ASC" },
    });
    const submittedStudentIds = testSubmissions.map((ts) => ts.user.id);

    // Students who submitted and who did not
    const studentsWhoGave = allStudentIds.filter((id) =>
      submittedStudentIds.includes(id),
    );
    const studentsWhoDidNotGive = allStudentIds.filter(
      (id) => !submittedStudentIds.includes(id),
    );

    // Map for quick lookup
    const userMap = new Map(userCourses.map((uc) => [uc.user.id, uc.user]));

    const testObj = await getSingleRecord<Test, any>(
      Test,
      { where: { id: testId } },
      `test:${testId}`,
    );
    const passingMarks = testObj?.passingMarks || 0;

    // Prepare analytics for students who submitted
    const studentsGave = testSubmissions.map((submission) => {
      // Count correct, wrong, and not attempted MCQ questions
      let correctCount = 0;
      let wrongCount = 0;
      let notAttemptedCount = 0;
      if (submission.responses && Array.isArray(submission.responses)) {
        for (const response of submission.responses) {
          if (response.question && response.question.type === "MCQ") {
            const options = response.question.options || [];
            const correctOptions = options.filter((opt) => opt.correct);
            let answer = response.answer;
            // Try to parse answer if it's a JSON string (array/object)
            if (typeof answer === "string") {
              try {
                const parsed = JSON.parse(answer);
                answer = parsed;
              } catch {
                // ignore JSON parse errors
              }
            }
            // If answer is not given
            if (answer == null || answer === "") {
              notAttemptedCount++;
              continue;
            }
            // If answer is array (multi-select)
            if (Array.isArray(answer)) {
              // Compare selected option IDs with correct option IDs
              const selectedIds = answer.map((a) => String(a));
              const correctIds = correctOptions.map((opt) => String(opt.id));
              if (
                selectedIds.length === correctIds.length &&
                correctIds.every((id) => selectedIds.includes(id))
              ) {
                correctCount++;
              } else {
                wrongCount++;
              }
              continue;
            }
            // If answer is option ID (string or number)
            const answerStr = String(answer);
            if (options.some((opt) => String(opt.id) === answerStr)) {
              // Is this option correct?
              if (correctOptions.some((opt) => String(opt.id) === answerStr)) {
                correctCount++;
              } else {
                wrongCount++;
              }
              continue;
            }
            // If answer is text, compare with correct option text
            if (correctOptions.some((opt) => opt.text === answer)) {
              correctCount++;
            } else {
              wrongCount++;
            }
          }
        }
      }
      return {
        id: submission.user.id,
        username: submission.user.username,
        email: submission.user.email,
        submittedAt: submission.submittedAt,
        Score: submission.mcqScore || 0,
        passingMarks: passingMarks <= submission.mcqScore ? "Passed" : "Failed",
        correctQuestions: correctCount,
        wrongQuestions: wrongCount,
        notAttemptedQuestions: notAttemptedCount,
      };
    });

    // Prepare analytics for students who did not submit
    const studentsNotGave = studentsWhoDidNotGive.map((id) => {
      const user = userMap.get(id) as {
        id: string;
        username?: string;
        email?: string;
      };
      return {
        id: user.id,
        username: user.username,
        email: user.email,
      };
    });

    // Aggregate stats
    let totalMcqScore = 0;
    let earliestSubmission = null;
    let latestSubmission = null;

    for (const submission of testSubmissions) {
      totalMcqScore += submission.mcqScore || 0;
      if (!earliestSubmission || submission.submittedAt < earliestSubmission) {
        earliestSubmission = submission.submittedAt;
      }
      if (!latestSubmission || submission.submittedAt > latestSubmission) {
        latestSubmission = submission.submittedAt;
      }
    }

    const totalAvgScore = studentsGave.length
      ? totalMcqScore / studentsGave.length
      : 0;

    // Calculate total possible marks by summing marks of all questions in the test
    const allQuestions = await Question.find({
      where: { test: { id: testId } },
    });
    const totalPossibleMarks = allQuestions.reduce(
      (sum, q) => sum + (q.marks || 0),
      0,
    );

    return res.status(200).json({
      totalEnrolled: allStudentIds.length,
      gaveTest: studentsWhoGave.length,
      didNotGiveTest: studentsWhoDidNotGive.length,
      studentsGave,
      studentsNotGave,
      totalAvgScore,
      earliestSubmission,
      latestSubmission,
      totalPossibleMarks,
    });
  } catch (error) {
    console.error("Error in getTestAnalytics:", error);
    return res.status(500).json({ error: "Failed to fetch test analytics" });
  }
};

export const fetchTestsInCourse = async (req: Request, res: Response) => {
  const { courseId } = req.params;

  // Validate courseId
  if (!courseId || typeof courseId !== "string") {
    return res.status(400).json({ error: "Invalid course ID" });
  }

  try {
    const course = await getSingleRecord<Course, { where: { id: string } }>(
      Course,
      { where: { id: courseId } },
      `course:${courseId}`,
      false,
    );

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    const tests = await Test.find({
      where: { course: { id: courseId } },
      relations: ["course"],
      order: { createdAt: "DESC" },
    });

    return res.status(200).json({
      message: "Tests fetched successfully",
      data: { tests },
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch tests",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const fetchTestById = async (req: Request, res: Response) => {
  const { testId } = req.params;

  // Validate testId
  if (!testId || typeof testId !== "string") {
    return res.status(400).json({ error: "Invalid test ID" });
  }

  try {
    const test = await getSingleRecord<
      Test,
      { where: { id: string }; relations?: string[] }
    >(
      Test,
      { where: { id: testId }, relations: ["course", "questions"] },
      `test_${testId}_basic`,
      true,
    );

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    return res.status(200).json({
      message: "Test fetched successfully",
      data: { test },
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch test",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const createTest = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const {
      title,
      description,
      maxMarks,
      passingMarks,
      durationInMinutes,
      startDate,
      endDate,
      shuffleQuestions,
      showResults,
      showCorrectAnswers,
    } = req.body;

    if (!title || !maxMarks || !durationInMinutes || !startDate || !endDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    if (
      isNaN(startDateObj.getTime()) ||
      isNaN(endDateObj.getTime()) ||
      startDateObj >= endDateObj
    ) {
      return res.status(400).json({ error: "Invalid start or end time" });
    }

    const course = await getSingleRecord<Course, { where: { id: string } }>(
      Course,
      { where: { id: courseId } },
      `course_${courseId}`,
      true,
    );

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    const test = new Test();
    test.title = title;
    test.description = description || "";
    test.maxMarks = maxMarks;
    test.passingMarks = passingMarks || 0;
    test.durationInMinutes = durationInMinutes;
    test.startDate = startDateObj;
    test.endDate = endDateObj;
    test.shuffleQuestions = shuffleQuestions || false;
    test.showResults = showResults || false;
    test.showCorrectAnswers = showCorrectAnswers || false;
    test.status = TestStatus.DRAFT;
    test.course = course;

    const savedTest = await createRecord(Test.getRepository(), test);

    await redisClient.del(`tests_by_course_${courseId}`);

    return res.status(201).json({
      message: "Test created successfully",
      test: savedTest,
    });
  } catch (error) {
    logger.error("Error creating test:", error);
    return res.status(500).json({ error: "Failed to create test" });
  }
};

// Bulk create tests in multiple courses
export const createTestsBulk = async (req: Request, res: Response) => {
  try {
    const { courseIds, ...testData } = req.body;

    if (!courseIds || !Array.isArray(courseIds) || courseIds.length === 0) {
      return res.status(400).json({ error: "courseIds array is required" });
    }

    const {
      title,
      description,
      maxMarks,
      passingMarks,
      durationInMinutes,
      startDate,
      endDate,
      shuffleQuestions,
      showResults,
      showCorrectAnswers,
    } = testData;

    if (!title || !maxMarks || !durationInMinutes || !startDate || !endDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    if (
      isNaN(startDateObj.getTime()) ||
      isNaN(endDateObj.getTime()) ||
      startDateObj >= endDateObj
    ) {
      return res.status(400).json({ error: "Invalid start or end time" });
    }

    const createdTests = [];
    const errors = [];

    for (const courseId of courseIds) {
      try {
        const course = await getSingleRecord<Course, { where: { id: string } }>(
          Course,
          { where: { id: courseId } },
          `course_${courseId}`,
          true,
        );

        if (!course) {
          errors.push({ courseId, error: "Course not found" });
          continue;
        }

        const test = new Test();
        test.title = title;
        test.description = description || "";
        test.maxMarks = maxMarks;
        test.passingMarks = passingMarks || 0;
        test.durationInMinutes = durationInMinutes;
        test.startDate = startDateObj;
        test.endDate = endDateObj;
        test.shuffleQuestions = shuffleQuestions || false;
        test.showResults = showResults || false;
        test.showCorrectAnswers = showCorrectAnswers || false;
        test.status = TestStatus.DRAFT;
        test.course = course;

        const savedTest = await createRecord(Test.getRepository(), test);
        createdTests.push(savedTest);

        await redisClient.del(`tests_by_course_${courseId}`);
      } catch (error) {
        errors.push({
          courseId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return res.status(201).json({
      message: `Tests created successfully in ${createdTests.length} course(s)`,
      tests: createdTests,
      errors: errors.length > 0 ? errors : undefined,
      totalCourses: courseIds.length,
      successCount: createdTests.length,
      errorCount: errors.length,
    });
  } catch (error) {
    logger.error("Error creating bulk tests:", error);
    return res.status(500).json({ error: "Failed to create tests" });
  }
};

export const updateTest = async (req: Request, res: Response) => {
  const { testId, courseId } = req.params;
  const updateData = req.body;

  // Validate parameters
  if (!testId || !courseId) {
    return res.status(400).json({
      error: "Invalid parameters",
      details: "Test ID and Course ID are required",
    });
  }

  try {
    const test = await Test.findOne({
      where: {
        id: testId,
        course: { id: courseId },
      },
      relations: ["course"],
    });

    if (!test) {
      return res
        .status(404)
        .json({ error: "Test not found in the specified course" });
    }

    if (test.status === TestStatus.PUBLISHED) {
      return res.status(400).json({
        error: "Cannot edit a published test",
      });
    }

    const allowedUpdates = [
      "title",
      "description",
      "maxMarks",
      "passingMarks",
      "durationInMinutes",
      "startDate",
      "endDate",
      "shuffleQuestions",
      "showResults",
      "showCorrectAnswers",
      "maxAttempts",
    ];

    const filteredUpdateData = Object.keys(updateData)
      .filter((key) => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = updateData[key];
        return obj;
      }, {});

    Object.assign(test, filteredUpdateData);

    const errors = await validate(test);
    if (errors.length > 0) {
      return res.status(400).json({
        error: "Validation failed",
        details: errors,
      });
    }

    const updatedTest = await Test.save(test);

    return res.status(200).json({
      message: "Test updated successfully",
      data: { test: updatedTest },
    });
  } catch (error) {
    console.error("Update test error:", error);
    return res.status(500).json({
      error: "Failed to update test",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const deleteTest = async (req: Request, res: Response) => {
  const { testId } = req.params;

  // Validate testId
  if (!testId || typeof testId !== "string") {
    return res.status(400).json({ error: "Invalid test ID" });
  }

  try {
    const test = await Test.findOne({
      where: { id: testId },
      relations: ["questions", "questions.options"],
    });

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    if (test.questions && test.questions.length > 0) {
      for (const question of test.questions) {
        if (question.options && question.options.length > 0) {
          await QuizOptions.createQueryBuilder()
            .delete()
            .where("questionId = :questionId", {
              questionId: question.id,
            })
            .execute();
        }
      }

      await Question.createQueryBuilder()
        .delete()
        .where("testId = :testId", { testId: test.id })
        .execute();
    }

    await Test.createQueryBuilder()
      .delete()
      .where("id = :id", { id: test.id })
      .execute();

    return res.status(200).json({
      message: "Test and all related content deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting test:", error);
    return res.status(500).json({
      error: "Failed to delete test",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const teststatustoPublish = async (req: Request, res: Response) => {
  const { testId } = req.params;

  // Validate testId
  if (!testId || typeof testId !== "string") {
    return res.status(400).json({ error: "Invalid test ID" });
  }

  try {
    const test = await getSingleRecord<
      Test,
      { where: { id: string }; relations?: string[] }
    >(Test, { where: { id: testId }, relations: ["course"] }, `test:${testId}`);

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const currentDate = new Date();
    if (currentDate >= new Date(test.startDate)) {
      return res.status(400).json({
        error: "Cannot update test after it has started",
      });
    }

    test.status = TestStatus.PUBLISHED;
    await test.save();

    return res.status(200).json({
      message: "Test status updated to PUBLISHED successfully",
    });
  } catch (error) {
    console.error("Error updating test status:", error);
    return res.status(500).json({
      error: "An error occurred while updating the test status",
    });
  }
};

export const deleteQuestion = async (req: Request, res: Response) => {
  try {
    const { testId, questionId } = req.params;

    if (!req.user) {
      return res
        .status(401)
        .json({ error: "Unauthorized: No user authenticated" });
    }

    const question = await getSingleRecord<Question, any>(
      Question,
      {
        where: { id: questionId, test: { id: testId } },
        relations: ["test"],
      },
      `question_${questionId}`,
      false,
    );

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    if (question.test.status === TestStatus.ACTIVE) {
      {
        return res.status(400).json({
          error: "Cannot delete questions from a published test",
        });
      }
    } else if (question.test.status === TestStatus.COMPLETED) {
      return res.status(400).json({
        error: "Cannot delete questions from a completed test",
      });
    }

    await deleteRecords(Question, { id: questionId });

    question.test.lastUpdated = new Date();
    await question.test.save();

    logger.info("Question deleted successfully", { questionId, testId });

    return res.status(200).json({
      data: { message: "Question deleted successfully" },
    });
  } catch (error: any) {
    logger.error("Error deleting question:", {
      message: error.message,
      stack: error.stack,
      testId: req.params.testId,
      questionId: req.params.questionId,
    });
    return res.status(500).json({
      error: error.message || "Failed to delete question",
      details: error.message,
    });
  }
};

export const getSubmissionCount = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    if (!testId || typeof testId !== "string") {
      return res.status(400).json({ error: "Invalid test ID" });
    }

    const submissionCount = await TestSubmission.count({
      where: { test: { id: testId } },
    });

    return res.status(200).json({
      message: "Submission count fetched successfully",
      data: { submissionCount },
    });
  } catch (error) {
    console.error("Error fetching submission count:", error);
    return res.status(500).json({
      error: "Failed to fetch submission count",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const evaluateTestSubmission = async (req: Request, res: Response) => {
  try {
    const { testId, submissionId } = req.params;
    const { responses } = req.body;

    const submission = await getSingleRecord(TestSubmission, {
      where: { id: submissionId, test: { id: testId } },
      relations: ["test", "responses", "responses.question"],
    });

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    if (!Array.isArray(responses)) {
      return res.status(400).json({ message: "Responses must be an array" });
    }

    const responseIds = submission.responses.map((r) => r.id);
    if (!responses.every((r) => responseIds.includes(r.responseId))) {
      return res.status(400).json({ message: "Invalid response IDs" });
    }

    const updatedSubmission =
      await TestSubmission.getRepository().manager.transaction(
        async (manager) => {
          let totalScore = submission.mcqScore || 0;

          await Promise.all(
            responses.map(async (evalResponse) => {
              const response = submission.responses.find(
                (r) => r.id === evalResponse.responseId,
              );
              if (!response || response.question.type === "MCQ") {
                return;
              }

              if (
                evalResponse.score > response.question.marks ||
                evalResponse.score < 0
              ) {
                throw new Error(
                  `Invalid score for response ${evalResponse.responseId}`,
                );
              }

              await manager.update(
                TestResponse,
                { id: evalResponse.responseId },
                {
                  score: evalResponse.score,
                  evaluationStatus: ResponseEvaluationStatus.EVALUATED,
                  evaluatorComments: evalResponse.comments || null,
                },
              );

              totalScore += evalResponse.score;
            }),
          );

          const allEvaluated = submission.responses.every(
            (r) =>
              r.evaluationStatus === "EVALUATED" || r.question.type === "MCQ",
          );
          await manager.update(
            TestSubmission,
            { id: submissionId },
            {
              totalScore,
              status: allEvaluated ? "FULLY_EVALUATED" : "PARTIALLY_EVALUATED",
            },
          );

          return {
            ...submission,
            totalScore,
            status: allEvaluated ? "FULLY_EVALUATED" : "PARTIALLY_EVALUATED",
          };
        },
      );

    res.status(200).json({
      message: "Submission evaluated successfully",
      data: {
        submissionId: updatedSubmission.id,
        totalScore: updatedSubmission.totalScore,
        status: updatedSubmission.status,
      },
    });
  } catch (error) {
    console.error("Error evaluating submission:", error);
    res.status(500).json({
      message: error.message || "Error evaluating submission",
    });
  }
};

export const getTestResponses = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const { questionType, evaluationStatus } = req.query;

    const whereCondition: Record<string, any> = {
      question: { test: { id: testId } },
    };

    if (
      questionType &&
      ["MCQ", "DESCRIPTIVE", "CODE"].includes(questionType as string)
    ) {
      whereCondition.question = {
        ...whereCondition.question,
        type: questionType,
      };
    }

    if (
      evaluationStatus &&
      ["PENDING", "EVALUATED"].includes(evaluationStatus as string)
    ) {
      whereCondition.evaluationStatus = evaluationStatus;
    }

    const responses = await TestResponse.find({
      where: whereCondition,
      relations: ["question", "submission", "submission.user"],
    });

    const formattedResponses = responses.map((response) => ({
      id: response.id,
      answer: response.answer,
      questionId: response.question.id,
      questionType: response.question.type,
      questionText: response.question.question_text,
      marks: response.question.marks,
      evaluationStatus: response.evaluationStatus,
      score: response.score,
      evaluatorComments: response.evaluatorComments,
      submissionId: response.submission.id,
      studentId: response.submission.user.id,
      studentName:
        response.submission.user.username || response.submission.user.email,
    }));

    res.status(200).json({
      message: "Test responses fetched successfully",
      data: { responses: formattedResponses },
    });
  } catch (error) {
    console.error("Error fetching test responses:", error);
    res.status(500).json({ message: "Error fetching test responses" });
  }
};

export const evaluateTestResponseById = async (req: Request, res: Response) => {
  try {
    const { testId, responseId } = req.params;
    const { score, evaluatorComments } = req.body;

    if (score === undefined || typeof score !== "number" || score < 0) {
      return res.status(400).json({ message: "Valid score is required" });
    }

    const response = await getSingleRecord(TestResponse, {
      where: { id: responseId },
      relations: [
        "question",
        "submission",
        "submission.test",
        "submission.responses",
      ],
    });

    if (!response) {
      return res.status(404).json({ message: "Response not found" });
    }

    if (response.submission.test.id !== testId) {
      return res.status(400).json({
        message: "Response does not belong to the specified test",
      });
    }

    if (score > response.question.marks) {
      return res.status(400).json({
        message: `Score cannot exceed maximum marks (${response.question.marks})`,
      });
    }

    await TestResponse.update(
      { id: responseId },
      {
        score: score,
        evaluationStatus: ResponseEvaluationStatus.EVALUATED,
        evaluatorComments: evaluatorComments || null,
      },
    );

    const submission = response.submission;
    const allResponses = submission.responses;

    const evaluatedResponses = await TestResponse.find({
      where: {
        submission: { id: submission.id },
        evaluationStatus: ResponseEvaluationStatus.EVALUATED,
      },
      relations: ["question"],
    });

    const totalScore = evaluatedResponses.reduce(
      (sum, resp) => sum + (resp.score || 0),
      0,
    );

    const allEvaluated = allResponses.every(
      (r) => r.question.type === "MCQ" || r.evaluationStatus === "EVALUATED",
    );

    await TestSubmission.update(
      { id: submission.id },
      {
        totalScore,
        status: allEvaluated ? "FULLY_EVALUATED" : "PARTIALLY_EVALUATED",
      },
    );

    res.status(200).json({
      message: "Response evaluated successfully",
      data: {
        responseId,
        score,
        evaluatorComments,
        submissionStatus: allEvaluated
          ? "FULLY_EVALUATED"
          : "PARTIALLY_EVALUATED",
        submissionId: submission.id,
        totalScore,
      },
    });
  } catch (error) {
    console.error("Error evaluating test response:", error);
    res.status(500).json({ message: "Error evaluating test response" });
  }
};

export const getSubmissionsForEvaluation = async (
  req: Request,
  res: Response,
) => {
  try {
    const { testId } = req.params;
    const { status } = req.query;

    const statusFilter: Record<string, any> = { test: { id: testId } };

    if (
      status &&
      ["SUBMITTED", "PARTIALLY_EVALUATED", "FULLY_EVALUATED"].includes(
        status as string,
      )
    ) {
      statusFilter.status = status;
    }

    const submissions = await getAllRecordsWithFilter(TestSubmission, {
      where: statusFilter,
      relations: ["user", "responses", "responses.question"],
      order: { submittedAt: "DESC" },
    });

    const processedSubmissions = submissions.map((submission) => ({
      id: submission.id,
      submittedAt: submission.submittedAt,
      studentId: submission.user.id,
      studentName: submission.user.username || submission.user.email,
      status: submission.status,
      mcqScore: submission.mcqScore || 0,
      totalScore: submission.totalScore || 0,
      responses: submission.responses.map((response) => ({
        responseId: response.id,
        questionId: response.question.id,
        questionText: response.question.question_text,
        type: response.question.type,
        answer: response.answer, // Ensure the answer is included
        evaluationStatus: response.evaluationStatus,
        score: response.score,
        maxMarks: response.question.marks,
        evaluatorComments: response.evaluatorComments,
      })),
    }));

    res.status(200).json({
      message: "Submissions fetched successfully",
      data: { submissions: processedSubmissions },
    });
  } catch (error) {
    console.error("Error fetching submissions for evaluation:", error);
    res.status(500).json({ message: "Error fetching submissions" });
  }
};

export const getQuestions = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    const test = await getSingleRecord<Test, any>(
      Test,
      {
        where: { id: testId },
        relations: ["questions", "questions.options"],
      },
      `test_${testId}_detailed`,
      true,
    );

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const questionsWithHtml =
      test.questions?.map((question) => {
        console.log(" BACKEND GET - Retrieving question:", {
          questionId: question.id,
          text_length: question.question_text?.length,
          has_html_tags: question.question_text?.includes("<"),
          text_preview: question.question_text?.substring(0, 100),
        });

        return {
          ...question,
          question_text: question.question_text || "", // Keep HTML formatting
        };
      }) || [];

    console.log(" BACKEND GET - Retrieved questions successfully:", {
      testId,
      questionsCount: questionsWithHtml.length,
      firstQuestionHasHtml: questionsWithHtml[0]?.question_text?.includes("<"),
    });

    return res.status(200).json({
      message: "Questions retrieved successfully",
      data: { questions: questionsWithHtml }, // Note: your API expects data.questions based on frontend
    });
  } catch (error) {
    console.error(" BACKEND GET ERROR:", error);
    logger.error("Error retrieving questions:", error);
    return res.status(500).json({ error: "Failed to retrieve questions" });
  }
};

export const updateQuestion = async (req: Request, res: Response) => {
  try {
    const { testId, questionId } = req.params;
    const { question_text, type, marks, options, expectedWordCount } = req.body;

    console.log(" BACKEND UPDATE - Received data:", {
      testId,
      questionId,
      question_text_length: question_text?.length,
      question_text_content: question_text,
      has_html_tags: question_text?.includes("<"),
      type,
      marks,
    });

    const question = await getSingleRecord<Question, any>(
      Question,
      {
        where: { id: questionId, test: { id: testId } },
        relations: ["test", "options"],
      },
      `question_${questionId}`,
      true,
    );

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    if (question.test.status !== TestStatus.DRAFT) {
      return res.status(400).json({
        error: "Cannot update questions on a published test",
      });
    }

    if (question_text !== undefined) {
      const sanitizedQuestionText = sanitizeHtml(question_text, {
        allowedTags: [
          "p",
          "br",
          "div",
          "span",
          "strong",
          "b",
          "em",
          "i",
          "u",
          "s",
          "sub",
          "sup",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "ul",
          "ol",
          "li",
          "code",
          "pre",
          "blockquote",
          "a",
        ],
        allowedAttributes: {
          "*": [
            "style",
            "class",
            "id",
            "data-*",
            "spellcheck",
            "contenteditable",
            "dir",
          ],
          a: ["href", "target", "rel"],
          img: ["src", "alt", "width", "height"],
        },
        allowedStyles: {
          "*": {
            "font-weight": [/^.*$/],
            "font-style": [/^.*$/],
            "text-decoration": [/^.*$/],
            "text-decoration-line": [/^.*$/],
            color: [/^.*$/],
            "background-color": [/^.*$/],
            "font-size": [/^.*$/],
            "font-family": [/^.*$/],
            "line-height": [/^.*$/],
            margin: [/^.*$/],
            "margin-top": [/^.*$/],
            "margin-bottom": [/^.*$/],
            "margin-left": [/^.*$/],
            "margin-right": [/^.*$/],
            padding: [/^.*$/],
            "padding-top": [/^.*$/],
            "padding-bottom": [/^.*$/],
            "padding-left": [/^.*$/],
            "padding-right": [/^.*$/],
            "text-align": [/^.*$/],
            "white-space": [/^.*$/],
            display: [/^.*$/],
            "list-style": [/^.*$/],
            "list-style-type": [/^.*$/],
            border: [/^.*$/],
            "border-left": [/^.*$/],
            "border-radius": [/^.*$/],
            overflow: [/^.*$/],
            "overflow-x": [/^.*$/],
            "box-sizing": [/^.*$/],
            clear: [/^.*$/],
          },
        },
        allowVulnerableTags: false,
        transformTags: {},
        allowedClasses: { "*": true },
        allowProtocolRelative: false,
        enforceHtmlBoundary: false,
      });

      console.log(" BACKEND UPDATE - Sanitization result:", {
        beforeSanitization_length: question_text?.length,
        beforeSanitization_content: question_text,
        beforeSanitization_hasHTML: question_text?.includes("<"),
        afterSanitization_length: sanitizedQuestionText.length,
        afterSanitization_content: sanitizedQuestionText,
        afterSanitization_hasHTML: sanitizedQuestionText.includes("<"),
        sanitizationStrippedHTML:
          question_text?.includes("<") && !sanitizedQuestionText.includes("<"),
      });

      if (!sanitizedQuestionText || !sanitizedQuestionText.trim()) {
        return res.status(400).json({
          error: "Question text cannot be empty after sanitization",
        });
      }

      question.question_text = sanitizedQuestionText;
    }

    if (marks !== undefined) question.marks = marks;
    if (type) {
      question.type = type as QuestionType;
    }

    if (
      expectedWordCount !== undefined &&
      (type === "DESCRIPTIVE" || type === "CODE")
    ) {
      question.expectedWordCount = expectedWordCount;
    }

    await question.save();

    if (
      options &&
      Array.isArray(options) &&
      question.type === QuestionType.MCQ
    ) {
      if (question.options && question.options.length > 0) {
        await Promise.all(
          question.options.map((option) =>
            deleteRecords(QuizOptions, { id: option.id }),
          ),
        );
      }

      if (options.length < 2) {
        return res.status(400).json({
          error: "MCQ must have at least 2 options",
        });
      }

      let hasCorrectOption = false;

      for (const opt of options) {
        const { text, correct } = opt;

        if (!text || typeof text !== "string" || !text.trim()) {
          return res.status(400).json({
            error: "All options must have non-empty text",
          });
        }

        if (correct) hasCorrectOption = true;

        const option = new QuizOptions();
        option.text = text.trim();
        option.correct = correct || false;
        option.question = question;

        await createRecord(QuizOptions.getRepository(), option);
      }

      if (!hasCorrectOption) {
        return res.status(400).json({
          error: "MCQ must have at least one correct option",
        });
      }
    }

    question.test.lastUpdated = new Date();
    await question.test.save();

    await redisClient.del(`question_${questionId}`);
    await redisClient.del(`test_${testId}_detailed`);

    const updatedQuestion = await getSingleRecord<Question, any>(Question, {
      where: { id: questionId },
      relations: ["options"],
    });

    console.log(" BACKEND UPDATE - Final result:", {
      questionId,
      final_text_length: updatedQuestion?.question_text?.length,
      final_text_content: updatedQuestion?.question_text,
      final_has_html: updatedQuestion?.question_text?.includes("<"),
      final_preview: updatedQuestion?.question_text?.substring(0, 100),
    });

    return res.status(200).json({
      message: "Question updated successfully",
      question: updatedQuestion,
    });
  } catch (error) {
    console.error(" BACKEND UPDATE ERROR:", error);
    logger.error("Error updating question:", error);
    return res.status(500).json({ error: "Failed to update question" });
  }
};

export const createQuestion = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const { question_text, type, marks, options, expectedWordCount } = req.body;

    console.log(" BACKEND STEP 1 - Received data:", {
      question_text_length: question_text?.length,
      question_text_content: question_text,
      has_html_tags: question_text?.includes("<"),
      type,
      marks,
    });

    if (!question_text || !type || !marks) {
      return res.status(400).json({
        error: "question_text, type, and marks are required",
      });
    }

    if (!["MCQ", "DESCRIPTIVE", "CODE"].includes(type)) {
      return res.status(400).json({ error: "Invalid question type" });
    }

    if (marks <= 0) {
      return res.status(400).json({ error: "Marks must be greater than zero" });
    }

    const sanitizedQuestionText = sanitizeHtml(question_text, {
      allowedTags: [
        "p",
        "br",
        "div",
        "span",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "s",
        "sub",
        "sup",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "ul",
        "ol",
        "li",
        "code",
        "pre",
        "blockquote",
        "a",
      ],
      allowedAttributes: {
        "*": [
          "style",
          "class",
          "id",
          "data-*",
          "spellcheck",
          "contenteditable",
          "dir",
        ],
        a: ["href", "target", "rel"],
        img: ["src", "alt", "width", "height"],
      },
      allowedStyles: {
        "*": {
          "font-weight": [/^.*$/],
          "font-style": [/^.*$/],
          "text-decoration": [/^.*$/],
          "text-decoration-line": [/^.*$/],
          color: [/^.*$/],
          "background-color": [/^.*$/],
          "font-size": [/^.*$/],
          "font-family": [/^.*$/],
          "line-height": [/^.*$/],
          margin: [/^.*$/],
          "margin-top": [/^.*$/],
          "margin-bottom": [/^.*$/],
          "margin-left": [/^.*$/],
          "margin-right": [/^.*$/],
          padding: [/^.*$/],
          "padding-top": [/^.*$/],
          "padding-bottom": [/^.*$/],
          "padding-left": [/^.*$/],
          "padding-right": [/^.*$/],
          "text-align": [/^.*$/],
          "white-space": [/^.*$/],
          display: [/^.*$/],
          "list-style": [/^.*$/],
          "list-style-type": [/^.*$/],
          border: [/^.*$/],
          "border-left": [/^.*$/],
          "border-radius": [/^.*$/],
          overflow: [/^.*$/],
          "overflow-x": [/^.*$/],
          "box-sizing": [/^.*$/],
          clear: [/^.*$/],
        },
      },
      allowVulnerableTags: false,
      transformTags: {},
      allowedClasses: {
        "*": true,
      },
      allowProtocolRelative: false,
      enforceHtmlBoundary: false,
    });

    console.log(" BACKEND STEP 2 - Sanitization result:", {
      beforeSanitization_length: question_text?.length,
      beforeSanitization_content: question_text,
      beforeSanitization_hasHTML: question_text?.includes("<"),
      afterSanitization_length: sanitizedQuestionText.length,
      afterSanitization_content: sanitizedQuestionText,
      afterSanitization_hasHTML: sanitizedQuestionText.includes("<"),
      sanitizationStrippedHTML:
        question_text?.includes("<") && !sanitizedQuestionText.includes("<"),
    });

    if (!sanitizedQuestionText || !sanitizedQuestionText.trim()) {
      return res.status(400).json({
        error: "Question text cannot be empty after sanitization",
      });
    }

    const test = await getSingleRecord<Test, any>(
      Test,
      { where: { id: testId } },
      `test_${testId}`,
      true,
    );

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    if (test.status !== TestStatus.DRAFT) {
      return res.status(400).json({
        error: "Cannot add questions to a published test",
      });
    }

    const question = new Question();
    question.question_text = sanitizedQuestionText;
    question.type = type as QuestionType;
    question.marks = marks;
    question.test = test;

    if (expectedWordCount && (type === "DESCRIPTIVE" || type === "CODE")) {
      question.expectedWordCount = expectedWordCount;
    }

    const savedQuestion = (await createRecord(
      Question.getRepository(),
      question,
    )) as Question;

    console.log(" BACKEND STEP 3 - Question saved:", {
      questionId: savedQuestion.id,
      stored_text_length: savedQuestion.question_text?.length,
      stored_text_content: savedQuestion.question_text,
      stored_has_html: savedQuestion.question_text?.includes("<"),
    });

    if (type === "MCQ" && options && Array.isArray(options)) {
      if (options.length < 2) {
        return res.status(400).json({
          error: "MCQ must have at least 2 options",
        });
      }

      let hasCorrectOption = false;

      for (const opt of options) {
        const { text, correct } = opt;

        if (!text || typeof text !== "string" || !text.trim()) {
          return res.status(400).json({
            error: "All options must have non-empty text",
          });
        }

        if (correct) hasCorrectOption = true;

        const option = new QuizOptions();
        option.text = text.trim();
        option.correct = correct || false;
        option.question = savedQuestion;

        await createRecord(QuizOptions.getRepository(), option);
      }

      if (!hasCorrectOption) {
        return res.status(400).json({
          error: "MCQ must have at least one correct option",
        });
      }
    }

    test.lastUpdated = new Date();
    await test.save();

    await redisClient.del(`test_${testId}_detailed`);

    const completeQuestion = await getSingleRecord<Question, any>(Question, {
      where: { id: savedQuestion.id },
      relations: ["options"],
    });

    console.log(" BACKEND STEP 4 - Final stored question:", {
      questionId: completeQuestion.id,
      final_text_length: completeQuestion.question_text?.length,
      final_text_content: completeQuestion.question_text,
      final_has_html: completeQuestion.question_text?.includes("<"),
    });

    return res.status(201).json({
      message: "Question created successfully",
      question: completeQuestion,
    });
  } catch (error) {
    console.error(" BACKEND CREATE ERROR:", error);
    logger.error("Error creating question:", error);
    return res.status(500).json({ error: "Failed to create question" });
  }
};
