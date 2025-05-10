import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  BaseEntity,
} from "typeorm";
import { Question } from "./Question";
import { TestAttempt } from "./TestAttempt";

@Entity()
export class TestAnswer extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => TestAttempt, (attempt) => attempt.answers, {
    onDelete: "CASCADE",
  })
  attempt: TestAttempt;

  @ManyToOne(() => Question)
  question: Question;

  @Column("simple-array", { nullable: true })
  selectedOptions: string[]; // Store option IDs for MCQs

  @Column("text", { nullable: true })
  textAnswer: string; // For descriptive questions

  @Column({ type: "float", nullable: true })
  score: number;

  @Column({ nullable: true })
  feedback: string;

  @Column({ default: false })
  isEvaluated: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
