
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  BaseEntity,
} from "typeorm";
import { User } from "./User";
import { v4 as uuidv4 } from "uuid";

@Entity("refresh_tokens")
@Index("idx_refresh_tokens_user_id", ["user_id"])
@Index("idx_refresh_tokens_expires_at", ["expires_at"])
export class RefreshToken extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string = uuidv4();

  @Column({ type: "varchar", length: 36, nullable: false })
  user_id: string;

  @Column({ type: "longtext", nullable: false })
  token: string;

  @Column({ type: "datetime", nullable: false })
  expires_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.refreshTokens, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "user_id" })
  user: User;
}