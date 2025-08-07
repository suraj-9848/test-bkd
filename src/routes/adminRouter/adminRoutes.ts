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
  fetchAllCoursesinBatch,
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

import { adminMiddleware } from "../../middleware/adminMiddleware";
import { authMiddleware } from "../../middleware/authMiddleware";
import { validateCourseBody } from "../../middleware/courseCrudPipes/coursePipe";

export const adminRouter = express.Router();

// Apply authentication first, then admin authorization
adminRouter.use(authMiddleware);
adminRouter.use(adminMiddleware);

adminRouter.post("/create-batch", createBatch);
adminRouter.delete("/delete-batch/:id", deleteBatch);
adminRouter.put("/update-batch/:id", updateBatch);
adminRouter.get("/fetch-all-batches", fetchAllBatches);
adminRouter.get("/fetch-batch/:id", fetchBatch);

adminRouter.post("/create-course", validateCourseBody, createCourse);
adminRouter.delete("/delete-course/:id", deleteCourse);
adminRouter.put("/update-course/:id", updateCourse);
adminRouter.get("/fetch-course/:id", fetchCourse);
adminRouter.get("/fetch-all-courses", fetchAllCoursesinBatch);

//Organization CRUD - REST API style
adminRouter.get("/organizations", getAllOrg); // GET /api/admin/organizations
adminRouter.get("/organizations/:org_id", getSingleOrg); // GET /api/admin/organizations/:id
adminRouter.post("/organizations", createOrg); // POST /api/admin/organizations
adminRouter.put("/organizations/:org_id", updateOrg); // PUT /api/admin/organizations/:id
adminRouter.delete("/organizations/:org_id", deleteOrg); // DELETE /api/admin/organizations/:id

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

// Unified user management endpoints - REST API style
adminRouter.get("/users/stats", getUserStats); // GET /api/admin/users/stats (must be before :role)
adminRouter.get("/users", getAllUsers); // GET /api/admin/users
adminRouter.post("/users", createUser); // POST /api/admin/users
adminRouter.get("/users/:role", getAllUsers); // GET /api/admin/users/:role
adminRouter.put("/users/:user_id", updateUser); // PUT /api/admin/users/:user_id
adminRouter.delete("/users/:user_id", deleteUser); // DELETE /api/admin/users/:user_id

// Bulk operations
adminRouter.post("/bulk-create-users", bulkCreateUsers);
adminRouter.delete("/bulk-delete-users", bulkDeleteUsers);
