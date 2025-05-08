import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    BaseEntity,
  } from "typeorm";
  import { ModuleMCQ } from "./ModuleMCQ";
  import { User } from "./User";
  
  @Entity()
  export class ModuleMCQResponses extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;
  
    @ManyToOne(() => ModuleMCQ, (moduleMCQ) => moduleMCQ.id, { onDelete: "CASCADE" })
    moduleMCQ: ModuleMCQ;
  
    @ManyToOne(() => User, (user) => user.id, { onDelete: "CASCADE" })
    user: User;
  
    @Column("json")
    responses: any;  
  }
  