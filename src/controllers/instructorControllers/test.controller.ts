import { Request, Response } from "express";
import { Test } from "../../db/mysqlModels/Test";
import { Course } from "../../db/mysqlModels/Course";
import {
  createRecord,
  getSingleRecord,
  deleteRecords,
  updateRecords,
} from "../../lib/dbLib/sqlUtils";

export const createTest = async (req: Request, res: Response) => {
  const { courseId } = req.params;
  const {
    title,
    description,
    questions,
    maxMarks,
    durationInMinutes,
    startDate,
    endDate,
  } = req.body;

  
  if (
    !title ||
    !maxMarks ||
    !questions ||
    !durationInMinutes ||
    !startDate ||
    !endDate
  ) {
    return res.status(400).json({
      error:
        "Missing required fields: title, questions, maxMarks, duration, startDate, endDate",
    });
  }

  try {
    const course = await getSingleRecord<Course, any>(
      Course,
      { where: { id: courseId } },
      `course:${courseId}`
    );

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    const test = new Test();
    test.title = title;
    test.description = description;
    test.questions = questions;
    test.maxMarks = maxMarks;
    test.durationInMinutes = durationInMinutes;
    test.startDate = startDate;
    test.endDate = endDate;
    test.course = course;

    const newTest = await createRecord<Test>(
      Test,
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

  

  try {
    const course = await getSingleRecord<Course, any>(
      Course,
      { where: { id: courseId } },
      `course:${courseId}`
    );

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    const tests = await Test.find({
      where: { course: course },
      relations: ["course"],
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

  

  try {
    const test = await getSingleRecord<Test, any>(
      Test,
      { where: { id: testId } }, 
      `test:${testId}`,
      true
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



export const deleteTest = async (req: Request, res: Response) => {
  const { testId } = req.params;


  try {
    const test = await getSingleRecord<Test, any>(
      Test,
      { where: { id: testId } },
      `test:${testId}`
    );

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const currentDate = new Date();
    const startDate = new Date(test.startDate);

    if (currentDate >= startDate) {
      return res.status(400).json({
        error: "Test cannot be deleted after the start date",
      });
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

export const updateTest = async (req: Request, res: Response) => {
  const { testId } = req.params;
  const {
    title,
    description,
    questions,
    maxMarks,
    durationInMinutes,
    startDate,
    endDate,
  } = req.body;

  if (!testId || isNaN(Number(testId))) {
    return res.status(400).json({ error: "Invalid test ID" });
  }

  try {
    const test = await getSingleRecord<Test, any>(
      Test,
      { where: { id: Number(testId) } },
      `test:${testId}`,
      true
    );

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const currentDate = new Date();
    const testStartDate = new Date(test.startDate);

    if (currentDate >= testStartDate) {
      return res.status(400).json({
        error: "You cannot update the test once it has started",
      });
    }

    test.title = title || test.title;
    test.description = description || test.description;
    test.questions = questions || test.questions;
    test.maxMarks = maxMarks || test.maxMarks;
    test.durationInMinutes = durationInMinutes || test.durationInMinutes;
    test.startDate = startDate || test.startDate;
    test.endDate = endDate || test.endDate;

    const updatedTest = await updateRecords(
      Test,
      test,
      `test:${testId}:update`,
      false
    );

    return res.status(200).json({
      message: "Test updated successfully",
      data: { test: updatedTest },
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to update test",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
