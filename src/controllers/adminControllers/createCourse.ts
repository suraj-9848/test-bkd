import { Request, Response } from "express";
import { AppDataSource } from "../../db/connect";
import { Course } from "../../db/mysqlModels/Course";
import { Batch } from "../../db/mysqlModels/Batch";
// import { User } from "../../db/mysqlModels/User"; // Assuming roles are defined

export const createCourse = async (req: Request, res: Response) => {
  try {
    const { title, logo, pages_id, content, start_date, end_date, batch_id } = req.body;

    // Only allow instructors or admins
    // const user = req.user; // Assuming middleware adds user
    // if (user.userRole !== "Instructor" && user.userRole !== "Admin") {
    //     return res.status(403).json({ message: "Access denied" });
    //   }

    const batchRepo = AppDataSource.getRepository(Batch);
    const courseRepo = AppDataSource.getRepository(Course);

    const batch = await batchRepo.findOneBy({ id: batch_id });
    if (!batch) return res.status(404).json({ message: "Batch not found" });

    const course = new Course();
    course.title = title;
    course.logo = logo;
    course.pages_id = pages_id;
    course.content = content;
    course.start_date = new Date(start_date);
    course.end_date = new Date(end_date);
    course.batches = batch;

    await courseRepo.save(course);

    res.status(201).json({ message: "Course created", course });
    console.log("Course created");
  } catch (error) {
    console.error("Create Course Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
