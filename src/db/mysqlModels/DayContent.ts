import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  BaseEntity,
} from "typeorm";
import { Module } from "./Module";

@Entity()
export class DayContent extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Module, (module) => module.days, { onDelete: "CASCADE" })
  module: Module;

  @Column()
  dayNumber: number; // This will be a continuous sequence, e.g., 1, 2, 3, ..., 11, 12, ...

  @Column("text")
  content: string;

  @Column({ default: false })
  completed: boolean;
}
