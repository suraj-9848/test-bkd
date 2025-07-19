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

  @OneToMany(() => UserCourse, (uc) => uc.course, { cascade: true })
  userCourses: UserCourse[];

  @OneToMany(() => Test, (test) => test.course, { cascade: true })
  tests: Test[];
}
