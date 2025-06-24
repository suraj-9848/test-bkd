import { Request, Response } from "express";
import { Course } from "../../db/mysqlModels/Course";
import { Module } from "../../db/mysqlModels/Module";
import {
  createRecord,
  getSingleRecord,
  getAllRecordsWithFilter,
  updateRecords,
  deleteRecords,
} from "../../lib/dbLib/sqlUtils";

// ==================== CREATE MODULE ====================
export const createModule = async (req: Request, res: Response) => {
  const { courseId } = req.params;
  const { title, order, isLocked } = req.body;

  try {
    // Validate required fields
    if (!title || order === undefined) {
      return res.status(400).json({
        message: "Title and order are required fields",
      });
    }

    // Check if course exists
    const course = await getSingleRecord(Course, {
      where: { id: courseId },
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Check if module with same order already exists
    const existingModule = await getSingleRecord(Module, {
      where: { course: { id: courseId }, order },
    });

    if (existingModule) {
      return res.status(400).json({
        message: `Module with order ${order} already exists in this course`,
      });
    }

    const newModule = Module.create({
      course,
      title,
      order,
      isLocked: isLocked !== undefined ? isLocked : order !== 1, // First module unlocked by default
    });

    const savedModule = await createRecord(Module.getRepository(), newModule);

    res.status(201).json({
      message: "Module created successfully",
      module: savedModule,
    });
  } catch (error) {
    console.error("Error creating module:", error);
    res.status(500).json({ message: "Error creating module" });
  }
};

// ==================== GET ALL MODULES ====================
export const getAllModules = async (req: Request, res: Response) => {
  const { courseId } = req.params;

  try {
    // Verify course exists
    const course = await getSingleRecord(Course, {
      where: { id: courseId },
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const modules = await getAllRecordsWithFilter(Module, {
      where: { course: { id: courseId } },
      relations: ["days"], // Include related day content
      order: { order: "ASC" },
    });

    res.status(200).json({
      message: "Modules fetched successfully",
      modules,
    });
  } catch (error) {
    console.error("Error fetching modules:", error);
    res.status(500).json({ message: "Error fetching modules" });
  }
};

// ==================== GET SINGLE MODULE ====================
export const getSingleModule = async (req: Request, res: Response) => {
  const { moduleId } = req.params;

  try {
    const module = await getSingleRecord(Module, {
      where: { id: moduleId },
      relations: ["course", "days", "tests"], // Include all related entities
    });

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    res.status(200).json({
      message: "Module fetched successfully",
      module,
    });
  } catch (error) {
    console.error("Error fetching module:", error);
    res.status(500).json({ message: "Error fetching module" });
  }
};

// ==================== UPDATE MODULE ====================
export const updateModule = async (req: Request, res: Response) => {
  const { moduleId } = req.params;
  const { title, order, isLocked } = req.body;

  try {
    // Check if module exists
    const existingModule = await getSingleRecord(Module, {
      where: { id: moduleId },
      relations: ["course"],
    });

    if (!existingModule) {
      return res.status(404).json({ message: "Module not found" });
    }

    // If order is being changed, check for conflicts
    if (order !== undefined && order !== existingModule.order) {
      const conflictingModule = await getSingleRecord(Module, {
        where: {
          course: { id: existingModule.course.id },
          order,
        },
      });

      if (conflictingModule && conflictingModule.id !== moduleId) {
        return res.status(400).json({
          message: `Module with order ${order} already exists in this course`,
        });
      }
    }

    const updateData: Partial<Module> = {};
    if (title !== undefined) updateData.title = title;
    if (order !== undefined) updateData.order = order;
    if (isLocked !== undefined) updateData.isLocked = isLocked;

    const result = await updateRecords(
      Module,
      { id: moduleId },
      updateData,
      false,
    );

    if (!result || result.affected === 0) {
      return res.status(404).json({ message: "Module not found" });
    }

    // Fetch updated module
    const updatedModule = await getSingleRecord(Module, {
      where: { id: moduleId },
      relations: ["course", "days"],
    });

    res.status(200).json({
      message: "Module updated successfully",
      module: updatedModule,
    });
  } catch (error) {
    console.error("Error updating module:", error);
    res.status(500).json({ message: "Error updating module" });
  }
};

// ==================== DELETE MODULE ====================
export const deleteModule = async (req: Request, res: Response) => {
  const { moduleId } = req.params;

  try {
    // Check if module exists
    const module = await getSingleRecord(Module, {
      where: { id: moduleId },
      relations: ["days", "tests"],
    });

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    // Check if module has dependencies (days or tests)
    if (module.days && module.days.length > 0) {
      return res.status(400).json({
        message:
          "Cannot delete module with existing day content. Please remove day content first.",
      });
    }

    if (module.tests && module.tests.length > 0) {
      return res.status(400).json({
        message:
          "Cannot delete module with existing tests. Please remove tests first.",
      });
    }

    const result = await deleteRecords(Module, { id: moduleId });

    if (!result || result.affected === 0) {
      return res.status(404).json({ message: "Module not found" });
    }

    res.status(200).json({
      message: "Module deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting module:", error);
    res.status(500).json({ message: "Error deleting module" });
  }
};

// ==================== UTILITY FUNCTIONS ====================

// Unlock Next Module - Helper function for module progression
export const unlockNextModule = async (
  currentModuleId: string,
): Promise<void> => {
  try {
    const currentModule = await getSingleRecord(Module, {
      where: { id: currentModuleId },
      relations: ["course"],
    });

    if (!currentModule) return;

    const nextModule = await getSingleRecord(Module, {
      where: {
        course: { id: currentModule.course.id },
        order: currentModule.order + 1,
      },
    });

    if (nextModule && nextModule.isLocked) {
      await updateRecords(
        Module,
        { id: nextModule.id },
        { isLocked: false },
        false,
      );
    }
  } catch (error) {
    console.error("Error unlocking next module:", error);
  }
};

// Get Module Order in Course - Helper function
export const getModuleOrderInCourse = async (
  courseId: string,
): Promise<number> => {
  try {
    const modules = await getAllRecordsWithFilter(Module, {
      where: { course: { id: courseId } },
      order: { order: "DESC" },
    });

    return modules.length > 0 ? modules[0].order + 1 : 1;
  } catch (error) {
    console.error("Error getting module order:", error);
    return 1;
  }
};
