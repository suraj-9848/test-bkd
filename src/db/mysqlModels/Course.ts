import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  BaseEntity,
  OneToMany,
} from "typeorm";
import { Batch } from "./Batch";
import { Page } from "./Page";

@Entity("course")
export class Course extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  logo: string;

  @OneToMany(() => Page, (page) => page.course, { cascade: true })
  pages: Page[];

  @Column({ type: "text", nullable: true })
  content: string;

  @Column()
  start_date: Date;

  @Column()
  end_date: Date;

  @ManyToOne(() => Batch, (batch) => batch.courses, { onDelete: "CASCADE" })
  batch: Batch;
}
