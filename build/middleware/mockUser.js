"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockUser = void 0;
const mockUser = (req, res, next) => {
    req.user = {
        id: "some-user-id",
        username: "anurag",
        email: "anurag@example.com",
        password: "",
        org_id: "some-org-id",
        batch_id: [],
        userRole: "Admin", // or "Instructor"
    }; // quick fix if types mismatch
    next();
};
exports.mockUser = mockUser;
//# sourceMappingURL=mockUser.js.map