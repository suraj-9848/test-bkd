// src/entities/Org.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { User } from './User';
import { Batch } from './Batch';

@Entity()
export class Org {
  @PrimaryGeneratedColumn('uuid')
  id: string = uuidv4();

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  address: string;

  @OneToMany(() => User, user => user.organization)
  users: User[];

  @OneToMany('Batch', 'organization')
  batches: Promise<Batch[]>;
}