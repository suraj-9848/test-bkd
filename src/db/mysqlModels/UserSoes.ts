import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

export enum UserRole {
  ADMIN = "MASTER",
  STUDENT = "STUDENT",
  COLLEGE = "COLLEGE",
  TRAINER = "TRAINER",
  MENTOR = "USER",
}

@Entity("user_soes", { schema: "sap" })
export class UserSoes extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  userId: string;

  @Column("varchar", { name: "user_name", length: 250, unique: true })
  userName: string;

  @Column({ nullable: true })
  avatar: string

  @Column("varchar", { name: "user_contact_no", length: 30, nullable: true })
  userContactNo: string;

  @Column("varchar", { name: "user_email", length: 250 })
  userEmail: string;

  @Column("varchar", { name: "user_password", length: 100, nullable: true })
  userPassword: string;

  @Column("varchar", { name: "user_profile", length: 150, nullable: true })
  userProfile: string;

  @Column()
  userFullName: string;

  @Column({
    name: "user_type",
    type: "enum",
    enum: UserRole,
    default: UserRole.STUDENT,
  })
  userType: UserRole;

  @Column("enum", { name: "user_status", enum: ["Enable", "Disable"] })
  userStatus: "Enable" | "Disable";

  @Column("datetime", { name: "user_created_on" })
  userCreatedOn: Date;

  @Column({ nullable: true })
  lastLoginDate: Date;
}
