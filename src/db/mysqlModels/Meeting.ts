import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  BaseEntity,
} from "typeorm";
import { Course } from "./Course";

@Entity()
export class Meeting extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  title: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column()
  link: string; // MS Teams meeting URL

  // Replaced scheduledTime with explicit start & end times
  @Column({ type: "datetime" })
  startTime: Date;

  @Column({ type: "datetime" })
  endTime: Date;

  @Column("simple-array")
  approvedEmails: string[]; // list of student emails allowed to view/join

  @Column("uuid")
  courseId: string;

  @ManyToOne(() => Course, (course) => course.meetings, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "courseId" })
  course: Course;
}
