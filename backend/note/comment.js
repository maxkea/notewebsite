const db = require('../db');
const xss = require('xss');

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
        throw new Error(
            'You do not have permission to comment on this note'
        );
    }


    // Kiểm tra comment rỗng
    if (!comment || comment.trim() === '') {
        throw new Error(
            'Comment cannot be empty'
        );
    }

     const sanitizedComment = xss(comment.trim(), {
        whiteList: {}, // Không cho phép HTML tag
        stripIgnoredTag: true
    });

    if (sanitizedComment.length > 100) {
        throw new Error("Comment too long");
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
        throw new Error(
            'Comment not found or unauthorized'
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