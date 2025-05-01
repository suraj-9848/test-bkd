import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  BaseEntity,
} from "typeorm";
import { Course } from "./Course";

@Entity()
export class Test extends BaseEntity {
  @PrimaryGeneratedColumn("uuid") 
  id: string; 

  @Column()
  title: string;

  @Column("text")
  description: string;

  @Column("json")
  questions: { question: string; options: string[]; correctAnswer: string }[];

  @ManyToOne(() => Course, (course) => course.tests, { onDelete: "CASCADE" })
  course: Course;

  @Column()
  maxMarks: number;

  @Column()
  durationInMinutes: number;

  @Column("date")
  startDate: string;

  @Column("date")
  endDate: string;
}
