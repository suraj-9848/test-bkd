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
exports.updateStatus = exports.updateCurrentPage = exports.updateSessionId = void 0;
const connect_1 = require("../../db/connect");
const StudentCourseProgress_1 = require("../../db/mysqlModels/StudentCourseProgress");
//module export method to be changed to ES6
const { getLoggerByName } = require("../../utils/logger");
const progressRepo = connect_1.AppDataSource.getRepository(StudentCourseProgress_1.StudentCourseProgress);
const logger = getLoggerByName("courseProgress");
const updateSessionId = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id, session_id } = req.body;
    logger.debug(req.body);
    try {
        const progress = yield progressRepo.findOneBy({ id });
        if (!progress) {
            return res.status(404).json({ message: "Record not found" });
        }
        progress.session_id = session_id;
        yield progressRepo.save(progress);
        res.json({ message: "Session ID updated successfully", progress });
    }
    catch (err) {
        res.status(500).json({ message: "Error updating session_id", error: err });
    }
});
exports.updateSessionId = updateSessionId;
const updateCurrentPage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id, current_page } = req.body;
    try {
        const progress = yield progressRepo.findOneBy({ id });
        if (!progress) {
            return res.status(404).json({ message: "Record not found" });
        }
        progress.current_page = current_page;
        yield progressRepo.save(progress);
        res.json({ message: "Current page updated successfully", progress });
    }
    catch (err) {
        res.status(500).json({ message: "Error updating current_page", error: err });
    }
});
exports.updateCurrentPage = updateCurrentPage;
const updateStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id, status } = req.body;
    try {
        const progress = yield progressRepo.findOneBy({ id });
        if (!progress) {
            return res.status(404).json({ message: "Record not found" });
        }
        progress.status = status;
        yield progressRepo.save(progress);
        res.json({ message: "Status updated successfully", progress });
    }
    catch (err) {
        res.status(500).json({ message: "Error updating status", error: err });
    }
});
exports.updateStatus = updateStatus;
//# sourceMappingURL=courseProgress.js.map