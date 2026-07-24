const db = require('../db');
const xss = require('xss');

const writeNote = async ({
    userid,
    mode,
    groupid,
    text,
    customHours
}) => {
    const [users] = await db.query(
        'SELECT userid FROM users WHERE userid = ?',
        [userid]
    );
    if (users.length === 0) {
        throw new Error("User not found");
    }

    if (!text || text.trim() === '') {
        throw new Error("Note text cannot be empty");
    }

    const sanitizedText = xss(text.trim(), {
        whiteList: {},
        stripIgnoredTag: true
    });

    if (sanitizedText.length > 300) {
        throw new Error("Note text cannot exceed 300 characters");
    }
    // Check mode
    const validModes = ['public', 'private', 'group'];

    if (!validModes.includes(mode)) {
        throw new Error(
            "Mode must be public, private, or group"
        );
    }

    // Only group mode can have groupid
    if (mode === 'group') {
        if (!groupid) {
            throw new Error(
                "groupid is required for group mode"
            );
        }

        // Check user is a member of group
        const [members] = await db.query(
            `
            SELECT 1
            FROM group_members
            WHERE groupid = ?
              AND userid = ?
            LIMIT 1
            `,
            [groupid, userid]
        );

        if (members.length === 0) {
            throw new Error(
                "You are not a member of this group"
            );
        }
    }

    // public and private don't need groupid
    const finalGroupId = mode === 'group'
        ? groupid
        : null;


    // Valid custom hours: 1 - 24
    const validHours = Math.min(
        24,
        Math.max(
            1,
            parseInt(customHours, 10) || 24
        )
    );


    const query = `
        INSERT INTO notes
        (
            userid,
            mode,
            groupid,
            text,
            time_create,
            time_end
        )
        VALUES (
            ?, ?, ?, ?, NOW(),
            DATE_ADD(NOW(), INTERVAL ? HOUR)
        )
    `;


    const values = [
        userid,
        mode,
        finalGroupId,
        sanitizedText,
        validHours
    ];


    const [result] = await db.query(
        query,
        values
    );


    return result.insertId;
};

const updateNote = async ({ noteid, userid, text, mode, groupid }) => {

    if (!text || text.trim() === '') {
        throw new Error("Note text cannot be empty");
    }

    const sanitizedText = xss(text.trim(), {
        whiteList: {},
        stripIgnoredTag: true
    });

    if (sanitizedText.length > 300) {
        throw new Error("Note text cannot exceed 300 characters");
    }
    const validModes = ['public', 'private', 'group'];

    if (!validModes.includes(mode)) {
        throw new Error(
            "Mode must be public, private, or group"
        );
    }

    // Only group mode can have groupid
    if (mode === 'group') {
        if (!groupid) {
            throw new Error(
                "groupid is required for group mode"
            );
        }

        // Check user is a member of group
        const [members] = await db.query(
            `
            SELECT 1
            FROM group_members
            WHERE groupid = ?
              AND userid = ?
            LIMIT 1
            `,
            [groupid, userid]
        );

        if (members.length === 0) {
            throw new Error(
                "You are not a member of this group"
            );
        }
    }

    // public and private don't need groupid
    const finalGroupId = mode === 'group'
        ? groupid
        : null;
    const query = `
        UPDATE notes
        SET
            text = COALESCE(?, text),
            mode = COALESCE(?, mode),
            groupid = COALESCE(?, groupid)
        WHERE noteid = ? AND userid = ?;
    `;

    const values = [sanitizedText, mode, groupid, noteid, userid];

    const [result] = await db.query(query, values);

    if (result.affectedRows === 0) {
        throw new Error("Note not found or unauthorized");
    }

    // Get the updated row
    const [rows] = await db.query(
        "SELECT * FROM notes WHERE noteid = ?",
        [noteid]
    );

    return rows[0];
};


const deleteNote = async (noteId, userid) => {

    const [result] = await db.query(
        "DELETE FROM notes WHERE noteid = ? AND userid = ?;",
        [noteId, userid]
    );

    if (result.affectedRows === 0) {
        throw new Error("Note not found or unauthorized");
    }

    return {
        message: "Note deleted successfully",
        id: noteId
    };
};

