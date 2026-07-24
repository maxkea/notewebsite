const db = require("../db");
const jwt = require("./jwt");
const bcrypt = require("bcryptjs");
const xss =require('xss');

// Register
const register = async ({ nickname, email, password }) => {

    if (nickname) {
            nickname = xss(nickname.trim(), { whiteList: {} });
            if (nickname.length > 10) {
                throw new Error("nickname too long");
            }
        }

    //email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new Error("Invalid email format");
    }
    
    // Validate password strength
    if (password.length < 6) {
        throw new Error("Password must be at least 6 characters");
    }

    const [users] = await db.query(
        "SELECT userid FROM users WHERE email = ?",
        [email]
    );

    if (users.length > 0) {
        throw new Error("Email is already registered");
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
    const [users] = await db.query(
        `
        SELECT userid, nickname, email, password
        FROM users
        WHERE email = ?
        `,
        [email]
    );

    if (users.length === 0) {
        throw new Error("Invalid email or password");
    }

    const user = users[0];

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
        throw new Error("Invalid email or password");
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