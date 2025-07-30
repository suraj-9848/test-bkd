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
import { JobApplication } from "./JobApplication";
import { TestSubmission } from "./TestSubmission";
import { RefreshToken } from "./RefreshToken";

export enum UserRole {
  STUDENT = "student",
  ADMIN = "admin",
  INSTRUCTOR = "instructor",
  RECRUITER = "recruiter",
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

  @Column({ nullable: true })
  profile_picture: string;

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

  @OneToMany(() => RefreshToken, (refreshToken) => refreshToken.user)
  refreshTokens: RefreshToken[];

  @OneToMany(() => JobApplication, (application) => application.user)
  jobApplications: JobApplication[];

  @ManyToOne(() => Org, (org) => org.users)
  @OneToMany(() => TestSubmission, (submission) => submission.user)
  submissions: TestSubmission[];

  @JoinColumn({ name: "org_id" })
  organization: Org;
}
