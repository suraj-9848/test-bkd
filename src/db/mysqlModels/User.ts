import {
  BaseEntity,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { UserCourse } from "./UserCourse";
import { v4 as uuidv4 } from "uuid";
import { Org } from "./Org";
import { TestSubmission } from "./TestSubmission";

export enum UserRole {
  STUDENT = "student",
  ADMIN = "admin",
  COLLEGE_ADMIN = "college_admin",
  INSTRUCTOR = "instructor",
}

@Entity()
export class User extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string = uuidv4();

  @Column()
  username: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  password: string;

  @Column("uuid", { nullable: true })
  org_id: string;

  @Column("simple-array")
  batch_id: string[];

  @Column({
    type: "enum",
    enum: UserRole,
    default: UserRole.STUDENT,
  })
  userRole: UserRole;

  @OneToMany(() => UserCourse, (uc) => uc.user)
  userCourses: UserCourse[];

  @ManyToOne(() => Org, (org) => org.users)
  @OneToMany(() => TestSubmission, (submission) => submission.user)
  submissions: TestSubmission[];

  @JoinColumn({ name: "org_id" })
  organization: Org;
}
