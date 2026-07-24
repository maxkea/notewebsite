const db = require('../db');

const checkNotePermission = async ({ userid, noteid }) => {

    // 1. Kiểm tra note có tồn tại và chưa hết hạn
    const [notes] = await db.query(
        `
        SELECT
            noteid,
            userid,
            mode,
            groupid,
            time_end
        FROM notes
        WHERE noteid = ?
        AND time_end > NOW()
        `,
        [noteid]
    );

    if (notes.length === 0) {
        return false;
    }

    const note = notes[0];


    // 2. Public
    // Ai cũng được xem
    if (note.mode === 'public') {
        return true;
    }


    // 3. Private
    // Chỉ chủ note
    if (note.mode === 'private') {

        return Number(note.userid) === Number(userid);

    }


    // 4. Group
    // User phải là thành viên group
    if (note.mode === 'group') {

        const [members] = await db.query(
            `
            SELECT userid
            FROM group_members
            WHERE groupid = ?
            AND userid = ?
            `,
            [
                note.groupid,
                userid
            ]
        );

        return members.length > 0;
    }


    // Mode không hợp lệ
    return false;
};


module.exports = {
    checkNotePermission
};