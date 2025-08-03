import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  BaseEntity,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { JobApplication } from "./JobApplication";
import { Org } from "./Org";

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

  @Column({ nullable: true })
  applyLink: string;

  @Column({ type: "int", nullable: true })
  salary: number;

  @Column({
    type: "enum",
    enum: JobStatus,
    default: JobStatus.OPEN,
  })
  status: JobStatus;

  @OneToMany(() => JobApplication, (application) => application.job)
  applications: JobApplication[];

  @ManyToOne(() => Org, (org) => org.jobs)
  @JoinColumn({ name: "org_id" })
  organization: Org;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
