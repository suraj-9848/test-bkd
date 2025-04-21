import { Entity, Column, PrimaryGeneratedColumn, BaseEntity } from "typeorm";

@Entity()
export class StudentSessionProgress extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  student_id: number;

  @Column()
  session_id: number;

  @Column()
  question_id: number;

  @Column()
  status: string;
}
