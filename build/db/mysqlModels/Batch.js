"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Batch = void 0;
// src/entities/Batch.ts
const typeorm_1 = require("typeorm");
const uuid_1 = require("uuid");
const Course_1 = require("./Course");
let Batch = class Batch {
    constructor() {
        this.id = (0, uuid_1.v4)();
    }
};
exports.Batch = Batch;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Batch.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Batch.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array'),
    __metadata("design:type", Array)
], Batch.prototype, "requestors", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array'),
    __metadata("design:type", Array)
], Batch.prototype, "members", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array'),
    __metadata("design:type", Array)
], Batch.prototype, "course_id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Date)
], Batch.prototype, "start_date", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Date)
], Batch.prototype, "end_date", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid'),
    __metadata("design:type", String)
], Batch.prototype, "org_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)('Org', 'batches'),
    (0, typeorm_1.JoinColumn)({ name: 'org_id' }),
    __metadata("design:type", Promise)
], Batch.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Course_1.Course, course => course.batches),
    __metadata("design:type", Array)
], Batch.prototype, "courses", void 0);
exports.Batch = Batch = __decorate([
    (0, typeorm_1.Entity)()
], Batch);
//# sourceMappingURL=Batch.js.map