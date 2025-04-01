import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("validity_soes", { schema: "sap" })
export class ValiditySoes extends BaseEntity {
  @PrimaryGeneratedColumn({ type: "int", name: "validity_id" })
  validityId: number;

  @Column("int", { name: "student_id" })
  studentId: number;

  @Column("varchar", { name: "student_name", length: 100 })
  studentName: string;

  @Column("date", { name: "membership_added_on" })
  membershipAddedOn: string;

  @Column("int", { name: "Valid_duration" })
  validDuration: number;

  @Column("date", { name: "expiry_date" })
  expiryDate: string;

  @Column("enum", { name: "validity_status", enum: ["Active", "Expired"] })
  validityStatus: "Active" | "Expired";
}
