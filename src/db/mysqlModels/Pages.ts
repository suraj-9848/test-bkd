import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { v4 as uuidv4 } from "uuid";

@Entity()
export class Pages {
  @PrimaryGeneratedColumn("uuid")
  id: string = uuidv4();

  @Column("json")
  content: any;

  @Column("simple-array")
  question_id: string[];

  @Column({ nullable: true })
  passing_score: number;

  @Column({ nullable: true })
  duration: number;
}
