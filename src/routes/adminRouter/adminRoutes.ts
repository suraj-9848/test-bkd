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
  fetchAllCoursesAcrossBatches,
  fetchCourse,
} from "../../controllers/courseCrudControllers/courseController";

import {
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
  updateOrg,
  getAllUsers,
  bulkCreateUsers,
  bulkDeleteUsers,
  getUserStats,
  createUser,
  updateUser,
  deleteUser,
} from "../../controllers/adminControllers/adminController";

import {
  createBatch,
  deleteBatch,
  updateBatch,
  fetchAllBatches,
  fetchBatch,
} from "../../controllers/instructorControllers/batch.controller";

// import { adminMiddleware } from "../../middleware/adminMiddleware";
// import { authMiddleware } from "../../middleware/authMiddleware";
import { adminAuthMiddleware } from "../../middleware/authMiddleware";
import { validateCourseBody } from "../../middleware/courseCrudPipes/coursePipe";

export const adminRouter = express.Router();

// adminRouter.get("/users/all", getUsers)
// adminRouter.get("/ping", (req, res) => res.send("pong from admin"))
// adminRouter.get('/test', getTestData)
// adminRouter.get('/file', handleFileUpload)
// TODO: Needs to be deleted in the future
adminRouter.use(adminAuthMiddleware);

adminRouter.post("/create-batch", createBatch);
adminRouter.delete("/delete-batch/:id", deleteBatch);
adminRouter.put("/update-batch/:id", updateBatch);
adminRouter.get("/fetch-all-batches", fetchAllBatches);
adminRouter.get("/fetch-batch/:id", fetchBatch);

adminRouter.post("/create-course", validateCourseBody, createCourse);
adminRouter.delete("/delete-course/:id", deleteCourse);
adminRouter.put("/update-course/:id", updateCourse);
adminRouter.get("/fetch-course/:id", fetchCourse);
adminRouter.get("/fetch-all-courses", fetchAllCoursesAcrossBatches);

//Organization CRUD
adminRouter.get("/get-all-org", getAllOrg);
adminRouter.get("/get-single-org/:org_id", getSingleOrg);
adminRouter.post("/create-org", createOrg);
adminRouter.put("/update-org/:org_id", updateOrg);
adminRouter.delete("/delete-org/:org_id", deleteOrg);

//Instructor CRUD
adminRouter.post("/create-instructor", createInstructor);
adminRouter.delete("/delete-instructor/:user_id", deleteInstructor);
adminRouter.put("/update-instructor/:user_id", updateInstructor);

//Sudent Crud

//College admuin CRUD
// adminRouter.get("/get-all-org", getAllOrg);
adminRouter.post("/create-student", createStudent);
adminRouter.delete("/delete-student/:user_id", deleteStudent);
adminRouter.put("/update-student/:user_id", updateStudent);

adminRouter.post("/get-all-users", getAllUsers);
adminRouter.get("/get-users", getAllUsers); // New route to handle query param
adminRouter.get("/get-users/:role", getAllUsers);

// Unified user management endpoints
adminRouter.post("/create-user", createUser);
adminRouter.put("/update-user/:user_id", updateUser);
adminRouter.delete("/delete-user/:user_id", deleteUser);

// Bulk operations
adminRouter.post("/bulk-create-users", bulkCreateUsers);
adminRouter.delete("/bulk-delete-users", bulkDeleteUsers);
adminRouter.get("/user-stats", getUserStats);
