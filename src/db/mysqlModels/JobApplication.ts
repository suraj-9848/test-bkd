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

  @Column("uuid", { nullable: true }) // Make nullable to allow anonymous applications
  user_id: string | null;

  @Column("uuid")
  job_id: string;

  @Column({ nullable: true })
  resumePath: string;

  // Unique identifier for anonymous applications
  @Column({ nullable: true, unique: true })
  applicationIdentifier: string;

  // Additional fields for anonymous applications
  @Column({ nullable: true })
  applicantName: string;

  @Column({ nullable: true })
  applicantEmail: string;

  @Column({ nullable: true })
  college: string;

  @Column({ nullable: true })
  graduationYear: string;

  @Column({ nullable: true })
  branch: string;

  @Column("simple-array", { nullable: true })
  skills: string[];

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
