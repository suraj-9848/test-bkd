import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  BaseEntity,
  CreateDateColumn,
} from "typeorm";
import { ModuleMCQ } from "./ModuleMCQ";

@Entity()
export class ModuleMCQAnswer extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => ModuleMCQ, (moduleMCQ) => moduleMCQ.id, {
    onDelete: "CASCADE",
  })
  moduleMCQ: ModuleMCQ;

  @Column()
  questionId: string;

  @Column()
  correctAnswer: string;

  @CreateDateColumn()
  createdAt: Date;
}
