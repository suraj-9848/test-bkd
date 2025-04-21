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
@Entity()
export class Course extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  logo: string;

  @OneToMany(() => Page, (page) => page.course, { cascade: true })
  pages: Page[];

  @Column("json")
  content: any;

  @Column()
  start_date: Date;

  @Column()
  end_date: Date;

  @ManyToOne(() => Batch, (batch) => batch.courses, { onDelete: "CASCADE" })
  batch: Batch;
}
