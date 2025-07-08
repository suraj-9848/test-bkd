import { Request, Response } from "express";
import { Org } from "../../db/mysqlModels/Org";
import { validate } from "class-validator";
import {
  createRecord,
  getAllRecords,
  getSingleRecord,
  deleteRecords,
  updateRecords,
  getAllRecordsWithFilter,
} from "../../lib/dbLib/sqlUtils";
import { User, UserRole } from "../../db/mysqlModels/User";

export const getAllOrg = async (req: Request, res: Response) => {
  try {
    const orgs = await getAllRecords<Org>(Org);
    return res.status(200).json({
      message: "Organizations fetched successfully",
      orgs,
    });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getSingleOrg = async (req: Request, res: Response) => {
  const { org_id } = req.params;
  if (!org_id) return res.status(400).json({ error: "Org Id is required" });
  try {
    const org = await getSingleRecord<Org, { where: { id: string } }>(Org, {
      where: { id: org_id },
    });
    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }
    return res.status(200).json({
      message: "Organization fetched successfully",
      org,
    });
  } catch (error) {
    console.error("Error fetching organization:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createOrg = async (req: Request, res: Response) => {
  try {
    const { name, description, address } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    const org = new Org();
    org.name = name;
    org.description = description || null;
    org.address = address || null;
    const errors = await validate(org);
    if (errors.length > 0) {
      return res.status(400).json({ errors: errors.map((e) => e.toString()) });
    }
    const savedOrg = await createRecord(Org, org);
    return res.status(201).json({
      message: "Organization created successfully",
      org: savedOrg,
    });
  } catch (error) {
    console.error("Error creating organization:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteOrg = async (req: Request, res: Response) => {
  const { org_id } = req.params;
  if (!org_id) return res.status(400).json({ error: "Org Id is required" });
  try {
    const deleteResult = await deleteRecords<Org, { id: string }>(Org, {
      id: org_id,
    });
    if (deleteResult.affected === 0) {
      return res.status(404).json({ message: "Organization not found" });
    }
    return res.status(200).json({
      message: "Organization deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting organization:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
export const updateOrg = async (req: Request, res: Response) => {
  const { org_id } = req.params;
  const { name, description, address } = req.body;
  if (!org_id) return res.status(400).json({ error: "Org Id is required" });

  try {
    const org = await getSingleRecord<Org, { where: { id: string } }>(Org, {
      where: { id: org_id },
    });
    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }

    org.name = name || org.name;
    org.description = description || org.description;
    org.address = address || org.address;

    const errors = await validate(org);
    if (errors.length > 0) {
      return res.status(400).json({ errors: errors.map((e) => e.toString()) });
    }

    const updatedOrg = await updateRecords<Org, { id: string }, any, any>(
      Org,
      { id: org_id },
      {
        name: org.name,
        description: org.description,
        address: org.address,
      },
      false
    );
    return res.status(200).json({
      message: "Organization updated successfully",
      org: updatedOrg,
    });
  } catch (error) {
    console.error("Error updating organization:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteAllOrg = async (req: Request, res: Response) => {
  try {
    const deleteResult = await deleteRecords<Org, {}>(Org, {});
    return res.status(200).json({
      message: "All organizations deleted successfully",
      affected: deleteResult.affected,
    });
  } catch (error) {
    console.error("Error deleting all organizations:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Helper function to create a user with a specific role
const createUserWithRole = async (
  req: Request,
  res: Response,
  role: UserRole
) => {
  try {
    const { username, email, password, org_id, batch_id } = req.body;
    if (!username || !org_id) {
      return res
        .status(400)
        .json({ error: "Username and Org Id are required" });
    }
    const user = new User();
    user.username = username;
    user.email = email || null;
    user.password = password || null;
    user.org_id = org_id;
    user.batch_id = batch_id || [];
    user.userRole = role;

    const errors = await validate(user);
    if (errors.length > 0) {
      return res.status(400).json({ errors: errors.map((e) => e.toString()) });
    }

    const savedUser = await createRecord(User, user);
    return res.status(201).json({
      message: `${role} created successfully`,
      user: savedUser,
    });
  } catch (error) {
    console.error(`Error creating ${role}:`, error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const deleteUserWithRole = async (
  req: Request,
  res: Response,
  role: UserRole
) => {
  const { user_id } = req.params;
  if (!user_id) return res.status(400).json({ error: "User Id is required" });

  try {
    const deleteResult = await deleteRecords<
      User,
      { id: string; userRole: UserRole }
    >(User, { id: user_id, userRole: role });
    if (deleteResult.affected === 0) {
      return res.status(404).json({ message: `${role} not found` });
    }
    return res.status(200).json({
      message: `${role} deleted successfully`,
    });
  } catch (error) {
    console.error(`Error deleting ${role}:`, error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Helper function to update a user with a specific role
const updateUserWithRole = async (
  req: Request,
  res: Response,
  role: UserRole
) => {
  const { user_id } = req.params;
  const { username, email, password, batch_id } = req.body;
  if (!user_id) return res.status(400).json({ error: "User Id is required" });

  try {
    const user = await getSingleRecord<
      User,
      { where: { id: string; userRole: UserRole } }
    >(User, { where: { id: user_id, userRole: role } });
    if (!user) {
      return res.status(404).json({ message: `${role} not found` });
    }

    user.username = username || user.username;
    user.email = email || user.email;
    user.password = password || user.password;
    user.batch_id = batch_id || user.batch_id;

    const errors = await validate(user);
    if (errors.length > 0) {
      return res.status(400).json({ errors: errors.map((e) => e.toString()) });
    }

    const updatedUser = await updateRecords<User, { id: string }, any, any>(
      User,
      { id: user_id },
      {
        username: user.username,
        email: user.email,
        password: user.password,
        batch_id: user.batch_id,
      },
      false
    );
    return res.status(200).json({
      message: `${role} updated successfully`,
      user: updatedUser,
    });
  } catch (error) {
    console.error(`Error updating ${role}:`, error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createCollegeAdmin = (req: Request, res: Response) =>
  createUserWithRole(req, res, UserRole.COLLEGE_ADMIN);

export const deleteCollegeAdmin = (req: Request, res: Response) =>
  deleteUserWithRole(req, res, UserRole.COLLEGE_ADMIN);

export const updateCollegeAdmin = (req: Request, res: Response) =>
  updateUserWithRole(req, res, UserRole.COLLEGE_ADMIN);

export const createInstructor = (req: Request, res: Response) =>
  createUserWithRole(req, res, UserRole.INSTRUCTOR);

export const deleteInstructor = (req: Request, res: Response) =>
  deleteUserWithRole(req, res, UserRole.INSTRUCTOR);

export const updateInstructor = (req: Request, res: Response) =>
  updateUserWithRole(req, res, UserRole.INSTRUCTOR);

export const createStudent = (req: Request, res: Response) =>
  createUserWithRole(req, res, UserRole.STUDENT);

export const deleteStudent = (req: Request, res: Response) =>
  deleteUserWithRole(req, res, UserRole.STUDENT);

export const updateStudent = (req: Request, res: Response) =>
  updateUserWithRole(req, res, UserRole.STUDENT);

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const { role } = req.body || req.query;
    const userRole = req.params.role || role;

    let users;
    if (userRole && userRole !== "All") {
      users = await getAllRecordsWithFilter(User, {
        where: { userRole: userRole as UserRole },
      });
    } else {
      users = await getAllRecords(User);
    }

    return res.status(200).json({
      message: "Users fetched successfully",
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Bulk operations for users
export const bulkCreateUsers = async (req: Request, res: Response) => {
  try {
    const { users } = req.body;

    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error: "Users array is required" });
    }

    const createdUsers = [];
    const errors = [];

    for (let i = 0; i < users.length; i++) {
      try {
        const userData = users[i];
        const { username, email, password, org_id, batch_id, userRole } =
          userData;

        if (!username || !org_id || !userRole) {
          errors.push({
            index: i,
            error: "Username, org_id, and userRole are required",
            userData,
          });
          continue;
        }

        const user = new User();
        user.username = username;
        user.email = email || null;
        user.password = password || null;
        user.org_id = org_id;
        user.batch_id = batch_id || [];
        user.userRole = userRole;

        const validationErrors = await validate(user);
        if (validationErrors.length > 0) {
          errors.push({
            index: i,
            error: validationErrors.map((e) => e.toString()).join(", "),
            userData,
          });
          continue;
        }

        const savedUser = await createRecord(User, user);
        createdUsers.push(savedUser);
      } catch (error) {
        errors.push({
          index: i,
          error: error.message || "Unknown error",
          userData: users[i],
        });
      }
    }

    return res.status(201).json({
      message: `Bulk user creation completed`,
      created: createdUsers.length,
      errors: errors.length,
      createdUsers,
      errorDetails: errors,
    });
  } catch (error) {
    console.error("Error in bulk user creation:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const bulkDeleteUsers = async (req: Request, res: Response) => {
  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: "User IDs array is required" });
    }

    const deletedCount = await deleteRecords(User, { id: userIds });

    return res.status(200).json({
      message: `${deletedCount.affected} users deleted successfully`,
      deletedCount: deletedCount.affected,
    });
  } catch (error) {
    console.error("Error in bulk user deletion:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getUserStats = async (req: Request, res: Response) => {
  try {
    const [students, instructors, collegeAdmins, totalUsers] =
      await Promise.all([
        getAllRecordsWithFilter(User, {
          where: { userRole: UserRole.STUDENT },
        }),
        getAllRecordsWithFilter(User, {
          where: { userRole: UserRole.INSTRUCTOR },
        }),
        getAllRecordsWithFilter(User, {
          where: { userRole: UserRole.COLLEGE_ADMIN },
        }),
        getAllRecords(User),
      ]);

    return res.status(200).json({
      message: "User statistics fetched successfully",
      stats: {
        totalUsers: totalUsers.length,
        students: students.length,
        instructors: instructors.length,
        collegeAdmins: collegeAdmins.length,
        breakdown: {
          students: ((students.length / totalUsers.length) * 100).toFixed(1),
          instructors: ((instructors.length / totalUsers.length) * 100).toFixed(
            1
          ),
          collegeAdmins: (
            (collegeAdmins.length / totalUsers.length) *
            100
          ).toFixed(1),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
