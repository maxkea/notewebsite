const db = require('../db');
const { AppError } = require('../error/error');

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
        // 403 Forbidden: Không có quyền tương tác với ghi chú này
        throw new AppError(
            'You do not have permission to like this note',
            403
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
        // 409 Conflict: Xung đột dữ liệu do đã like từ trước
        throw new AppError(
            'You already liked this note',
            409
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

    if (result.affectedRows === 0) {
        // 500 Internal Server Error: Thất bại khi ghi dữ liệu vào DB
        throw new AppError('Failed to like note', 500);
    }


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
        // 403 Forbidden: Không có quyền tương tác với ghi chú này
        throw new AppError(
            'You do not have permission to unlike this note',
            403
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
        // 404 Not Found: Chưa từng like ghi chú này nên không thể unlike
        throw new AppError(
            'Like not found',
            404
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