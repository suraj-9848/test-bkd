import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  BaseEntity,
  OneToOne,
} from "typeorm";
import { Course } from "./Course";
import { DayContent } from "./DayContent";
import { ModuleMCQ } from "./ModuleMCQ";

@Entity()
export class Module extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Course, (course) => course.modules, { onDelete: "CASCADE" })
  course: Course;

  @Column("longtext")
  title: string;

  @Column()
  order: number;

  @OneToMany(() => DayContent, (day) => day.module, { cascade: true })
  days: DayContent[];

  @Column({ default: true })
  isLocked: boolean;

  @OneToMany(() => ModuleMCQ, (test) => test.module, { cascade: true })
  tests: ModuleMCQ[];
}
