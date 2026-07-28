const db = require('../db');
const bcrypt = require('bcryptjs');
const {AppError}= require('../error/error');
const validator = require('validator');


// Change Email
const changeEmail = async ({ userid, newEmail, password }) => {

    if (!newEmail || !password) {
        throw new AppError("Email and password are required", 400);
    }

    if (!validator.isEmail(newEmail)) {
        throw new AppError('Invalid email', 400);
    }

    // 1. Check new email already exists
    const [existingUser] = await db.query(
        `SELECT userid FROM users WHERE email = ?`,
        [newEmail]
    );

    if (existingUser.length > 0) {
       throw new AppError("Email already exists", 409);;
    }


    // 2. Get current password hash
    const [users] = await db.query(
        `SELECT password FROM users WHERE userid = ?`,
        [userid]
    );

    if (users.length === 0) {
       throw new AppError("User not found", 404);
    }

    const passwordHash = users[0].password;


    // 3. Compare password with hash
    const isMatch = await bcrypt.compare(password, passwordHash);

    if (!isMatch) {
        throw new AppError("Incorrect password", 401);
    }


    // 4. Update email
    const [result] = await db.query(
        `UPDATE users 
         SET email = ?
         WHERE userid = ?`,
        [newEmail, userid]
    );

    if (result.affectedRows === 0) {
        throw new AppError("Failed to update email", 500);
    }

    return {
        message: "Email changed successfully"
    };
};



// Change Password
const changePassword = async ({
    userid,
    currentPassword,
    newPassword
}) => {

    // Validate missing fields
    if (!currentPassword || !newPassword) {
        throw new AppError("Current password and new password are required", 400);
    }

    if (newPassword.length < 6) {
        throw new AppError("Password must be at least 6 characters", 400);
    }

    // 1. Get current password hash
    const [users] = await db.query(
        `SELECT password FROM users WHERE userid = ?`,
        [userid]
    );

    if (users.length === 0) {
        throw new AppError("User not found", 404);
    }

    const passwordHash = users[0].password;


    // 2. Check current password
    const isMatch = await bcrypt.compare(
        currentPassword,
        passwordHash
    );

    if (!isMatch) {
        throw new AppError("Incorrect current password", 401);
    }


    // 3. Hash new password
    const newPasswordHash = await bcrypt.hash(
        newPassword,
        10
    );


    // 4. Update password
    const [result] = await db.query(
        `UPDATE users
         SET password = ?
         WHERE userid = ?`,
        [newPasswordHash, userid]
    );

    if (result.affectedRows === 0) {
        throw new AppError("Failed to update password", 500);
    }

    return {
        message: "Password changed successfully"
    };
};


module.exports = {
    changeEmail,
    changePassword
};