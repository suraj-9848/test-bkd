import {
  BaseEntity,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { User } from "./User";
import { Batch } from "./Batch";
import { Job } from "./Job";

@Entity()
export class Org extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string = uuidv4();

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  address: string;

  @OneToMany(() => User, (user) => user.organization)
  users: User[];

  @OneToMany(() => Batch, (batch) => batch.organization)
  batches: Batch[];

  @OneToMany(() => Job, (job) => job.organization)
  jobs: Job[];
}
