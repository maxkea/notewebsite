const db = require("../db");
const jwt = require("./jwt");
const bcrypt = require("bcryptjs");
const xss =require('xss');
const {AppError}= require('../error/error');

// Register
const register = async ({ nickname, email, password }) => {

    if (nickname) {
            nickname = xss(nickname.trim(), { whiteList: {} });
            if (nickname.length > 10) {
                throw new AppError("nickname too long",400);
            }
        }
    if (!email) {
        throw new AppError("Email is required", 400);
    }
    //email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new AppError("Invalid email format",400);
    }
    
    // Validate password strength
    if (password.length < 6) {
        throw new AppError("Password must be at least 6 characters",400);
    }

    const [users] = await db.query(
        "SELECT userid FROM users WHERE email = ?",
        [email]
    );

    if (users.length > 0) {
        throw new AppError("Email is already registered",409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
        `
        INSERT INTO users (nickname, email, password)
        VALUES (?, ?, ?)
        `,
        [nickname, email, hashedPassword]
    );

    return {
        userid: result.insertId,
        nickname,
        email
    };
};

// Login
const login = async ({ email, password }) => {
    if (!email || !password) {
        // 400 Bad Request: Thiếu thông tin đăng nhập
        throw new AppError("Email and password are required", 400);
    }
    const [users] = await db.query(
        `
        SELECT userid, nickname, email, password
        FROM users
        WHERE email = ?
        `,
        [email]
    );

    if (users.length === 0) {
        throw new AppError("Invalid email or password",401);
    }

    const user = users[0];

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
        throw new AppError("Invalid email or password",401);
    }

    const token = jwt.provideToken({
        userid: user.userid,
        email: user.email
    });

    return {
        user: {
            userid: user.userid,
            nickname: user.nickname,
            email: user.email
        },
        token
    };
};

module.exports = {
    register,
    login
};