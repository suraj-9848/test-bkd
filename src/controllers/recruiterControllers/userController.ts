import { Request, Response } from "express";
import { User, UserRole } from "../../db/mysqlModels/User";

// Get all students (optionally filter pro)
export const getStudents = async (req: Request, res: Response) => {
  try {
    const { pro } = req.query as { pro?: string };

    // Base query: only students
    let qb = User.createQueryBuilder("user")
      .where("user.userRole = :role", { role: UserRole.STUDENT })
      .leftJoin("user.proSubscriptions", "ps")
      .select([
        "user.id",
        "user.username",
        "user.email",
        "user.isProUser",
        "user.proExpiresAt",
      ])
      // When they became pro: latest active subscription start time
      .addSelect(
        "MAX(CASE WHEN ps.status = :active THEN ps.starts_at END)",
        "becameProAt",
      )
      .groupBy("user.id")
      .addGroupBy("user.username")
      .addGroupBy("user.email")
      .addGroupBy("user.isProUser")
      .addGroupBy("user.proExpiresAt")
      .distinct(true)
      .setParameter("active", "active");

    // If pro filter requested, consider either isProUser=true OR proExpiresAt in future OR active ProSubscription
    if (pro === "1" || pro === "true") {
      qb = qb.andWhere(
        "(user.isProUser = :isPro OR (user.proExpiresAt IS NOT NULL AND user.proExpiresAt > NOW()) OR (ps.status = :active AND (ps.expires_at IS NULL OR ps.expires_at > NOW()) AND (ps.starts_at IS NULL OR ps.starts_at <= NOW())))",
        { isPro: true },
      );
    }

    type RawStudent = {
      user_id: number;
      user_username: string | null;
      user_email: string | null;
      user_isProUser: number | boolean | null;
      user_proExpiresAt: Date | null;
      becameProAt: Date | null;
    };

    const rows = await qb.getRawMany<RawStudent>();

    const students = rows.map((r) => ({
      id: r.user_id,
      username: r.user_username,
      email: r.user_email,
      isProUser: !!r.user_isProUser,
      proExpiresAt: r.user_proExpiresAt,
      becameProAt: r.becameProAt || null,
    }));

    return res.status(200).json({ success: true, students });
  } catch (error) {
    console.error("Error fetching students:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
