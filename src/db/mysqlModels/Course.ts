import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
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

  @Column()
  start_date: Date;

  @Column()
  end_date: Date;

  @ManyToOne(() => Batch, (batch) => batch.courses, { onDelete: "CASCADE" })
  batch: Batch;

  @OneToMany(() => UserCourse, (uc) => uc.course)
  userCourses: UserCourse[];

  @OneToMany(() => Test, (test) => test.course)
  tests: Test[];
}
