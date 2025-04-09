"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logOut = exports.SignIn = void 0;
const SignIn = (req, res) => {
    const { username, password } = req.body;
    // Placeholder auth logic
    if (username === 'admin' && password === 'admin123') {
        res.status(200).json({ token: 'fake-jwt-token', user: { username } });
    }
    else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
};
exports.SignIn = SignIn;
const logOut = (req, res) => {
    // Just send a success message, assuming frontend deletes token/session
    res.status(200).json({ message: 'Logged out successfully' });
};
exports.logOut = logOut;
//# sourceMappingURL=authController.js.map