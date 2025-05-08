import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  BaseEntity,
} from "typeorm";
import { Module } from "./Module";

@Entity()
export class ModuleMCQ extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Module, (module) => module.tests, { onDelete: "CASCADE" })
  module: Module;

  @Column("json")
  questions: any;

  @Column({ default: 70 })
  passingScore: number;

  // @Column({ nullable: true })
  // duration: number;
}
