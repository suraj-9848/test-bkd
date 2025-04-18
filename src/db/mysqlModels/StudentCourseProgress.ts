import { Entity, Column, PrimaryGeneratedColumn, BaseEntity } from "typeorm";

@Entity()
export class StudentCourseProgress extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  student_id: number;

  @Column()
  session_id: number;

  @Column()
  current_page: number;

  @Column()
  status: string;
}