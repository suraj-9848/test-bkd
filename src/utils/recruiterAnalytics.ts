import { AppDataSource } from "../db/connect";
import { Between } from "typeorm";
import {
  JobApplication,
  ApplicationStatus,
} from "../db/mysqlModels/JobApplication";
import { User, UserRole } from "../db/mysqlModels/User";
import { getRecordCount } from "../lib/dbLib/sqlUtils";
import { getLogger } from "./logger";

const logger = getLogger();

export async function countProApplicantsBetween(
  start: Date,
  end: Date,
): Promise<number> {
  try {
    const repo = AppDataSource.getRepository(JobApplication);
    const qb = repo
      .createQueryBuilder("app")
      .leftJoin(User, "user", "user.id = app.user_id")
      .where("app.appliedAt BETWEEN :start AND :end", { start, end })
      .andWhere(
        "(user.isProUser = :isPro OR (user.proExpiresAt IS NOT NULL AND user.proExpiresAt > NOW()))",
        { isPro: true },
      );

    return await qb.getCount();
  } catch (error) {
    logger.error("Error counting pro applicants:", error);
    return 0;
  }
}

export async function countShortlistedBetween(
  start: Date,
  end: Date,
): Promise<number> {
  try {
    return await getRecordCount(JobApplication, {
      where: {
        status: ApplicationStatus.SHORTLISTED,
        updatedAt: Between(start, end) as any,
      },
    });
  } catch (error) {
    logger.error("Error counting shortlisted applications:", error);
    return 0;
  }
}

export async function getAvgReviewTimeHours(): Promise<number | null> {
  try {
    const repo = AppDataSource.getRepository(JobApplication);
    const raw = await repo
      .createQueryBuilder("app")
      .select(
        "AVG(TIMESTAMPDIFF(HOUR, app.appliedAt, app.updatedAt))",
        "avgHours",
      )
      .where("app.status != :applied", { applied: ApplicationStatus.APPLIED })
      .andWhere("app.updatedAt IS NOT NULL")
      .getRawOne<{ avgHours: string | number | null }>();

    return raw?.avgHours ? Math.round(Number(raw.avgHours)) : null;
  } catch (error) {
    logger.error("Error computing avg review time:", error);
    return null;
  }
}

export async function countNewProUsersSince(since: Date): Promise<number> {
  try {
    const repo = AppDataSource.getRepository(User);
    const raw = await repo
      .createQueryBuilder("user")
      .leftJoin("pro_subscription", "ps", "ps.user_id = user.id")
      .where("user.userRole = :role", { role: UserRole.STUDENT })
      .andWhere(
        "(user.isProUser = :isPro OR (user.proExpiresAt IS NOT NULL AND user.proExpiresAt > NOW()) OR (ps.status = 'active' AND (ps.expires_at IS NULL OR ps.expires_at > NOW()) AND (ps.starts_at IS NULL OR ps.starts_at <= NOW())))",
        { isPro: true },
      )
      .andWhere(
        `COALESCE((SELECT MAX(ps2.starts_at) FROM pro_subscription ps2 WHERE ps2.user_id = user.id AND ps2.status = 'active' AND (ps2.starts_at IS NULL OR ps2.starts_at <= NOW()) AND (ps2.expires_at IS NULL OR ps2.expires_at > NOW())), user.proExpiresAt) >= :since`,
        { since },
      )
      .select("COUNT(DISTINCT user.id)", "cnt")
      .getRawOne<{ cnt: string | number }>();

    return raw ? Number(raw.cnt) : 0;
  } catch (error) {
    logger.error("Error counting new Pro users:", error);
    return 0;
  }
}
