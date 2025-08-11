import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  BaseEntity,
  OneToMany,
} from "typeorm";
import { Batch } from "./Batch";
import { Module } from "./Module";
import { Test } from "./Test";
import { UserCourse } from "./UserCourse";
import { Meeting } from "./Meeting";

@Entity()
export class Course extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  logo: string;

  @OneToMany(() => Module, (module) => module.course, { cascade: true })
  modules: Module[];

  @Column({ nullable: false })
  is_public: boolean;

  @Column()
  start_date: Date;

  @Column()
  end_date: Date;

  @ManyToMany(() => Batch, (batch) => batch.courses, { onDelete: "CASCADE" })
  @JoinTable({
    name: "course_batch_assignments",
    joinColumn: {
      name: "courseId",
      referencedColumnName: "id",
    },
    inverseJoinColumn: {
      name: "batchId",
      referencedColumnName: "id",
    },
  })
  batches: Batch[];

  @Column()
  instructor_name: string;

  @Column({ type: "text", nullable: true })
  overview: string;

  @Column({ nullable: true })
  trainer_name: string;

  @Column({ type: "text", nullable: true })
  trainer_bio: string;

  @Column({ nullable: true })
  trainer_avatar: string;

  @Column({ nullable: true })
  trainer_linkedin: string;

  @Column({ type: "float", nullable: true })
  price: number;

  @Column({ nullable: true })
  duration: string;

  @Column({ nullable: true })
  image: string;

  @Column("simple-array", { nullable: true })
  features: string[];

  @Column("simple-array", { nullable: true })
  curriculum: string[];

  @Column("simple-array", { nullable: true })
  prerequisites: string[];

  @Column("simple-array", { nullable: true })
  tags: string[];

  @Column({ nullable: true })
  mode: string;

  @Column("simple-array", { nullable: true })
  what_you_will_learn: string[];

  @OneToMany(() => UserCourse, (uc) => uc.course, { cascade: true })
  userCourses: UserCourse[];

  @OneToMany(() => Test, (test) => test.course, { cascade: true })
  tests: Test[];

  @OneToMany(() => Meeting, (meeting) => meeting.course, { cascade: true })
  meetings: Meeting[];
}
