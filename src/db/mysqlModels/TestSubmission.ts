import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  BaseEntity,
} from "typeorm";
import { TestResponse } from "./TestResponse";
import { Test } from "./Test";
import { User } from "./User";

@Entity()
export class TestSubmission extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Test, (test) => test.submissions)
  test: Test;

  @Column({ type: "timestamp" })
  submittedAt: Date;

  @Column({
    type: "enum",
    enum: ["SUBMITTED", "PARTIALLY_EVALUATED", "FULLY_EVALUATED"],
    default: "SUBMITTED",
  })
  status: "SUBMITTED" | "PARTIALLY_EVALUATED" | "FULLY_EVALUATED";

  @Column({ type: "float", nullable: true })
  mcqScore: number;

  @Column({ type: "float", nullable: true })
  totalMcqMarks: number;

  @Column({ type: "float", nullable: true })
  mcqPercentage: number;

  @Column({ type: "float", nullable: true })
  totalScore: number;

  @OneToMany(() => TestResponse, (response: TestResponse) => response.submission, {
    cascade: true,
  })
  responses: TestResponse[];
}
