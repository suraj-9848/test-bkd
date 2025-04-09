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
exports.QuizOptions = void 0;
const typeorm_1 = require("typeorm");
const uuid_1 = require("uuid");
const Question_1 = require("./Question");
let QuizOptions = class QuizOptions {
    constructor() {
        this.id = (0, uuid_1.v4)();
    }
};
exports.QuizOptions = QuizOptions;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], QuizOptions.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], QuizOptions.prototype, "text", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Boolean)
], QuizOptions.prototype, "correct", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Question_1.Question, question => question.options),
    __metadata("design:type", Question_1.Question)
], QuizOptions.prototype, "question", void 0);
exports.QuizOptions = QuizOptions = __decorate([
    (0, typeorm_1.Entity)()
], QuizOptions);
//# sourceMappingURL=QuizOptions.js.map