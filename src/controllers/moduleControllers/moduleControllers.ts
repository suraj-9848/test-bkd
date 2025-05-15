import { Request, Response } from "express";
import { Course } from "../../db/mysqlModels/Course";
import { Module } from "../../db/mysqlModels/Module";

// Create Module
export const createModule = async (req: Request, res: Response) => {
  const { courseId } = req.params;
  const { title, order } = req.body;

  try {
    const course = await Course.findOne({ where: { id: courseId } });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const newModule = Module.create({
      course,
      title,
      order,
      isLocked: order !== 1,
    });

    await newModule.save();

    res.status(201).json(newModule);
  } catch (error) {
    console.error("Error creating module:", error);
    res.status(500).json({ message: "Error creating module" });
  }
};

// Get All Modules in a Course
export const getAllModules = async (req: Request, res: Response) => {
  const { courseId } = req.params;

  try {
    const modules = await Module.find({
      where: { course: { id: courseId } },
      order: { order: "ASC" },
    });

    res.status(200).json(modules);
  } catch (error) {
    console.error("Error fetching modules:", error);
    res.status(500).json({ message: "Error fetching modules" });
  }
};

// Get Single Module by ID
export const getSingleModule = async (req: Request, res: Response) => {
  const { moduleId } = req.params;

  try {
    const module = await Module.findOne({ where: { id: moduleId } });

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    res.status(200).json(module);
  } catch (error) {
    console.error("Error fetching module:", error);
    res.status(500).json({ message: "Error fetching module" });
  }
};

// Delete Module
export const deleteModule = async (req: Request, res: Response) => {
  const { moduleId } = req.params;

  try {
    const module = await Module.findOne({ where: { id: moduleId } });

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    await module.remove();

    res.status(200).json({ message: "Module deleted successfully" });
  } catch (error) {
    console.error("Error deleting module:", error);
    res.status(500).json({ message: "Error deleting module" });
  }
};

// Update Module
export const updateModule = async (req: Request, res: Response) => {
  const { moduleId } = req.params;
  const { title, order, isLocked } = req.body;

  try {
    const module = await Module.findOne({ where: { id: moduleId } });

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    if (title !== undefined) module.title = title;
    if (order !== undefined) module.order = order;
    if (isLocked !== undefined) module.isLocked = isLocked;

    await module.save();

    res.status(200).json(module);
  } catch (error) {
    console.error("Error updating module:", error);
    res.status(500).json({ message: "Error updating module" });
  }
};

// Unlock Next Module
export const unlockNextModule = async (
  currentModuleId: string,
): Promise<void> => {
  try {
    const currentModule = await Module.findOne({
      where: { id: currentModuleId },
      relations: ["course"],
    });

    if (!currentModule) return;

    const nextModule = await Module.findOne({
      where: {
        course: { id: currentModule.course.id },
        order: currentModule.order + 1,
      },
    });

    if (nextModule && nextModule.isLocked) {
      nextModule.isLocked = false;
      await nextModule.save();
    }
  } catch (error) {
    console.error("Error unlocking next module:", error);
  }
};
