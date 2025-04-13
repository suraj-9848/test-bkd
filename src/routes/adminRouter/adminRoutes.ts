import express from 'express'
import { createCourse, deleteCourse, updateCourse, fetchAllCourses, fetchCourse } from "../../controllers/adminControllers/courseControllers";

export const adminRouter = express.Router()

const dummyUserMiddleware = (req, res, next) => {
    req.user = {
      id: "12345",
      name: "Dummy Admin",
      role: "admin",
      email: "admin@example.com"
    };
    next();
  };

export const adminMiddleware = (req, res, next) => {
    const user = req.user;
  
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admins only.' });
    }
    next();
  };

adminRouter.use(dummyUserMiddleware);
adminRouter.use(adminMiddleware);

adminRouter.post('/create-course', createCourse)
adminRouter.delete('/delete-course/:id', deleteCourse)
adminRouter.put("/update-course/:id", updateCourse)
adminRouter.get("/fetch-course/:id", fetchCourse)
adminRouter.get("/fetch-all-courses", fetchAllCourses)