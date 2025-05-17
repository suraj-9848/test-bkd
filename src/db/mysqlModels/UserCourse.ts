import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  BaseEntity,
} from "typeorm";
import { User } from "./User";
import { Course } from "./Course";

@Entity()
export class UserCourse extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, (user) => user.userCourses)
  user: User;

  @ManyToOne(() => Course, (course) => course.userCourses)
  course: Course;

  @Column({ default: false })
  completed: boolean;

  @CreateDateColumn()
  assignedAt: Date;
}
