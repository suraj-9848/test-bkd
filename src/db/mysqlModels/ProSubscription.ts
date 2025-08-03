import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  BaseEntity,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { User } from "./User";

export enum ProPlanType {
  FREE = "free",
  PRO_MONTHLY = "pro_monthly",
  PRO_YEARLY = "pro_yearly",
}

export enum ProSubscriptionStatus {
  ACTIVE = "active",
  CANCELED = "canceled",
  EXPIRED = "expired",
  PENDING = "pending",
}

@Entity()
export class ProSubscription extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string = uuidv4();

  @Column("uuid")
  user_id: string;

  @Column("uuid")
  plan_id: string;

  @Column({
    type: "enum",
    enum: ProPlanType,
    default: ProPlanType.FREE,
  })
  plan_type: ProPlanType;

  @Column({
    type: "enum",
    enum: ProSubscriptionStatus,
    default: ProSubscriptionStatus.PENDING,
  })
  status: ProSubscriptionStatus;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  amount: number;

  @Column({ default: "INR", length: 3 })
  currency: string;

  @Column({ nullable: true })
  razorpay_order_id: string;

  @Column({ nullable: true })
  razorpay_payment_id: string;

  @Column({ nullable: true })
  razorpay_signature: string;

  @Column({ nullable: true })
  starts_at: Date;

  @Column({ nullable: true })
  expires_at: Date;

  @Column({ default: false })
  auto_renew: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user: User;
}
