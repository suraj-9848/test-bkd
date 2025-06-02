import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  BaseEntity,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { Org } from "./Org";
import { JobApplication } from "./JobApplication";

export enum JobStatus {
  OPEN = "open",
  CLOSED = "closed",
  COMPLETED = "completed",
}

@Entity()
export class Job extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string = uuidv4();

  @Column()
  title: string;

  @Column()
  companyName: string;

  @Column("text")
  description: string;

  @Column("text")
  location: string;

  @Column("simple-array")
  skills: string[];

  @Column("simple-array")
  eligibleBranches: string[];

  @Column({
    type: "enum",
    enum: JobStatus,
    default: JobStatus.OPEN,
  })
  status: JobStatus;

  @Column("uuid")
  org_id: string;

  @ManyToOne(() => Org, (org) => org.jobs)
  @JoinColumn({ name: "org_id" })
  organization: Org;

  @OneToMany(() => JobApplication, (application) => application.job)
  applications: JobApplication[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
