const { checkToken } = require('../aut/jwt');
const { AppError } = require('../error/error');

const authMiddleware = (req, res, next) => {
    // Get Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        // 401 Unauthorized: Thiếu Header Authorization
        return next(new AppError('Token required', 401));
    }

    // Authorization: Bearer <token>
    const parts = authHeader.split(' ');
    
    // Kiểm tra đúng định dạng 'Bearer <token>'
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return next(new AppError('Format is Authorization: Bearer [token]', 401));
    }

    const token = parts[1];

    if (!token) {
        return next(new AppError('Token required', 401));
    }

    try {
        // Nếu hàm checkToken ở jwt.js ném thẳng AppError (Cách 1):
        // result sẽ là decoded payload
        const decoded = checkToken(token);

        // Trường hợp checkToken trả về object { valid, data, error } (Cách 2):
        if (decoded && typeof decoded === 'object' && 'valid' in decoded) {
            if (!decoded.valid) {
                return next(new AppError(decoded.error || 'Invalid or expired token', 401));
            }
            req.user = decoded.data;
        } else {
            req.user = decoded;
        }

        next();
    } catch (error) {
        // Nếu checkToken bắn lỗi (như AppError), đẩy thẳng sang error handler
        next(error);
    }
};

module.exports = authMiddleware;