import { Request } from "express";
import { User } from "../db/mysqlModels/User";
import { getSingleRecord } from "../lib/dbLib/sqlUtils";

export const getUserFromRequest = async (req: Request): Promise<User> => {
  // First check if we already have the full user entity
  if (req.fullUser) {
    return req.fullUser;
  }

  // If we only have basic user info, fetch the full entity
  if (req.user) {
    const fullUser = await getSingleRecord<User, any>(
      User,
      { where: { id: req.user.id } },
      `user_id_${req.user.id}`,
      true,
      5 * 60,
    );

    if (!fullUser) {
      throw new Error("User not found in database");
    }

    return fullUser;
  }

  throw new Error("No user found in request");
};

/**
 * Type-safe user getter that throws descriptive errors
 */
export const requireUser = (req: Request): User => {
  if (req.fullUser) {
    return req.fullUser;
  }

  if (req.user) {
    // Create a minimal User-like object for backward compatibility
    // This is not ideal but helps with immediate compatibility
    return {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      userRole: req.user.userRole as any,
      // Add placeholder values for required fields
      password: "",
      org_id: "",
      batch_id: [],
      userCourses: [],
      jobApplications: [],
      submissions: [],
      refreshTokens: [],
      organization: {} as any,
    } as User;
  }

  throw new Error("Authentication required");
};

/**
 * Async version that fetches full user if needed
 */
export const requireFullUser = async (req: Request): Promise<User> => {
  return await getUserFromRequest(req);
};

/**
 * Type guard to check if req.user is a full User entity
 */
export const isFullUser = (user: any): user is User => {
  return (
    user && typeof user === "object" && "password" in user && "org_id" in user
  );
};

/**
 * Middleware helper to ensure req.user is properly typed
 */
export const withFullUser = (
  handler: (req: Request & { user: User }, res: any) => Promise<any>,
) => {
  return async (req: Request, res: any) => {
    try {
      const fullUser = await getUserFromRequest(req);
      req.user = fullUser as any; // Override with full user
      return await handler(req as Request & { user: User }, res);
    } catch (error) {
      return res.status(401).json({
        error: error.message || "Failed to get user data",
      });
    }
  };
};
