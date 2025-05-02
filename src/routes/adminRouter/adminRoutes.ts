// import express from "express";
// import {
//   createCourse,
//   deleteCourse,
//   updateCourse,
//   fetchAllCourses,
//   fetchCourse,
// } from "../../controllers/courseCrudControllers/courseController";
// import {
//   adminMiddleware,
// } from "../../middleware/adminMiddleware";
// // import {
// //   getTestData,
// //   getUsers,
// // } from "../../controllers/adminControllers/adminController";
// import { validateCourseBody } from "../../middleware/courseCrudPipes/coursePipe";
// import { authMiddleware } from "../../middleware/authMiddleware";
// export const adminRouter = express.Router();

// // adminRouter.get("/users/all", getUsers)
// // adminRouter.get("/ping", (req, res) => res.send("pong from admin"))
// // adminRouter.get('/test', getTestData)
// // adminRouter.get('/file', handleFileUpload)

// adminMiddleware.use(authMiddleware);
// adminRouter.use(adminMiddleware);

// adminRouter.post("/create-course", validateCourseBody, createCourse);
// adminRouter.delete("/delete-course/:id", deleteCourse);
// adminRouter.put("/update-course/:id", updateCourse);
// adminRouter.get("/fetch-course/:id", fetchCourse);
// adminRouter.get("/fetch-all-courses", fetchAllCourses);


import express from "express";
import {
  createCourse,
  deleteCourse,
  updateCourse,
  fetchAllCourses,
  fetchCourse,
} from "../../controllers/courseCrudControllers/courseController";
import { adminMiddleware } from "../../middleware/adminMiddleware";
import { authMiddleware } from "../../middleware/authMiddleware";
import { validateCourseBody } from "../../middleware/courseCrudPipes/coursePipe";

export const adminRouter = express.Router();

// Apply auth middleware before admin check
adminRouter.use(authMiddleware);
adminRouter.use(adminMiddleware);

adminRouter.post("/create-course", validateCourseBody, createCourse);
adminRouter.delete("/delete-course/:id", deleteCourse);
adminRouter.put("/update-course/:id", updateCourse);
adminRouter.get("/fetch-course/:id", fetchCourse);
adminRouter.get("/fetch-all-courses", fetchAllCourses);
