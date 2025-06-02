import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  BaseEntity,
} from "typeorm";
import { TestSubmission } from "./TestSubmission";
import { Question } from "./Question";

@Entity()
export class TestResponse extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => TestSubmission, (submission) => submission.responses)
  submission: TestSubmission;

  @ManyToOne(() => Question, (question) => question.responses)
  question: Question;

  @Column({ nullable: true })
  answer: string;

  @Column({ nullable: true })
  score: number;

  @Column({ default: "PENDING" })
  evaluationStatus: string;

  @Column({ nullable: true })
  evaluatorComments: string;

  @Column()
  submissionId: string;

  @Column()
  questionId: string;
}
