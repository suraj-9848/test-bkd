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

const sanitizeRichTextContent = (content: string): string => {
  console.log("=== CONTENT SANITIZATION START ===");
  console.log("Input content length:", content?.length || 0);
  console.log("Input content preview:", content?.substring(0, 200) + "...");

  if (!content || typeof content !== "string") {
    console.log("Invalid content provided, returning empty string");
    return "";
  }

  const sanitized = sanitizeHtml(content, {
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
      "mark",
      "small",
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
      "img",
      "hr",
      "del",
      "ins",
    ],
    allowedAttributes: {
      "*": ["style", "class", "id"],
      a: ["href", "target", "rel", "title"],
      img: ["src", "alt", "width", "height", "title"],
      blockquote: ["cite"],
      ol: ["start", "type", "data-list"],
      li: ["value"],
      ul: ["data-list"],
    },
    allowedStyles: {
      "*": {
        "font-size": [
          /^\d+(?:px|em|rem|%)$/,
          /^1\.\d+rem$/,
          /^1\.875rem$/,
          /^1\.5rem$/,
          /^1\.25rem$/,
          /^1\.125rem$/,
          /^0\.875rem$/,
        ],
        "font-weight": [
          "bold",
          "normal",
          "bolder",
          "lighter",
          /^\d+$/,
          "100",
          "200",
          "300",
          "400",
          "500",
          "600",
          "700",
          "800",
          "900",
        ],
        "font-style": ["italic", "normal"],
        "text-align": ["left", "center", "right", "justify"],
        "text-decoration": ["underline", "line-through", "none"],
        color: [
          /^#[0-9a-fA-F]{3,6}$/,
          /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/,
          /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/,
        ],
        margin: [
          /^\d+(?:px|em|rem)\s*(?:\d+(?:px|em|rem)\s*){0,3}$/,
          /^16px 0 \d+px/,
          /^16px 0 8px 0$/,
          /^8px 0$/,
          /^12px 0$/,
          /^4px 0$/,
        ],
        padding: [
          /^\d+(?:px|em|rem)\s*(?:\d+(?:px|em|rem)\s*){0,3}$/,
          /^12px 16px$/,
          /^16px$/,
          /^24px$/,
          /^8px$/,
          /^4px$/,
          /^2px 4px$/,
        ],
        "padding-left": [/^\d+(?:px|em|rem)$/, /^24px$/, /^20px$/, /^16px$/],
        "line-height": [/^\d+(?:\.\d+)?$/, /^1\.[2-6]$/],
        display: ["block", "inline", "inline-block", "list-item", "flex"],
        "min-height": [/^\d+(?:px|em)$/, /^1\.5em$/],

        "background-color": [
          /^#[0-9a-fA-F]{3,6}$/,
          /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/,
          /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/,
          /^#f1f5f9$/,
          /^#eff6ff$/,
        ],
        border: [/^\d+px solid #[0-9a-fA-F]{3,6}$/, /^1px solid #e2e8f0$/],
        "border-left": [
          /^\d+px solid #[0-9a-fA-F]{3,6}$/,
          /^4px solid #3b82f6$/,
        ],
        "border-radius": [/^\d+px$/, /^8px$/, /^4px$/],

        "list-style-type": ["disc", "decimal", "circle", "square", "none"],
        "list-style-position": ["inside", "outside"],

        "font-family": [
          /^Monaco/,
          /^Consolas/,
          /^Courier/,
          /^monospace/,
          /^"Courier New"/,
          'Monaco, Consolas, "Courier New", monospace',
        ],
        overflow: ["auto", "hidden", "visible", "scroll"],
        "overflow-x": ["auto", "hidden", "visible", "scroll"],
        "overflow-y": ["auto", "hidden", "visible", "scroll"],
      },
    },
    allowedSchemes: ["http", "https", "mailto", "data"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    parseStyleAttributes: true,
    allowProtocolRelative: false,
    exclusiveFilter: function (frame) {
      console.log(frame);
      return false;
    },
    nonTextTags: ["style", "script", "textarea", "option"],
    allowedIframeHostnames: [],
  });

  console.log("Sanitized content length:", sanitized?.length || 0);
  console.log(
    "Sanitized content preview:",
    sanitized?.substring(0, 200) + "...",
  );
  console.log("=== CONTENT SANITIZATION END ===");

  return sanitized;
};

//  Update day content function with better content handling
export const updateDayContent = async (req: Request, res: Response) => {
  const { dayId, batchId, courseId, moduleId } = req.params;
  const { content, title, dayNumber } = req.body;

  console.log("=== UPDATE DAY CONTENT START ===");
  console.log("Request params:", { dayId, batchId, courseId, moduleId });
  console.log("Request body:", {
    hasContent: !!content,
    contentLength: content?.length || 0,
    contentType: typeof content,
    title,
    dayNumber,
  });

  try {
    // Check if day content exists
    const existingDayContent = await getSingleRecord(DayContent, {
      where: { id: dayId },
      relations: ["module"],
    });

    if (!existingDayContent) {
      console.log("Day content not found for ID:", dayId);
      return res.status(404).json({ message: "Day content not found" });
    }

    console.log("Found existing day content:", {
      id: existingDayContent.id,
      currentTitle: existingDayContent.title,
      currentDayNumber: existingDayContent.dayNumber,
      currentContentLength: existingDayContent.content?.length || 0,
    });

    // Validate day number conflicts
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

    // Prepare update data
    const updateData: Partial<DayContent> = {};

    // CRITICAL FIX: Handle content updates properly
    if (content !== undefined) {
      console.log("Processing content update...");

      // Validate content is not empty
      const textContent = content.replace(/<[^>]*>/g, "").trim();
      if (!textContent || textContent.length === 0) {
        console.log("Content validation failed - no text content");
        return res.status(400).json({
          message: "Content cannot be empty",
          debug: {
            originalContent: content?.substring(0, 100) + "...",
            textContent,
            textLength: textContent.length,
          },
        });
      }

      // Sanitize content using the unified function
      const processedContent = sanitizeRichTextContent(content);

      if (!processedContent || processedContent.trim() === "") {
        console.log("Content lost during sanitization!");
        return res.status(400).json({
          message: "Content was lost during processing",
          debug: {
            originalLength: content.length,
            processedLength: processedContent?.length || 0,
            original: content.substring(0, 200) + "...",
            processed: processedContent?.substring(0, 200) + "...",
          },
        });
      }

      updateData.content = processedContent;
      console.log("Content processed successfully:", {
        originalLength: content.length,
        processedLength: processedContent.length,
        preserved:
          ((processedContent.length / content.length) * 100).toFixed(1) + "%",
      });
    }

    if (title !== undefined) updateData.title = title;
    if (dayNumber !== undefined) updateData.dayNumber = dayNumber;

    console.log("Updating with data:", {
      hasContent: !!updateData.content,
      hasTitle: !!updateData.title,
      hasDayNumber: !!updateData.dayNumber,
      contentLength: updateData.content?.length || 0,
    });

    // Perform the update
    const result = await updateRecords(
      DayContent,
      { id: dayId },
      updateData,
      false,
    );

    console.log("Update result:", { affected: result?.affected });

    if (!result || result.affected === 0) {
      return res
        .status(404)
        .json({ message: "Day content not found or no changes made" });
    }

    // CRITICAL: Fetch the updated content to ensure we return what was actually saved
    const updatedDayContent = await getSingleRecord(DayContent, {
      where: { id: dayId },
      relations: ["module"],
    });

    console.log("Final updated content:", {
      id: updatedDayContent?.id,
      title: updatedDayContent?.title,
      dayNumber: updatedDayContent?.dayNumber,
      contentLength: updatedDayContent?.content?.length || 0,
      contentPreview:
        updatedDayContent?.content?.substring(0, 200) + "..." || "No content",
    });

    console.log("=== UPDATE DAY CONTENT END ===");

    res.status(200).json({
      message: "Day content updated successfully",
      dayContent: updatedDayContent,
      debug: {
        originalContentLength: content?.length || 0,
        finalContentLength: updatedDayContent?.content?.length || 0,
        contentPreserved: !!updatedDayContent?.content,
      },
    });
  } catch (error) {
    console.error("Error updating day content:", error);
    res.status(500).json({
      message: "Error updating day content",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

//  Create function using the same sanitization
export const addDayContent = async (req: Request, res: Response) => {
  const { moduleId, batchId, courseId } = req.params;
  const { content, dayNumber, title } = req.body;

  console.log("=== CREATE DAY CONTENT START ===");
  console.log("Request data:", {
    moduleId,
    batchId,
    courseId,
    hasContent: !!content,
    contentLength: content?.length || 0,
    title,
    dayNumber,
  });

  try {
    // Validate content
    if (!content || typeof content !== "string") {
      return res.status(400).json({
        message: "Content is required and must be a string",
        received: { content, type: typeof content },
      });
    }

    const textContent = content.replace(/<[^>]*>/g, "").trim();
    if (textContent.length === 0) {
      return res.status(400).json({
        message: "Content cannot be empty",
        debug: { originalContent: content.substring(0, 100) + "..." },
      });
    }

    // Check if module exists
    const module = await getSingleRecord(Module, {
      where: { id: moduleId },
    });

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    // Process content using the unified function
    const processedContent = sanitizeRichTextContent(content);

    if (!processedContent || processedContent.trim() === "") {
      console.log("Content lost during sanitization!");
      return res.status(500).json({
        message: "Content was lost during processing",
        debug: {
          originalLength: content.length,
          processedLength: processedContent?.length || 0,
        },
      });
    }

    // Handle day number
    let newDayNumber = dayNumber;
    if (!newDayNumber) {
      const existingDays = await getAllRecordsWithFilter(DayContent, {
        where: { module: { id: moduleId } },
        order: { dayNumber: "DESC" },
      });
      newDayNumber =
        existingDays.length > 0 ? existingDays[0].dayNumber + 1 : 1;
    } else {
      const existingDay = await getSingleRecord(DayContent, {
        where: { module: { id: moduleId }, dayNumber: newDayNumber },
      });

      if (existingDay) {
        return res.status(400).json({
          message: `Day ${newDayNumber} already exists in this module`,
        });
      }
    }

    // Create new day content
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

    console.log("=== CREATE DAY CONTENT END ===");

    res.status(201).json({
      message: "Day content created successfully",
      dayContent: savedDayContent,
    });
  } catch (error) {
    console.error("Error adding day content:", error);
    res.status(500).json({
      message: "Error adding day content",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Other functions remain the same...
export const getDayContent = async (req: Request, res: Response) => {
  const { moduleId } = req.params;

  try {
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

export const deleteDayContent = async (req: Request, res: Response) => {
  const { dayId } = req.params;

  try {
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

export const markDayAsCompleted = async (req: Request, res: Response) => {
  const { dayId } = req.params;

  try {
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
