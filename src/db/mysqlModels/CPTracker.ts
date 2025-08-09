import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  BaseEntity,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { User } from "./User";

@Entity("cp_tracker")
@Index("idx_cp_tracker_user_id", ["user_id"])
export class CPTracker extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string = uuidv4();

  @Column("uuid")
  user_id: string;

  // Coding Platform Usernames
  @Column({ nullable: true })
  leetcode_username: string;

  @Column({ nullable: true })
  codeforces_username: string;

  @Column({ nullable: true })
  codechef_username: string;

  @Column({ nullable: true })
  atcoder_username: string;

  // LeetCode Stats
  @Column({ type: "int", default: 0 })
  leetcode_total_problems: number;

  @Column({ type: "int", default: 0 })
  leetcode_easy_solved: number;

  @Column({ type: "int", default: 0 })
  leetcode_medium_solved: number;

  @Column({ type: "int", default: 0 })
  leetcode_hard_solved: number;

  // Detailed LeetCode metrics for new scoring
  @Column({ type: "int", default: 0 })
  leetcode_contest_solved_count: number; // LCCSC

  @Column({ type: "int", default: 0 })
  leetcode_practice_solved_count: number; // LCPSC

  @Column({ type: "int", default: 0 })
  leetcode_contests_participated: number;

  @Column({ type: "int", default: 0 })
  leetcode_current_rating: number;

  @Column({ type: "int", default: 0 })
  leetcode_highest_rating: number;

  @Column({ type: "datetime", nullable: true })
  leetcode_last_contest_date: Date;

  @Column({ nullable: true })
  leetcode_last_contest_name: string;

  // CodeForces Stats
  @Column({ nullable: true })
  codeforces_handle: string;

  @Column({ type: "int", default: 0 })
  codeforces_rating: number;

  @Column({ type: "int", default: 0 })
  codeforces_max_rating: number;

  @Column({ nullable: true })
  codeforces_rank: string;

  @Column({ type: "int", default: 0 })
  codeforces_contests_participated: number;

  @Column({ type: "int", default: 0 })
  codeforces_problems_solved: number;

  // CodeChef Stats

  @Column({ type: "int", default: 0 })
  codechef_rating: number;

  @Column({ type: "int", default: 0 })
  codechef_highest_rating: number;

  @Column({ nullable: true })
  codechef_stars: string;

  @Column({ type: "int", default: 0 })
  codechef_contests_participated: number;

  @Column({ type: "int", default: 0 })
  codechef_problems_solved: number;

  @Column({ type: "int", default: 0 })
  atcoder_rating: number;

  @Column({ type: "int", default: 0 })
  atcoder_highest_rating: number;

  @Column({ nullable: true })
  atcoder_color: string;

  @Column({ type: "int", default: 0 })
  atcoder_contests_participated: number;

  @Column({ type: "int", default: 0 })
  atcoder_problems_solved: number;

  // Platform-specific scores
  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  leetcode_score: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  codeforces_score: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  codechef_score: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  atcoder_score: number;

  // Overall Performance Score (calculated)
  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  performance_score: number;

  // Last update timestamps for each platform
  @Column({ type: "datetime", nullable: true })
  leetcode_last_updated: Date;

  @Column({ type: "datetime", nullable: true })
  codeforces_last_updated: Date;

  @Column({ type: "datetime", nullable: true })
  codechef_last_updated: Date;

  @Column({ type: "datetime", nullable: true })
  atcoder_last_updated: Date;

  // Active platforms (to avoid unnecessary API calls)
  @Column("simple-array", { nullable: true })
  active_platforms: string[];

  // Last time user triggered a manual refresh
  @Column({ type: "datetime", nullable: true })
  last_updated_by_user: Date;

  // Connection status
  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relationship with User
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  // Calculate platform-specific scores and overall performance
  calculatePerformanceScore(): number {
    // LeetCode Score: LC = LCCSC*10 + LCPSC*1 + LCCP*1 + LCRA*1
    const lccsc = this.leetcode_contest_solved_count || 0;
    const lcpsc = this.leetcode_practice_solved_count || 0;
    const lccp = this.leetcode_total_problems || 0;
    const lcra = this.leetcode_current_rating || 0;
    this.leetcode_score = lccsc * 10 + lcpsc * 1 + lccp * 1 + lcra * 1;

    // CodeForces Score: Similar formula (you can customize weights)
    this.codeforces_score =
      (this.codeforces_contests_participated || 0) * 15 +
      (this.codeforces_problems_solved || 0) * 2 +
      (this.codeforces_rating || 0) * 1;

    // CodeChef Score: Similar formula (you can customize weights)
    this.codechef_score =
      (this.codechef_contests_participated || 0) * 12 +
      (this.codechef_problems_solved || 0) * 2 +
      (this.codechef_rating || 0) * 1;

    // AtCoder Score: Similar formula (you can customize weights)
    this.atcoder_score =
      (this.atcoder_contests_participated || 0) * 10 +
      (this.atcoder_problems_solved || 0) * 2 +
      (this.atcoder_rating || 0) * 1;

    // Total performance score is sum of all platform scores
    const totalScore =
      this.leetcode_score +
      this.codeforces_score +
      this.codechef_score +
      this.atcoder_score;

    return Math.round(totalScore * 100) / 100;
  }
}
