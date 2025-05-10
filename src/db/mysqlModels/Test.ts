import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  BaseEntity,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Course } from "./Course";
import { Question } from "./Question";

export enum TestStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  ARCHIVED = "ARCHIVED",
}

@Entity()
export class Test extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  title: string;

  @Column("text")
  description: string;

  @ManyToOne(() => Course, (course) => course.tests, { onDelete: "CASCADE" })
  course: Course;

  @OneToMany(() => Question, (question) => question.test, { cascade: true })
  questions: Question[];

  @Column()
  maxMarks: number;

  @Column({ default: 0 })
  passingMarks: number;

  @Column()
  durationInMinutes: number;

  @Column("datetime")
  startDate: Date;

  @Column("datetime")
  endDate: Date;

  @Column({
    type: "enum",
    enum: TestStatus,
    default: TestStatus.DRAFT,
  })
  status: TestStatus;

  @Column({ default: false })
  shuffleQuestions: boolean;

  @Column({ default: false })
  showResults: boolean;

  @Column({ default: false })
  showCorrectAnswers: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  lastUpdated: Date;
}
