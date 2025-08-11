import { Request, Response } from "express";
import { Blogs } from "../../db/mysqlModels/Blogs";
import {
  getSingleRecord,
  getAllRecords,
  createRecord,
  updateRecords,
  deleteRecords,
} from "../../lib/dbLib/sqlUtils";
import { getLogger } from "../../utils/logger";

const logger = getLogger();

export const createBlog = async (req: Request, res: Response) => {
  try {
    const { title, content, coverImageUrl, author, hashtags } = req.body;

    if (!title || !title.trim()) {
      logger.warn("Blog title is required");
      return res.status(400).json({ message: "Blog title is required" });
    }

    if (
      !content ||
      !content.trim() ||
      content === "<br>" ||
      content === "<p><br></p>"
    ) {
      logger.warn("Blog content is required");
      return res.status(400).json({ message: "Blog content is required" });
    }

    const newBlog = new Blogs();
    newBlog.title = title.trim();
    newBlog.author = author || "Unknown Author";
    newBlog.content = content;
    newBlog.coverImage = coverImageUrl || "";
    newBlog.hashtags = Array.isArray(hashtags) ? hashtags : [];
    newBlog.createdAt = new Date();
    newBlog.updatedAt = new Date();

    const savedBlog = (await createRecord(Blogs, newBlog)) as Blogs;

    logger.info(
      `Created new blog post: ${savedBlog.id} - "${savedBlog.title}"`,
    );

    return res.status(201).json({
      success: true,
      message: "Blog post created successfully",
      blog: savedBlog,
    });
  } catch (err) {
    logger.error("Error creating blog post:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create blog post. Please try again.",
    });
  }
};

export const getAllBlogs = async (req: Request, res: Response) => {
  try {
    const blogs = await getAllRecords(Blogs);

    const transformedBlogs = (blogs || []).map((blog: any) => ({
      id: blog.id,
      title: blog.title,
      content: blog.content,
      author: blog.author || "Unknown Author",
      coverImageUrl: blog.coverImage,
      hashtags: blog.hashtags || [],
      createdAt: blog.createdAt,
      updatedAt: blog.updatedAt,
      preview: blog.content
        ? blog.content.replace(/<[^>]*>/g, "").substring(0, 150) + "..."
        : "",
    }));

    logger.info(
      `Retrieved ${transformedBlogs.length} blog posts for management`,
    );

    return res.status(200).json({
      success: true,
      message: "Blog posts retrieved successfully",
      blogs: transformedBlogs,
      count: transformedBlogs.length,
    });
  } catch (err) {
    logger.error("Error retrieving blog posts:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve blog posts",
    });
  }
};

export const getBlogById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      logger.warn("Blog ID is required");
      return res.status(400).json({
        success: false,
        message: "Blog ID is required",
      });
    }

    const blog = await getSingleRecord(Blogs, {
      where: { id },
    });

    if (!blog) {
      logger.warn(`Blog post not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: "Blog post not found",
      });
    }

    const transformedBlog = {
      id: blog.id,
      title: blog.title,
      content: blog.content,
      coverImageUrl: blog.coverImage,
      hashtags: blog.hashtags || [],
      createdAt: blog.createdAt,
      updatedAt: blog.updatedAt,
    };

    logger.info(`Retrieved blog post for editing: ${id}`);

    return res.status(200).json({
      success: true,
      message: "Blog post retrieved successfully",
      blog: transformedBlog,
    });
  } catch (err) {
    logger.error("Error retrieving blog post:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve blog post",
    });
  }
};

export const updateBlog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, coverImageUrl, hashtags } = req.body;

    if (!id) {
      logger.warn("Blog ID is required");
      return res.status(400).json({
        success: false,
        message: "Blog ID is required",
      });
    }

    if (!title || !title.trim()) {
      logger.warn("Blog title is required for update");
      return res.status(400).json({
        success: false,
        message: "Blog title is required",
      });
    }

    if (
      !content ||
      !content.trim() ||
      content === "<br>" ||
      content === "<p><br></p>"
    ) {
      logger.warn("Blog content is required for update");
      return res.status(400).json({
        success: false,
        message: "Blog content is required",
      });
    }

    const existingBlog = await getSingleRecord(Blogs, {
      where: { id },
    });

    if (!existingBlog) {
      logger.warn(`Blog post not found for update: ${id}`);
      return res.status(404).json({
        success: false,
        message: "Blog post not found",
      });
    }

    const updateData = {
      title: title.trim(),
      content: content,
      updatedAt: new Date(),
      coverImage: coverImageUrl || "",
      hashtags: Array.isArray(hashtags) ? hashtags : [],
    };

    await updateRecords(Blogs, { id }, updateData, false);

    const updatedBlog = await getSingleRecord(Blogs, {
      where: { id },
    });

    const transformedBlog = {
      id: updatedBlog.id,
      title: updatedBlog.title,
      content: updatedBlog.content,
      coverImageUrl: updatedBlog.coverImage,
      hashtags: updatedBlog.hashtags || [],
      createdAt: updatedBlog.createdAt,
      updatedAt: updatedBlog.updatedAt,
    };

    logger.info(`Updated blog post: ${id} - "${transformedBlog.title}"`);

    return res.status(200).json({
      success: true,
      message: "Blog post updated successfully",
      blog: transformedBlog,
    });
  } catch (err) {
    logger.error("Error updating blog post:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update blog post. Please try again.",
    });
  }
};

export const deleteBlog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      logger.warn("Blog ID is required for deletion");
      return res.status(400).json({
        success: false,
        message: "Blog ID is required",
      });
    }

    const existingBlog = await getSingleRecord(Blogs, {
      where: { id },
    });

    if (!existingBlog) {
      logger.warn(`Blog post not found for deletion: ${id}`);
      return res.status(404).json({
        success: false,
        message: "Blog post not found",
      });
    }

    const blogTitle = existingBlog.title;

    const result = await deleteRecords(Blogs, { id });

    logger.info(`Deleted blog post: ${id} - "${blogTitle}"`);

    return res.status(200).json({
      success: true,
      message: "Blog post deleted successfully",
      deletedBlogId: id,
      result,
    });
  } catch (err) {
    logger.error("Error deleting blog post:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete blog post. Please try again.",
    });
  }
};

export const previewBlog = async (req: Request, res: Response) => {
  try {
    const { title, content, coverImageUrl, hashtags } = req.body;

    const previewData = {
      title: title || "Untitled Blog",
      content: content || "",
      coverImageUrl: coverImageUrl || "",
      hashtags: Array.isArray(hashtags) ? hashtags : [],
      createdAt: new Date().toISOString(),
    };

    return res.status(200).json({
      success: true,
      message: "Blog preview data prepared",
      preview: previewData,
    });
  } catch (err) {
    logger.error("Error preparing blog preview:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to prepare blog preview",
    });
  }
};
