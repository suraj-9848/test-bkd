import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  BaseEntity,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Question } from "./Question";
import { TestSubmission } from "./TestSubmission";

export enum ResponseEvaluationStatus {
  PENDING = "PENDING",
  EVALUATED = "EVALUATED",
  ERROR = "ERROR",
}

@Entity()
export class TestResponse extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "text", nullable: true })
  answer: string;

  @Column({ type: "float", default: 0 })
  score: number;

  @Column({
    type: "enum",
    enum: ResponseEvaluationStatus,
    default: ResponseEvaluationStatus.PENDING,
  })
  evaluationStatus: ResponseEvaluationStatus;

  @Column({ type: "text", nullable: true })
  feedback: string;

  @Column({ type: "text", nullable: true })
  evaluatorComments: string | null;

  // NEW FIELDS FOR CODE EXECUTION
  @Column({ type: "text", nullable: true })
  code_submission: string | null;

  @Column({ type: "varchar", length: 50, nullable: true })
  programming_language: string | null;

  @Column({ type: "text", nullable: true })
  execution_output: string | null;

  @Column({ type: "text", nullable: true })
  execution_error: string | null;

  @Column({ type: "int", nullable: true })
  execution_time_ms: number | null;

  @Column({ type: "float", nullable: true })
  memory_used_mb: number | null;

  @Column({ type: "int", default: 0 })
  testcases_passed: number;

  @Column({ type: "int", default: 0 })
  total_testcases: number;

  @Column({ type: "text", nullable: true })
  testcase_results: string | null; // JSON string with detailed results

  @Column({ type: "varchar", length: 50, nullable: true })
  judge0_submission_token: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Question, (question) => question.responses, {
    onDelete: "CASCADE",
  })
  question: Question;

  @ManyToOne(() => TestSubmission, (submission) => submission.responses, {
    onDelete: "CASCADE",
  })
  submission: TestSubmission;
}
