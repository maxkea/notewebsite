const { checkToken } = require('../aut/jwt');

const authMiddleware = (req, res, next) => {
    // Get Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            message: 'Token required'
        });
    }

    // Authorization: Bearer <token>
    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            message: 'Token required'
        });
    }

    // Use checkToken() from auth/jwt.js
    const result = checkToken(token);

    if (!result.valid) {
        return res.status(401).json({
            message: 'Invalid or expired token',
            error: result.error
        });
    }
    req.user = result.data;

    next();
};

module.exports = authMiddleware;