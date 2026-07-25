const db = require('../db');

const {
    checkNotePermission
} = require('./notePermission');


// ========================================
// LIKE
// ========================================

const likes = async ({ userid, noteid }) => {

    // Kiểm tra quyền xem note
    const canAccess = await checkNotePermission({
        userid,
        noteid
    });

    if (!canAccess) {
        throw new Error(
            'You do not have permission to like this note'
        );
    }


    // Kiểm tra user đã like chưa
    const [existingLike] = await db.query(
        `
        SELECT userid
        FROM likes
        WHERE userid = ?
        AND noteid = ?
        `,
        [
            userid,
            noteid
        ]
    );


    if (existingLike.length > 0) {
        throw new Error(
            'You already liked this note'
        );
    }


    // Like
    const [result] = await db.query(
        `
        INSERT INTO likes
        (userid, noteid)
        VALUES (?, ?)
        `,
        [
            userid,
            noteid
        ]
    );


    return {
        message: 'Like successfully',
        userid,
        noteid
    };
};


// ========================================
// UNLIKE
// ========================================

const unlikes = async ({ userid, noteid }) => {

    // Kiểm tra quyền xem note
    const canAccess = await checkNotePermission({
        userid,
        noteid
    });

    if (!canAccess) {
        throw new Error(
            'You do not have permission to unlike this note'
        );
    }


    // Unlike
    const [result] = await db.query(
        `
        DELETE FROM likes
        WHERE noteid = ?
        AND userid = ?
        `,
        [
            noteid,
            userid
        ]
    );


    if (result.affectedRows === 0) {
        throw new Error(
            'Like not found'
        );
    }


    return {
        message: 'Unlike successfully',
        userid,
        noteid
    };
};


module.exports = {
    likes,
    unlikes
};