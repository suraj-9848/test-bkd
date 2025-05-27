import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  BaseEntity,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { User } from "./User";
import { Job } from "./Job";

export enum ApplicationStatus {
  APPLIED = "applied",
  UNDER_REVIEW = "under_review",
  SHORTLISTED = "shortlisted",
  REJECTED = "rejected",
  HIRED = "hired",
}

@Entity()
export class JobApplication extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string = uuidv4();

  @Column("uuid")
  user_id: string;

  @Column("uuid")
  job_id: string;

  @Column({ nullable: true })
  resumePath: string;

  @Column({
    type: "enum",
    enum: ApplicationStatus,
    default: ApplicationStatus.APPLIED,
  })
  status: ApplicationStatus;

  @ManyToOne(() => User, (user) => user.jobApplications)
  @JoinColumn({ name: "user_id" })
  user: User;

  @ManyToOne(() => Job, (job) => job.applications)
  @JoinColumn({ name: "job_id" })
  job: Job;

  @CreateDateColumn()
  appliedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
