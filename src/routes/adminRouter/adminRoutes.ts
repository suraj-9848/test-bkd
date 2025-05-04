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

import {
  createCollegeAdmin,
  deleteCollegeAdmin,
  updateCollegeAdmin,
  createInstructor,
  deleteInstructor,
  updateInstructor,
  createStudent,
  deleteStudent,
  updateStudent,
  getAllOrg,
  getSingleOrg,
  createOrg,
  deleteOrg,
} from "../../controllers/adminControllers/adminController";

import { adminMiddleware } from "../../middleware/adminMiddleware";
import { authMiddleware } from "../../middleware/authMiddleware";
import { validateCourseBody } from "../../middleware/courseCrudPipes/coursePipe";



export const adminRouter = express.Router()


// adminRouter.get("/users/all", getUsers)
// adminRouter.get("/ping", (req, res) => res.send("pong from admin"))
// adminRouter.get('/test', getTestData)
// adminRouter.get('/file', handleFileUpload)
// TODO: Needs to be deleted in the future
adminRouter.use(adminMiddleware);

adminRouter.post("/create-course", validateCourseBody, createCourse);
adminRouter.delete("/delete-course/:id", deleteCourse);
adminRouter.put("/update-course/:id", updateCourse);
adminRouter.get("/fetch-course/:id", fetchCourse);
adminRouter.get("/fetch-all-courses", fetchAllCourses);

//Organization CRUD
adminRouter.get("/get-all-org", getAllOrg);
adminRouter.post("/create-org", createOrg);
adminRouter.delete("/delete-org", deleteOrg);

//College admin CRUD
// adminRouter.get("/get-all-org", getAllOrg);
adminRouter.post("/create-college-admin", createCollegeAdmin);
adminRouter.delete("/delete-college-admin", deleteCollegeAdmin);
adminRouter.put("update-college-admin", updateCollegeAdmin);

//Instructor CRUD
// adminRouter.get("/get-all-org", getAllOrg);
adminRouter.post("/create-instructor", createInstructor);
adminRouter.delete("/delete-instructor", deleteInstructor);
adminRouter.put("update-instructor", updateInstructor);

//Sudent Crud

//College admuin CRUD
// adminRouter.get("/get-all-org", getAllOrg);
adminRouter.post("/create-student", createStudent);
adminRouter.delete("/delete-student", deleteStudent);
adminRouter.put("/update-student", updateStudent);
