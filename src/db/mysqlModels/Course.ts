import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Batch } from './Batch';

@Entity()
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string = uuidv4();

  @Column()
  title: string;

  @Column({ nullable: true })
  logo: string;

  @Column('simple-array')
  pages_id: string[];

  @Column('json')
  content: any;

  @Column()
  start_date: Date;

  @Column()
  end_date: Date;

  @ManyToOne(() => Batch, batch => batch.courses)
  batches: Batch;
}