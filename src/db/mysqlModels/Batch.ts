import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { Org } from "./Org";
import { Course } from "./Course";

@Entity()
export class Batch {
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

  @OneToMany(() => Course, (course) => course.batch)
  courses: Course[];
}
