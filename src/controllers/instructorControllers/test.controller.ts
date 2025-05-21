import { Request, Response } from "express";
import { Test, TestStatus } from "../../db/mysqlModels/Test";
import { Course } from "../../db/mysqlModels/Course";
import {
  createRecord,
  getSingleRecord,
  deleteRecords,
  updateRecords,
} from "../../lib/dbLib/sqlUtils";
import { validate } from "class-validator";

export const createTest = async (req: Request, res: Response) => {
  const { courseId } = req.params;
  const {
    title,
    description = "",
    maxMarks,
    passingMarks = 0,
    durationInMinutes,
    startDate,
    endDate,
    shuffleQuestions = false,
    showResults = false,
    showCorrectAnswers = false,
    maxAttempts = 1,
  } = req.body;

  // Validation for required fields
  if (
    !title ||
    maxMarks === undefined ||
    !durationInMinutes ||
    !startDate ||
    !endDate
  ) {
    return res.status(400).json({
      error:
        "Missing required fields: title, maxMarks, durationInMinutes, startDate, endDate",
    });
  }

  // Additional validations
  if (typeof maxMarks !== "number" || maxMarks < 0 || passingMarks < 0) {
    return res
      .status(400)
      .json({ error: "Marks must be non-negative numbers" });
  }
  if (passingMarks > maxMarks) {
    return res
      .status(400)
      .json({ error: "Passing marks cannot exceed max marks" });
  }
  if (new Date(endDate) <= new Date(startDate)) {
    return res.status(400).json({ error: "End date must be after start date" });
  }
  if (typeof durationInMinutes !== "number" || durationInMinutes <= 0) {
    return res
      .status(400)
      .json({ error: "Duration must be a positive number" });
  }
  if (typeof maxAttempts !== "number" || maxAttempts < 1) {
    return res.status(400).json({ error: "Max attempts must be at least 1" });
  }
  if (
    typeof shuffleQuestions !== "boolean" ||
    typeof showResults !== "boolean" ||
    typeof showCorrectAnswers !== "boolean"
  ) {
    return res
      .status(400)
      .json({ error: "Boolean fields must be true or false" });
  }

  try {
    // Verify course exists
    const course = await getSingleRecord<Course, any>(
      Course,
      { where: { id: courseId } },
      `course:${courseId}`
    );

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Create new test instance
    const test = new Test();
    test.title = title;
    test.description = description;
    test.questions = []; // Initialize with empty array
    test.maxMarks = maxMarks;
    test.passingMarks = passingMarks;
    test.durationInMinutes = durationInMinutes;
    test.startDate = new Date(startDate);
    test.endDate = new Date(endDate);
    test.course = course;
    test.status = TestStatus.DRAFT;
    test.shuffleQuestions = shuffleQuestions;
    test.showResults = showResults;
    test.showCorrectAnswers = showCorrectAnswers;
    test.maxAttempts = maxAttempts;

    // Validate entity
    const errors = await validate(test);
    if (errors.length > 0) {
      return res
        .status(400)
        .json({ error: "Validation failed", details: errors });
    }

    // Save the test
    const newTest = await createRecord<Test>(
      Test.getRepository(),
      test,
      `test:course:${courseId}:new`,
      600
    );

    return res.status(201).json({
      message: "Test created successfully",
      data: { test: newTest },
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to create test",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const fetchTestsInCourse = async (req: Request, res: Response) => {
  const { courseId } = req.params;

  // Validate courseId
  if (!courseId || typeof courseId !== "string") {
    return res.status(400).json({ error: "Invalid course ID" });
  }

  try {
    const course = await getSingleRecord<Course, any>(
      Course,
      { where: { id: courseId } },
      `course:${courseId}`,
      false
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
    const test = await getSingleRecord<Test, any>(
      Test,
      { where: { id: testId }, relations: ["course", "questions"] },
      `test:${testId}`
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
    // First fetch the test with course relation
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

    // Check if test has started
    const currentDate = new Date();
    if (currentDate >= test.startDate) {
      return res.status(400).json({
        error: "Cannot update test after it has started",
      });
    }

    // Update allowed fields only
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

    // Apply updates
    Object.assign(test, filteredUpdateData);

    // Validate the updated entity
    const errors = await validate(test);
    if (errors.length > 0) {
      return res.status(400).json({
        error: "Validation failed",
        details: errors,
      });
    }

    // Save changes
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
    const test = await getSingleRecord<Test, any>(
      Test,
      { where: { id: testId }, relations: ["course"] },
      `test:${testId}`
    );

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const deletedTest = await deleteRecords(Test, { id: testId });

    if (!deletedTest.affected) {
      return res.status(404).json({ error: "Test not found" });
    }

    return res.status(200).json({
      message: "Test deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to delete test",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};