const db = require('../db');
const xss = require('xss');
const { AppError } = require('../error/error');

const {
    checkNotePermission
} = require('./notePermission');


// ========================================
// ADD COMMENT
// ========================================

const comment = async ({
    noteid,
    userid,
    comment
}) => {

    // Kiểm tra user có quyền xem note không
    const canAccess = await checkNotePermission({
        userid,
        noteid
    });

    if (!canAccess) {
        // 403 Forbidden: Không có quyền truy cập/bình luận vào ghi chú này
        throw new AppError(
            'You do not have permission to comment on this note',
            403
        );
    }


    // Kiểm tra comment rỗng
    if (!comment || comment.trim() === '') {
        // 400 Bad Request: Dữ liệu đầu vào không hợp lệ
        throw new AppError(
            'Comment cannot be empty',
            400
        );
    }

    const sanitizedComment = xss(comment.trim(), {
        whiteList: {}, // Không cho phép HTML tag
        stripIgnoredTag: true
    });

    if (sanitizedComment.length > 100) {
        // 400 Bad Request: Bình luận vượt quá độ dài quy định
        throw new AppError("Comment too long", 400);
    }

    // Thêm comment
    const query = `
        INSERT INTO comments
        (noteid, userid, comment)
        VALUES (?, ?, ?)
    `;

    const [result] = await db.query(
        query,
        [
            noteid,
            userid,
            sanitizedComment
        ]
    );

    if (result.affectedRows === 0) {
        // 500 Internal Server Error: Lỗi cơ sở dữ liệu khi tạo bình luận
        throw new AppError("Failed to add comment", 500);
    }


    return {
        commentid: result.insertId,
        noteid,
        userid,
        comment: sanitizedComment
    };
};


// ========================================
// DELETE COMMENT
// ========================================

const deleteComment = async ({
    commentid,
    userid
}) => {

    const query = `
        DELETE FROM comments
        WHERE commentid = ?
        AND userid = ?
    `;

    const [result] = await db.query(
        query,
        [
            commentid,
            userid
        ]
    );


    if (result.affectedRows === 0) {
        // 404 Not Found / 403 Forbidden: Không tìm thấy comment hoặc người xóa không phải chính chủ
        throw new AppError(
            'Comment not found or unauthorized',
            404
        );
    }


    return {
        message: 'Comment deleted successfully',
        commentid
    };
};


module.exports = {
    comment,
    deleteComment
};