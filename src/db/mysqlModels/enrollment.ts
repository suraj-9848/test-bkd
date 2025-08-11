import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
  BaseEntity,
  JoinColumn,
} from "typeorm";
import { User } from "./User";
import { Course } from "./Course";
import { UserCourse } from "./UserCourse";
@Entity()
export class Enrollment extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @ManyToOne(() => Course, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "course_id" })
  course: Course;

  @ManyToOne(() => UserCourse, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "user_course_id" })
  userCourse: UserCourse;

  @Column({ nullable: false })
  razorpay_payment_id: string;

  @Column({ nullable: false })
  razorpay_order_id: string;

  @CreateDateColumn()
  enrolledAt: Date;
}
