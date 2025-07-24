import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  BaseEntity,
} from "typeorm";
import { Org } from "./Org";
import { Course } from "./Course";

@Entity("batch")
export class Batch extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column("uuid")
  org_id: string;

  @ManyToOne(() => Org, (org) => org.batches)
  @JoinColumn({ name: "org_id" })
  organization: Org;

  @ManyToMany(() => Course, (course) => course.batches)
  courses: Course[];
}