const receiveNotes = async ({ userid }) => {

    // ========================================
    // 1. Lấy private notes của chính user
    // ========================================

    const privateQuery = `
        SELECT
            n.noteid,
            n.userid,
            u.nickname,
            n.mode,
            n.groupid,
            n.text,
            n.time_create,
            n.time_end
        FROM notes n
        JOIN users u
            ON n.userid = u.userid
        WHERE n.mode = 'private'
        AND n.userid = ?
        AND n.time_end > NOW()
    `;

    const [privateNotes] = await db.query(
        privateQuery,
        [userid]
    );


    // ========================================
    // 2. Lấy public notes
    // ========================================

    const publicQuery = `
        SELECT
            n.noteid,
            n.userid,
            u.nickname,
            n.mode,
            n.groupid,
            n.text,
            n.time_create,
            n.time_end
        FROM notes n
        JOIN users u
            ON n.userid = u.userid
        WHERE n.mode = 'public'
        AND n.time_end > NOW()
    `;

    const [publicNotes] = await db.query(
        publicQuery
    );


    // ========================================
    // 3. Lấy group mà user đang tham gia
    // ========================================

    const groupQuery = `
        SELECT groupid
        FROM group_members
        WHERE userid = ?
    `;

    const [groups] = await db.query(
        groupQuery,
        [userid]
    );


    // Lấy groupid
    const groupIds = groups.map(
        group => group.groupid
    );


    let groupNotes = [];


    // User có tham gia group
    if (groupIds.length > 0) {

        const placeholders = groupIds
            .map(() => '?')
            .join(',');


        // ========================================
        // 4. Lấy notes của các group
        // ========================================

        const groupNotesQuery = `
            SELECT
                n.noteid,
                n.userid,
                u.nickname,
                n.mode,
                n.groupid,
                n.text,
                n.time_create,
                n.time_end
            FROM notes n
            JOIN users u
                ON n.userid = u.userid
            WHERE n.mode = 'group'
            AND n.groupid IN (${placeholders})
            AND n.time_end > NOW()
        `;

        const [result] = await db.query(
            groupNotesQuery,
            groupIds
        );

        groupNotes = result;
    }


    // ========================================
    // 5. Gộp tất cả notes
    // ========================================

    const notes = [
        ...privateNotes,
        ...publicNotes,
        ...groupNotes
    ];


    // Không có note
    if (notes.length === 0) {
        return [];
    }


    // ========================================
    // 6. Sắp xếp note mới nhất trước
    // ========================================

    notes.sort(
        (a, b) =>
            new Date(b.time_create) -
            new Date(a.time_create)
    );


    // Lấy tất cả noteid
    const noteIds = notes.map(
        note => note.noteid
    );


    // ========================================
    // 7. Lấy số lượng like
    // ========================================

    const placeholders = noteIds
        .map(() => '?')
        .join(',');


    const likesQuery = `
        SELECT
            noteid,
            COUNT(*) AS likeCount
        FROM likes
        WHERE noteid IN (${placeholders})
        GROUP BY noteid
    `;

    const [likes] = await db.query(
        likesQuery,
        noteIds
    );


    // ========================================
    // 8. Lấy comments
    // ========================================

    const commentsQuery = `
        SELECT
            c.commentid,
            c.noteid,
            c.userid,
            u.nickname,
            c.comment
        FROM comments c
        JOIN users u
            ON c.userid = u.userid
        WHERE c.noteid IN (${placeholders})
        ORDER BY c.commentid ASC
    `;

    const [comments] = await db.query(
        commentsQuery,
        noteIds
    );


    // ========================================
    // 9. Tạo map like
    // ========================================

    const likeMap = {};

    likes.forEach(like => {
        likeMap[like.noteid] =
            Number(like.likeCount);
    });


    // ========================================
    // 10. Tạo map comments
    // ========================================

    const commentMap = {};

    comments.forEach(comment => {

        if (!commentMap[comment.noteid]) {
            commentMap[comment.noteid] = [];
        }

        commentMap[comment.noteid].push({
            commentid: comment.commentid,
            userid: comment.userid,
            nickname: comment.nickname,
            comment: comment.comment
        });
    });


    // ========================================
    // 11. Gộp notes + likes + comments
    // ========================================

    const result = notes.map(note => {

        return {
            ...note,

            likeCount:
                likeMap[note.noteid] || 0,

            comments:
                commentMap[note.noteid] || []
        };

    });


    return result;
};

module.exports = {
    writeNote,
    updateNote,
    deleteNote,
    receiveNotes
};