import { Request, Response } from "express";
import { Module } from "../../db/mysqlModels/Module";
import { Course } from "../../db/mysqlModels/Course";
import {
  createRecord,
  getSingleRecord,
  updateRecords,
  deleteRecords,
  getAllRecordsWithFilter,
} from "../../lib/dbLib/sqlUtils";

// Get all modules for a course
export const getAllModules = async (req: Request, res: Response) => {
  const { courseId } = req.params;
  
  console.log("=== getAllModules Controller Called ===");
  console.log("Course ID:", courseId);
  console.log("Full URL:", req.originalUrl);
  console.log("User:", req.user);

  try {
    console.log(`Getting all modules for Course ID: ${courseId}`);
    
    // Verify the course exists
    const course = await getSingleRecord(Course, {
      where: { id: courseId },
    });

    if (!course) {
      console.log(`Course not found with ID: ${courseId}`);
      return res.status(404).json({ message: "Course not found" });
    }

    console.log(`Course found: ${course.id} - ${course.title}`);

    // Get all modules for this course with day content
    const modules = await getAllRecordsWithFilter(Module, {
      where: { course: { id: courseId } },
      relations: ["days"],
      order: { 
        order: "ASC",
        days: { dayNumber: "ASC" }
      },
    });
    
    console.log(`Found ${modules.length} modules for course: ${courseId}`);
    
    res.status(200).json(modules);
  } catch (error) {
    console.error(`Error fetching modules for course ${courseId}:`, error);
    res.status(500).json({ message: "Error fetching modules" });
  }
};

// Get a single module
export const getSingleModule = async (req: Request, res: Response) => {
  const { courseId, moduleId } = req.params;

  try {
    // Verify the course exists
    const course = await getSingleRecord(Course, {
      where: { id: courseId },
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Get the module
    const module = await getSingleRecord(Module, {
      where: { id: moduleId, course: { id: courseId } },
      relations: ["course"],
    });

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    res.status(200).json(module);
  } catch (error) {
    console.error("Error fetching module:", error);
    res.status(500).json({ message: "Error fetching module" });
  }
};

// Create a new module
export const createModule = async (req: Request, res: Response) => {
  const { courseId } = req.params;
  const { title, order } = req.body;

  try {
    // Validate input
    if (!title) {
      return res.status(400).json({ message: "Module title is required" });
    }

    // Verify the course exists
    const course = await getSingleRecord(Course, {
      where: { id: courseId },
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Create the module
    const newModule = Module.create({
      title,
      order: order || 0,
      course,
    });

    const savedModule = await createRecord(Module, newModule);

    res.status(201).json({
      message: "Module created successfully",
      module: savedModule,
    });
  } catch (error) {
    console.error("Error creating module:", error);
    res.status(500).json({ message: "Error creating module" });
  }
};

// Update an existing module
export const updateModule = async (req: Request, res: Response) => {
  const { courseId, moduleId } = req.params;
  const { title, order } = req.body;

  try {
    // Verify the course exists
    const course = await getSingleRecord(Course, {
      where: { id: courseId },
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Get the module
    const module = await getSingleRecord(Module, {
      where: { id: moduleId, course: { id: courseId } },
    });

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    // Update the module
    if (title) module.title = title;
    if (order !== undefined) module.order = order;

    await module.save();

    res.status(200).json({
      message: "Module updated successfully",
      module: module,
    });
  } catch (error) {
    console.error("Error updating module:", error);
    res.status(500).json({ message: "Error updating module" });
  }
};

// Delete a module
export const deleteModule = async (req: Request, res: Response) => {
  const { courseId, moduleId } = req.params;

  try {
    // Verify the course exists
    const course = await getSingleRecord(Course, {
      where: { id: courseId },
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Get the module
    const module = await getSingleRecord(Module, {
      where: { id: moduleId, course: { id: courseId } },
    });

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    // Delete the module
    await deleteRecords(Module, { id: moduleId });

    res.status(200).json({ message: "Module deleted successfully" });
  } catch (error) {
    console.error("Error deleting module:", error);
    res.status(500).json({ message: "Error deleting module" });
  }
};
