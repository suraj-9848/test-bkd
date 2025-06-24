import { Request, Response } from "express";
import { Module } from "../../db/mysqlModels/Module";
import { DayContent } from "../../db/mysqlModels/DayContent";
import {
  createRecord,
  getSingleRecord,
  getAllRecordsWithFilter,
  updateRecords,
  deleteRecords,
} from "../../lib/dbLib/sqlUtils";
import sanitizeHtml from "sanitize-html";

// Quill-specific sanitization configuration
const sanitizeQuillContent = (content: string): string => {
  return sanitizeHtml(content, {
    allowedTags: [
      // Text formatting
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "sub",
      "sup",
      // Headings
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      // Lists
      "ul",
      "ol",
      "li",
      // Links and media
      "a",
      "img",
      "video",
      "iframe",
      // Tables
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      // Blockquote and code
      "blockquote",
      "code",
      "pre",
      // Divs and spans for Quill formatting
      "div",
      "span",
    ],
    allowedAttributes: {
      "*": ["class", "style"], // Allow class and style for Quill formatting
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height", "style"],
      video: ["src", "controls", "width", "height", "style"],
      iframe: ["src", "width", "height", "frameborder", "allowfullscreen"],
      table: ["border", "cellpadding", "cellspacing", "style"],
      td: ["colspan", "rowspan", "style"],
      th: ["colspan", "rowspan", "style"],
      ol: ["start"],
      li: ["data-list"],
    },
    allowedStyles: {
      "*": {
        // Allow common Quill styles
        color: [
          /^#[0-9a-fA-F]{3,6}$/,
          /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/,
        ],
        "background-color": [
          /^#[0-9a-fA-F]{3,6}$/,
          /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/,
        ],
        "font-size": [/^\d+(?:px|em|%)$/],
        "font-family": [/.*/],
        "text-align": ["left", "center", "right", "justify"],
        "text-decoration": ["underline", "line-through"],
        "font-weight": ["bold", "normal", /^\d+$/],
        "font-style": ["italic", "normal"],
        "text-indent": [/^\d+(?:px|em)$/],
        margin: [/^\d+(?:px|em)\s*(?:\d+(?:px|em)\s*){0,3}$/],
        padding: [/^\d+(?:px|em)\s*(?:\d+(?:px|em)\s*){0,3}$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
  });
};

// Utility to validate Quill Delta format (optional)
const isValidQuillDelta = (content: any): boolean => {
  try {
    if (typeof content === "string") {
      const parsed = JSON.parse(content);
      return parsed && Array.isArray(parsed.ops);
    }
    return content && Array.isArray(content.ops);
  } catch {
    return false;
  }
};

// ==================== CREATE DAY CONTENT ====================
export const addDayContent = async (req: Request, res: Response) => {
  const { moduleId } = req.params;
  const { content, dayNumber, title } = req.body;

  try {
    // Validate required fields
    if (!content) {
      return res.status(400).json({
        message: "Content is required",
      });
    }

    // Check if module exists
    const module = await getSingleRecord(Module, {
      where: { id: moduleId },
    });

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    // Process and sanitize content
    const processedContent = sanitizeQuillContent(content);

    // Calculate day number if not provided
    let newDayNumber = dayNumber;
    if (!newDayNumber) {
      const existingDays = await getAllRecordsWithFilter(DayContent, {
        where: { module: { id: moduleId } },
        order: { dayNumber: "DESC" },
      });
      newDayNumber =
        existingDays.length > 0 ? existingDays[0].dayNumber + 1 : 1;
    } else {
      // Check if day number already exists
      const existingDay = await getSingleRecord(DayContent, {
        where: {
          module: { id: moduleId },
          dayNumber: newDayNumber,
        },
      });

      if (existingDay) {
        return res.status(400).json({
          message: `Day ${newDayNumber} already exists in this module`,
        });
      }
    }

    const newDayContent = DayContent.create({
      module,
      content: processedContent,
      dayNumber: newDayNumber,
      title: title || `Day ${newDayNumber}`,
      completed: false,
    });

    const savedDayContent = await createRecord(
      DayContent.getRepository(),
      newDayContent,
    );

    res.status(201).json({
      message: "Day content created successfully",
      dayContent: savedDayContent,
    });
  } catch (error) {
    console.error("Error adding day content:", error);
    res.status(500).json({ message: "Error adding day content" });
  }
};

// ==================== GET ALL DAY CONTENT ====================
export const getDayContent = async (req: Request, res: Response) => {
  const { moduleId } = req.params;

  try {
    // Verify module exists
    const module = await getSingleRecord(Module, {
      where: { id: moduleId },
    });

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    const dayContents = await getAllRecordsWithFilter(DayContent, {
      where: { module: { id: moduleId } },
      order: { dayNumber: "ASC" },
    });

    res.status(200).json({
      message: "Day contents fetched successfully",
      dayContents,
    });
  } catch (error) {
    console.error("Error fetching day content:", error);
    res.status(500).json({ message: "Error fetching day content" });
  }
};

// ==================== GET SINGLE DAY CONTENT ====================
export const getSingleDayContent = async (req: Request, res: Response) => {
  const { dayId } = req.params;

  try {
    const dayContent = await getSingleRecord(DayContent, {
      where: { id: dayId },
      relations: ["module"],
    });

    if (!dayContent) {
      return res.status(404).json({ message: "Day content not found" });
    }

    res.status(200).json({
      message: "Day content fetched successfully",
      dayContent,
    });
  } catch (error) {
    console.error("Error fetching day content:", error);
    res.status(500).json({ message: "Error fetching day content" });
  }
};

// ==================== UPDATE DAY CONTENT ====================
export const updateDayContent = async (req: Request, res: Response) => {
  const { dayId } = req.params;
  const { content, title, dayNumber } = req.body;

  try {
    // Check if day content exists
    const existingDayContent = await getSingleRecord(DayContent, {
      where: { id: dayId },
      relations: ["module"],
    });

    if (!existingDayContent) {
      return res.status(404).json({ message: "Day content not found" });
    }

    // If dayNumber is being changed, check for conflicts
    if (dayNumber !== undefined && dayNumber !== existingDayContent.dayNumber) {
      const conflictingDay = await getSingleRecord(DayContent, {
        where: {
          module: { id: existingDayContent.module.id },
          dayNumber,
        },
      });

      if (conflictingDay && conflictingDay.id !== dayId) {
        return res.status(400).json({
          message: `Day ${dayNumber} already exists in this module`,
        });
      }
    }

    const updateData: Partial<DayContent> = {};

    // Handle content updates
    if (content !== undefined) {
      updateData.content = sanitizeQuillContent(content);
    }

    if (title !== undefined) updateData.title = title;
    if (dayNumber !== undefined) updateData.dayNumber = dayNumber;

    const result = await updateRecords(
      DayContent,
      { id: dayId },
      updateData,
      false,
    );

    if (!result || result.affected === 0) {
      return res.status(404).json({ message: "Day content not found" });
    }

    // Fetch updated day content
    const updatedDayContent = await getSingleRecord(DayContent, {
      where: { id: dayId },
      relations: ["module"],
    });

    res.status(200).json({
      message: "Day content updated successfully",
      dayContent: updatedDayContent,
    });
  } catch (error) {
    console.error("Error updating day content:", error);
    res.status(500).json({ message: "Error updating day content" });
  }
};

// ==================== DELETE DAY CONTENT ====================
export const deleteDayContent = async (req: Request, res: Response) => {
  const { dayId } = req.params;

  try {
    // Check if day content exists
    const dayContent = await getSingleRecord(DayContent, {
      where: { id: dayId },
    });

    if (!dayContent) {
      return res.status(404).json({ message: "Day content not found" });
    }

    const result = await deleteRecords(DayContent, { id: dayId });

    if (!result || result.affected === 0) {
      return res.status(404).json({ message: "Day content not found" });
    }

    res.status(200).json({
      message: "Day content deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting day content:", error);
    res.status(500).json({ message: "Error deleting day content" });
  }
};

// ==================== MARK DAY AS COMPLETED ====================
export const markDayAsCompleted = async (req: Request, res: Response) => {
  const { dayId } = req.params;

  try {
    // Check if day content exists
    const dayContent = await getSingleRecord(DayContent, {
      where: { id: dayId },
    });

    if (!dayContent) {
      return res.status(404).json({ message: "Day content not found" });
    }

    const result = await updateRecords(
      DayContent,
      { id: dayId },
      { completed: true },
      false,
    );

    if (!result || result.affected === 0) {
      return res.status(404).json({ message: "Day content not found" });
    }

    // Fetch updated day content
    const updatedDayContent = await getSingleRecord(DayContent, {
      where: { id: dayId },
      relations: ["module"],
    });

    res.status(200).json({
      message: "Day marked as completed successfully",
      dayContent: updatedDayContent,
    });
  } catch (error) {
    console.error("Error marking day as completed:", error);
    res.status(500).json({ message: "Error marking day as completed" });
  }
};

// ==================== UTILITY FUNCTIONS ====================

// Validate content format
export const validateContentFormat = async (req: Request, res: Response) => {
  const { content } = req.body;

  try {
    if (!content) {
      return res.status(400).json({
        message: "Content is required",
      });
    }

    const sanitizedContent = sanitizeQuillContent(content);

    res.status(200).json({
      message: "Content format is valid",
      sanitizedContent,
    });
  } catch (error) {
    console.error("Error validating content:", error);
    res.status(500).json({ message: "Error validating content" });
  }
};
