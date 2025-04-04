import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Org } from './Org';
 

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string = uuidv4();

  @Column()
  username: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  password: string;

  @Column('uuid')
  org_id: string;

  @Column('simple-array')
  batch_id: string[];

  @ManyToOne(() => Org, org => org.users)
  @JoinColumn({ name: 'org_id' })
  organization: Org;
}