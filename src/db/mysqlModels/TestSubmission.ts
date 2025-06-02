import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  BaseEntity,
  OneToMany,
  CreateDateColumn,
  ManyToOne,
} from "typeorm";
import { TestResponse } from "./TestResponse";
import { Test } from "./Test";
import { User } from "./User";

@Entity()
export class TestSubmission extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Test, (test) => test.submissions)
  test: Test;

  @ManyToOne(() => User, (user) => user.submissions)
  user: User;

  @OneToMany(() => TestResponse, (response) => response.submission, {
    cascade: true,
  })
  responses: TestResponse[];

  @Column({ nullable: true })
  totalScore: number;

  @Column({ nullable: true })
  mcqScore: number;

  @Column({ nullable: true })
  status: string;

  @CreateDateColumn()
  submittedAt: Date;
}
