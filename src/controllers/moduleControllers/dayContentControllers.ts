import { Request, Response } from "express";
import { Module } from "../../db/mysqlModels/Module";
import { DayContent } from "../../db/mysqlModels/DayContent";
import sanitizeHtml from "sanitize-html";

// Utility to sanitize HTML content
const sanitizeContent = (content: string): string => {
  return sanitizeHtml(content, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "h1",
      "h2",
      "h3",
      "p",
      "ul",
      "ol",
      "li",
      "a",
    ]),
    allowedAttributes: {
      a: ["href", "target"],
      img: ["src", "alt"],
    },
  });
};

// Helper function to find a module by ID
const findModuleById = async (moduleId: string) => {
  return await Module.findOne({ where: { id: moduleId } });
};

// Add Day Content
export const addDayContent = async (req: Request, res: Response) => {
  const { moduleId, content } = req.body;

  try {
    const module = await findModuleById(moduleId);
    if (!module) return res.status(404).json({ message: "Module not found" });

    const safeContent = sanitizeContent(content);

    const lastDay = await DayContent.findOne({
      where: { module: { id: moduleId } },
      order: { dayNumber: "DESC" },
    });
    const newDayNumber = lastDay ? lastDay.dayNumber + 1 : 1;

    const newDayContent = DayContent.create({
      module,
      content: safeContent,
      dayNumber: newDayNumber,
      completed: false,
    });

    await newDayContent.save();
    res.status(201).json(newDayContent);
  } catch (error) {
    console.error("Error adding day content:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get Day Content by Module ID
export const getDayContent = async (req: Request, res: Response) => {
  const { moduleId } = req.params;

  try {
    const module = await findModuleById(moduleId);
    if (!module) return res.status(404).json({ message: "Module not found" });

    res.status(200).json(module.days);
  } catch (error) {
    console.error("Error fetching day content:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update Day Content
export const updateDayContent = async (req: Request, res: Response) => {
  const { dayId } = req.params;
  const { content } = req.body;

  try {
    const dayContent = await DayContent.findOne({ where: { id: dayId } });
    if (!dayContent)
      return res.status(404).json({ message: "Day content not found" });

    if (content) {
      dayContent.content = sanitizeContent(content);
      await dayContent.save();
    }

    res.status(200).json(dayContent);
  } catch (error) {
    console.error("Error updating day content:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete Day Content
export const deleteDayContent = async (req: Request, res: Response) => {
  const { dayId } = req.params;

  try {
    const dayContent = await DayContent.findOne({ where: { id: dayId } });
    if (!dayContent)
      return res.status(404).json({ message: "Day content not found" });

    await dayContent.remove();
    res.status(200).json({ message: "Day content deleted successfully" });
  } catch (error) {
    console.error("Error deleting day content:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Mark Day as Completed
export const markDayAsCompleted = async (req: Request, res: Response) => {
  const { dayId } = req.params;

  try {
    const dayContent = await DayContent.findOne({ where: { id: dayId } });
    if (!dayContent)
      return res.status(404).json({ message: "Day content not found" });

    dayContent.completed = true;
    await dayContent.save();

    res.status(200).json({ message: "Day marked as completed", dayContent });
  } catch (error) {
    console.error("Error marking day as completed:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
