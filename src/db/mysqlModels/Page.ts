import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { Course } from "./Course";

@Entity()
export class Page {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  title: string;

  @Column("text")
  content: string;

  @ManyToOne(() => Course, (course) => course.pages, { onDelete: "CASCADE" })
  course: Course;
}
