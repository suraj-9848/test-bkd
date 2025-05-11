// src/db/mysqlModels/UserDayCompletion.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  BaseEntity,
} from "typeorm";
import { User } from "./User";
import { DayContent } from "./DayContent";

@Entity()
export class UserDayCompletion extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, (user) => user.id, { onDelete: "CASCADE" })
  user: User;

  @ManyToOne(() => DayContent, (dayContent) => dayContent.id, {
    onDelete: "CASCADE",
  })
  day: DayContent;

  @Column({ default: false })
  completed: boolean;
}
