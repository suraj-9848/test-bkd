// src/entities/Batch.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Course } from './Course';
import { Org } from './Org';

@Entity()
export class Batch {
  @PrimaryGeneratedColumn('uuid')
  id: string = uuidv4();

  @Column()
  name: string;

  @Column('simple-array')
  requestors: string[];

  @Column('simple-array')
  members: string[];

  @Column('simple-array')
  course_id: string[];

  @Column()
  start_date: Date;

  @Column()
  end_date: Date;

  @Column('uuid')
  org_id: string;

  @ManyToOne('Org', 'batches')
  @JoinColumn({ name: 'org_id' })
  organization: Promise<Org>;

  @OneToMany(() => Course, course => course.batches)
  courses: Course[];
}