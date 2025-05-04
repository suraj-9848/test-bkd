import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { QuizOptions } from "./QuizOptions";

@Entity()
export class Question {
  @PrimaryGeneratedColumn("uuid")
  id: string = uuidv4();

  @Column()
  question_text: string;

  @Column({ default: "QUIZ" })
  type: string = "QUIZ";

  @OneToMany(() => QuizOptions, (options) => options.question)
  options: QuizOptions[];
}
