import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { User } from "./User";
import { Pages } from "./Pages";

@Entity()
export class Sessions {
  @PrimaryGeneratedColumn("uuid")
  id: string = uuidv4();

  @Column("uuid")
  user_id: string;

  @Column("uuid")
  page_id: string;

  @Column()
  start_time: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user: User;

  @ManyToOne(() => Pages)
  @JoinColumn({ name: "page_id" })
  page: Pages;
}
