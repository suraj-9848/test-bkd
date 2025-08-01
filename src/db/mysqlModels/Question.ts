import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  BaseEntity,
} from "typeorm";
import { QuizOptions } from "./QuizOptions";
import { Test } from "./Test";
import { TestResponse } from "./TestResponse";

export enum QuestionType {
  MCQ = "MCQ",
  DESCRIPTIVE = "DESCRIPTIVE",
  CODE = "CODE",
}

@Entity()
export class Question extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "text" })
  question_text: string;

  @Column({
    type: "enum",
    enum: QuestionType,
    default: QuestionType.MCQ,
  })
  type: QuestionType;

  @Column({ type: "int", default: 1 })
  marks: number;

  @Column({ type: "int", nullable: true })
  expectedWordCount: number | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  codeLanguage: string | null;

  @Column({ nullable: true })
  correctAnswer: string;

  @OneToMany(() => QuizOptions, (options) => options.question, {
    cascade: true,
  })
  options: QuizOptions[];

  @OneToMany(() => TestResponse, (response) => response.question, {
    cascade: true,
  })
  responses: TestResponse[];

  @ManyToOne(() => Test, (test) => test.questions, { onDelete: "CASCADE" })
  test: Test;
}
