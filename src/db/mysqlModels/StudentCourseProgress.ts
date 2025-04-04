import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity()
export class StudentCourseProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string = uuidv4();

  @Column('uuid')
  student_id: string;

  @Column('uuid')
  session_id: string;

  @Column('uuid')
  current_page: string;

  @Column()
  status: string;
}