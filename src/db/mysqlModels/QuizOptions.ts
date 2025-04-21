import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { Question } from "./Question";

@Entity()
export class QuizOptions {
  @PrimaryGeneratedColumn("uuid")
  id: string = uuidv4();

  @Column()
  text: string;

  @Column()
  correct: boolean;

  @ManyToOne(() => Question, (question) => question.options)
  question: Question;
}
