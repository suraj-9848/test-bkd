import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  BaseEntity,
} from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { QuizOptions } from "./QuizOptions";
import { Test } from "./Test";

export enum QuestionType {
  MCQ = "MCQ",
  DESCRIPTIVE = "DESCRIPTIVE",
}

@Entity()
export class Question extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string = uuidv4();

  @Column()
  question_text: string;

  @Column({
    type: "enum",
    enum: QuestionType,
    default: QuestionType.MCQ,
  })
  type: QuestionType;

  @Column({ default: 1 })
  marks: number;

  @Column({ nullable: true })
  expectedWordCount: number;

  @OneToMany(() => QuizOptions, (options) => options.question, {
    cascade: true,
  })
  options: QuizOptions[];

  @ManyToOne(() => Test, (test) => test.questions, { onDelete: "CASCADE" })
  test: Test;
}
