import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { v4 as uuidv4 } from "uuid";

@Entity()
export class Answers {
  @PrimaryGeneratedColumn("uuid")
  id: string = uuidv4();

  @Column({ default: "QUIZ" })
  question_type: string = "QUIZ";

  @Column("uuid")
  user_id: string;

  @Column("uuid")
  session_id: string;

  @Column("uuid")
  page_id: string;

  @Column("uuid")
  question_id: string;

  @Column("simple-array")
  selected_options: string[];

  @Column()
  timestamp: Date;
}
