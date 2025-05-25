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

  @Column("text")
  answer: string;

  @ManyToOne(() => TestSubmission, (submission) => submission.responses)
  submission: TestSubmission;

  @ManyToOne(() => Question, (question) => question.responses)
  question: Question;

  @Column("enum", { enum: ["PENDING", "EVALUATED"], default: "PENDING" })
  evaluationStatus: string;

  @Column("float", { nullable: true })
  score: number;

  @Column("text", { nullable: true })
  evaluatorComments: string;
}
