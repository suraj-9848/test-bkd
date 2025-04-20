import express from 'express'
import { createCourse, deleteCourse, updateCourse, fetchAllCourses, fetchCourse } from "../../controllers/adminControllers/courseControllers";
import { dummyUserMiddleware, adminMiddleware } from '../../middleware/adminMiddleware';
import { getTestData, getUsers } from '../../controllers/adminControllers/adminController';
export const adminRouter = express.Router()


adminRouter.get("/users/all", getUsers)
adminRouter.get("/ping", (req, res) => res.send("pong from admin"))
adminRouter.get('/test', getTestData)
// adminRouter.get('/file', handleFileUpload)

adminRouter.use(dummyUserMiddleware);
adminRouter.use(adminMiddleware);

adminRouter.post('/create-course', createCourse)
adminRouter.delete('/delete-course/:id', deleteCourse)
adminRouter.put("/update-course/:id", updateCourse)
adminRouter.get("/fetch-course/:id", fetchCourse)
adminRouter.get("/fetch-all-courses", fetchAllCourses)