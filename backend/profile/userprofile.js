const db = require("../db");
const xss = require('xss');
const { AppError } = require('../error/error');

// ========================================
// VIEW PROFILE
// ========================================
const viewProfile = async ({ userid }) => {
    const query = `
        SELECT
            userid,
            nickname,
            bio
        FROM users
        WHERE userid = ?;
    `;

    const [rows] = await db.query(query, [userid]);

    if (rows.length === 0) {
        throw new AppError("User not found", 404);
    }

    return rows[0];
};

// ========================================
// UPDATE PROFILE
// ========================================
const updateProfile = async ({ userid, nickname, bio }) => {
    
    if (bio) {
        bio = xss(bio.trim(), { whiteList: {} });
        if (bio.length > 200) {
            throw new AppError("Bio cannot exceed 200 characters", 400);
        }
    }

    if (nickname) {
        nickname = xss(nickname.trim(), { whiteList: {} });
        if (nickname.length > 10) {
            throw new AppError("Nickname cannot exceed 10 characters", 400);
        }
    }

    const query = `
        UPDATE users
        SET
            nickname = COALESCE(?, nickname),
            bio = COALESCE(?, bio)
        WHERE userid = ?;
    `;

    const [result] = await db.query(query, [
        nickname,
        bio,
        userid
    ]);

    if (result.affectedRows === 0) {
        throw new AppError("User not found", 404);
    }

    const [rows] = await db.query(
        `
        SELECT
            userid,
            nickname,
            email,
            bio
        FROM users
        WHERE userid = ?;
        `,
        [userid]
    );

    return rows[0];
};

module.exports = {
    viewProfile,
    updateProfile
};