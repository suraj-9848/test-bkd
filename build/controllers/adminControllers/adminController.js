"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestData = exports.getUsers = void 0;
const getUsers = (req, res) => {
    // Dummy user list
    const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
    ];
    res.status(200).json({ success: true, users });
};
exports.getUsers = getUsers;
const getTestData = (req, res) => {
    res.status(200).json({ message: 'Test data from adminController' });
};
exports.getTestData = getTestData;
//# sourceMappingURL=adminController.js.map