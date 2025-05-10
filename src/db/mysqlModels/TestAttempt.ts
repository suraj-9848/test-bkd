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
import { Test } from "./Test";
import { User } from "./User";
import { TestAnswer } from "./TestAnswer";

export enum AttemptStatus {
  STARTED = "STARTED",
  IN_PROGRESS = "IN_PROGRESS",
  SUBMITTED = "SUBMITTED",
  EVALUATED = "EVALUATED",
}

@Entity()
export class TestAttempt extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Test, { onDelete: "CASCADE" })
  test: Test;

  @ManyToOne(() => User)
  student: User;

  @Column({
    type: "enum",
    enum: AttemptStatus,
    default: AttemptStatus.STARTED,
  })
  status: AttemptStatus;

  @Column({ type: "float", nullable: true })
  score: number;

  @Column({ nullable: true })
  feedback: string;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ nullable: true })
  submittedAt: Date;

  @UpdateDateColumn()
  lastUpdated: Date;

  @OneToMany(() => TestAnswer, (answer) => answer.attempt, { cascade: true })
  answers: TestAnswer[];
}
