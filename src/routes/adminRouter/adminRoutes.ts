import express from 'express'
import { createCourse, deleteCourse, updateCourse, fetchAllCourses, fetchCourse } from "../../controllers/courseCrudControllers/courseController";
import { dummyUserMiddleware, adminMiddleware } from '../../middleware/courseCrudMiddleware';
import { getTestData, getUsers } from '../../controllers/adminControllers/adminController';
import { validateCourseBody } from '../../middleware/courseCrudPipes/coursePipe';
export const adminRouter = express.Router()


// adminRouter.get("/users/all", getUsers)
// adminRouter.get("/ping", (req, res) => res.send("pong from admin"))
// adminRouter.get('/test', getTestData)
// adminRouter.get('/file', handleFileUpload)

adminRouter.use(dummyUserMiddleware);
adminRouter.use(adminMiddleware);

adminRouter.post('/create-course', validateCourseBody, createCourse)
adminRouter.delete('/delete-course/:id', deleteCourse)
adminRouter.put("/update-course/:id", updateCourse)
adminRouter.get("/fetch-course/:id", fetchCourse)
adminRouter.get("/fetch-all-courses", fetchAllCourses)