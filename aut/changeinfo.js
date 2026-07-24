const db = require('../db');
const bcrypt = require('bcryptjs');


// Change Email
const changeEmail = async ({ userid, newEmail, password }) => {

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
        throw new Error("Invalid email format");
    }

    // 1. Check new email already exists
    const [existingUser] = await db.query(
        `SELECT userid FROM users WHERE email = ?`,
        [newEmail]
    );

    if (existingUser.length > 0) {
        throw new Error("Email already exists");
    }


    // 2. Get current password hash
    const [users] = await db.query(
        `SELECT password FROM users WHERE userid = ?`,
        [userid]
    );

    if (users.length === 0) {
        throw new Error("User not found");
    }

    const passwordHash = users[0].password;


    // 3. Compare password with hash
    const isMatch = await bcrypt.compare(password, passwordHash);

    if (!isMatch) {
        throw new Error("Incorrect password");
    }


    // 4. Update email
    const [result] = await db.query(
        `UPDATE users 
         SET email = ?
         WHERE userid = ?`,
        [newEmail, userid]
    );

    if (result.affectedRows === 0) {
        throw new Error("Failed to update email");
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

     if (newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters");
    }

    // 1. Get current password hash
    const [users] = await db.query(
        `SELECT password FROM users WHERE userid = ?`,
        [userid]
    );

    if (users.length === 0) {
        throw new Error("User not found");
    }

    const passwordHash = users[0].password;


    // 2. Check current password
    const isMatch = await bcrypt.compare(
        currentPassword,
        passwordHash
    );

    if (!isMatch) {
        throw new Error("Incorrect current password");
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
        throw new Error("Failed to update password");
    }

    return {
        message: "Password changed successfully"
    };
};


module.exports = {
    changeEmail,
    changePassword
};