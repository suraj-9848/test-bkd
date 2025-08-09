import express from "express";
import {
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  previewBlog,
} from "../../controllers/instructorControllers/blog.controller";

const router = express.Router();

router.post("/", createBlog);
router.get("/", getAllBlogs);
router.get("/:id", getBlogById);
router.put("/:id", updateBlog);
router.delete("/:id", deleteBlog);
router.post("/preview", previewBlog);

export default router;
