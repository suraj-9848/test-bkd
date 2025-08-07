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

export enum CPEditRequestStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

@Entity("cp_edit_requests")
@Index("idx_cp_edit_requests_user_id", ["user_id"])
@Index("idx_cp_edit_requests_status", ["status"])
export class CPEditRequest extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string = uuidv4();

  @Column("uuid")
  user_id: string;

  // Current platform usernames
  @Column({ nullable: true })
  current_leetcode_username: string;

  @Column({ nullable: true })
  current_codeforces_username: string;

  @Column({ nullable: true })
  current_codechef_username: string;

  @Column({ nullable: true })
  current_atcoder_username: string;

  // Requested changes
  @Column({ nullable: true })
  requested_leetcode_username: string;

  @Column({ nullable: true })
  requested_codeforces_username: string;

  @Column({ nullable: true })
  requested_codechef_username: string;

  @Column({ nullable: true })
  requested_atcoder_username: string;

  @Column("simple-array", { nullable: true })
  requested_active_platforms: string[];

  // Request details
  @Column("text", { nullable: true })
  reason: string;

  @Column({
    type: "enum",
    enum: CPEditRequestStatus,
    default: CPEditRequestStatus.PENDING,
  })
  status: CPEditRequestStatus;

  // Admin response
  @Column("uuid", { nullable: true })
  reviewed_by: string;

  @Column("text", { nullable: true })
  admin_notes: string;

  @Column({ type: "datetime", nullable: true })
  reviewed_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relationships
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "reviewed_by" })
  reviewer: User;
}
