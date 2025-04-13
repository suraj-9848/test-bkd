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
exports.updateCourse = exports.deleteCourse = exports.createCourse = void 0;
const Course_1 = require("../../db/mysqlModels/Course");
const Batch_1 = require("../../db/mysqlModels/Batch");
const sqlUtils_1 = require("../../lib/dbLib/sqlUtils");
const createCourse = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, logo, pages_id, content, start_date, end_date, batch_id, } = req.body;
        const batch = yield (0, sqlUtils_1.getSingleRecord)(Batch_1.Batch, { where: { id: batch_id } });
        if (!batch) {
            return res.status(404).json({ message: "Batch not found" });
        }
        const course = new Course_1.Course();
        course.title = title;
        course.logo = logo;
        course.pages_id = pages_id;
        course.content = content;
        course.start_date = new Date(start_date);
        course.end_date = new Date(end_date);
        course.batches = batch;
        const savedCourse = yield (0, sqlUtils_1.createRecord)(Course_1.Course.getRepository(), course, "all_courses", 10 * 60);
        return res.status(201).json({
            message: "Course created successfully",
            course: savedCourse,
        });
    }
    catch (err) {
        console.error("Error creating course:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
});
exports.createCourse = createCourse;
const deleteCourse = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        // Delete the course using the utility function
        const result = yield (0, sqlUtils_1.deleteRecords)(Course_1.Course, { id });
        if (result.affected === 0) {
            return res.status(404).json({ message: "Course not found" });
        }
        return res.status(200).json({ message: "Course deleted successfully" });
    }
    catch (err) {
        console.error("Error deleting course:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
});
exports.deleteCourse = deleteCourse;
const updateCourse = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const result = yield (0, sqlUtils_1.updateRecords)(Course_1.Course, { id }, // query
        updateData, // new data
        false // upsert = false
        );
        return res.status(200).json({
            message: "Course updated successfully",
            result,
        });
    }
    catch (err) {
        console.error("Error updating course:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
});
exports.updateCourse = updateCourse;
//# sourceMappingURL=createCourse.js.map