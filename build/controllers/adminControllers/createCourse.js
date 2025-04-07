"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCourse = void 0;
const connect_1 = require("../../db/connect");
const Course_1 = require("../../db/mysqlModels/Course");
const Batch_1 = require("../../db/mysqlModels/Batch");
// import { User } from "../../db/mysqlModels/User"; // Assuming roles are defined
const createCourse = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, logo, pages_id, content, start_date, end_date, batch_id } = req.body;
        // Only allow instructors or admins
        // const user = req.user; // Assuming middleware adds user
        // if (user.userRole !== "Instructor" && user.userRole !== "Admin") {
        //     return res.status(403).json({ message: "Access denied" });
        //   }
        const batchRepo = connect_1.AppDataSource.getRepository(Batch_1.Batch);
        const courseRepo = connect_1.AppDataSource.getRepository(Course_1.Course);
        const batch = yield batchRepo.findOneBy({ id: batch_id });
        if (!batch)
            return res.status(404).json({ message: "Batch not found" });
        const course = new Course_1.Course();
        course.title = title;
        course.logo = logo;
        course.pages_id = pages_id;
        course.content = content;
        course.start_date = new Date(start_date);
        course.end_date = new Date(end_date);
        course.batches = batch;
        yield courseRepo.save(course);
        res.status(201).json({ message: "Course created", course });
        console.log("Course created");
    }
    catch (error) {
        console.error("Create Course Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});
exports.createCourse = createCourse;
//# sourceMappingURL=createCourse.js.map