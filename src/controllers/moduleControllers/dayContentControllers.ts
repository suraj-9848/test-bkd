import { Request, Response } from "express";
import { Module } from "../../db/mysqlModels/Module";
import { DayContent } from "../../db/mysqlModels/DayContent";

// Add Day Content
export const addDayContent = async (req: Request, res: Response) => {
  const { moduleId, content } = req.body;

  try {
    const module = await Module.findOne({ where: { id: moduleId } });

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    const lastDay = await DayContent.findOne({
      where: { module: { id: moduleId } },
      order: { dayNumber: "DESC" },
    });

    const newDayNumber = lastDay ? lastDay.dayNumber + 1 : 1;

    const newDayContent = DayContent.create({
      module,
      content,
      dayNumber: newDayNumber,
      completed: false,
    });

    await newDayContent.save();
    res.status(201).json(newDayContent);
  } catch (error) {
    console.error("Error adding day content:", error);
    res.status(500).json({ message: "Error adding day content" });
  }
};

// Get Day Content by Module ID
export const getDayContent = async (req: Request, res: Response) => {
  const { moduleId } = req.params;

  try {
    const module = await Module.findOne({
      where: { id: moduleId },
      relations: ["days"],
      order: { days: { dayNumber: "ASC" } },
    });

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    res.status(200).json(module.days);
  } catch (error) {
    console.error("Error fetching day content:", error);
    res.status(500).json({ message: "Error fetching day content" });
  }
};

// Update Day Content
export const updateDayContent = async (req: Request, res: Response) => {
  const { dayId } = req.params;
  const { content } = req.body;

  try {
    const dayContent = await DayContent.findOne({ where: { id: dayId } });

    if (!dayContent) {
      return res.status(404).json({ message: "Day content not found" });
    }

    if (content !== undefined) dayContent.content = content;

    await dayContent.save();
    res.status(200).json(dayContent);
  } catch (error) {
    console.error("Error updating day content:", error);
    res.status(500).json({ message: "Error updating day content" });
  }
};

// Delete Day Content
export const deleteDayContent = async (req: Request, res: Response) => {
  const { dayId } = req.params;

  try {
    const dayContent = await DayContent.findOne({ where: { id: dayId } });

    if (!dayContent) {
      return res.status(404).json({ message: "Day content not found" });
    }

    await dayContent.remove();
    res.status(200).json({ message: "Day content deleted successfully" });
  } catch (error) {
    console.error("Error deleting day content:", error);
    res.status(500).json({ message: "Error deleting day content" });
  }
};

// Mark Day as Completed
export const markDayAsCompleted = async (req: Request, res: Response) => {
  const { dayId } = req.params;

  try {
    const dayContent = await DayContent.findOne({ where: { id: dayId } });

    if (!dayContent) {
      return res.status(404).json({ message: "Day content not found" });
    }

    dayContent.completed = true;
    await dayContent.save();

    res.status(200).json({ message: "Day marked as completed", dayContent });
  } catch (error) {
    console.error("Error marking day as completed:", error);
    res.status(500).json({ message: "Error marking day as completed" });
  }
};
