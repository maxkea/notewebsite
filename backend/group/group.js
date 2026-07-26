const db = require('../db');
const { AppError } = require('../error/error');

// ========================================
// CREATE GROUP
// ========================================

const createGroup = async ({ userid, groupname }) => {
    if (!groupname) {
        throw new AppError("Group name is required", 400);
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // Create group
        const [result] = await connection.query(
            `
            INSERT INTO user_groups
            (userid, groupname)
            VALUES (?, ?)
            `,
            [
                userid,
                groupname
            ]
        );

        const groupid = result.insertId;

        // Add owner to group_members
        await connection.query(
            `
            INSERT INTO group_members
            (groupid, userid)
            VALUES (?, ?)
            `,
            [
                groupid,
                userid
            ]
        );

        await connection.commit();

        return {
            groupid,
            userid,
            groupname
        };

    } catch (error) {
        await connection.rollback();
        // Nếu đã là AppError thì throw tiếp, ngược lại bắn 500
        if (error instanceof AppError) throw error;
        throw new AppError(error.message || "Failed to create group", 500);

    } finally {
        connection.release();
    }
};


// ========================================
// DELETE GROUP
// ========================================

const deleteGroup = async ({ groupid, userid }) => {

    // Check user is owner
    const [groups] = await db.query(
        `
        SELECT groupid
        FROM user_groups
        WHERE groupid = ?
        AND userid = ?
        `,
        [
            groupid,
            userid
        ]
    );

    if (groups.length === 0) {
        // 403 Forbidden: Không phải chủ sở hữu hoặc group không tồn tại
        throw new AppError('Group not found or you are not the owner', 403);
    }

    // Delete group
    const [result] = await db.query(
        `
        DELETE FROM user_groups
        WHERE groupid = ?
        AND userid = ?
        `,
        [
            groupid,
            userid
        ]
    );

    if (result.affectedRows === 0) {
        throw new AppError('Failed to delete group', 500);
    }

    return {
        message: 'Group deleted successfully',
        groupid
    };
};


// ========================================
// ADD MEMBER
// ========================================

const addMember = async ({
    groupid,
    ownerid,
    userid
}) => {

    // Check owner
    const [groups] = await db.query(
        `
        SELECT groupid
        FROM user_groups
        WHERE groupid = ?
        AND userid = ?
        `,
        [
            groupid,
            ownerid
        ]
    );

    if (groups.length === 0) {
        // 403 Forbidden: Chỉ chủ nhóm mới được thêm thành viên
        throw new AppError('You are not the owner of this group', 403);
    }

    // Check user exists
    const [users] = await db.query(
        `
        SELECT userid
        FROM users
        WHERE userid = ?
        `,
        [
            userid
        ]
    );

    if (users.length === 0) {
        // 404 Not Found: Không tìm thấy người dùng muốn thêm
        throw new AppError('User not found', 404);
    }

    // Check user already member
    const [members] = await db.query(
        `
        SELECT userid
        FROM group_members
        WHERE groupid = ?
        AND userid = ?
        `,
        [
            groupid,
            userid
        ]
    );

    if (members.length > 0) {
        // 409 Conflict: Thành viên đã có trong nhóm từ trước
        throw new AppError('User is already a member of this group', 409);
    }

    // Add member
    const query = `
        INSERT INTO group_members (groupid, userid)
        VALUES (?, ?)
    `;

    try {
        await db.query(query, [
            groupid,
            userid
        ]);

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            throw new AppError("User already exists in group", 409);
        }
        throw new AppError(error.message || "Failed to add member", 500);
    }

    return {
        message: 'Member added successfully',
        groupid,
        userid
    };
};


// ========================================
// REMOVE MEMBER
// ========================================

const removeMember = async ({
    groupid,
    ownerid,
    userid
}) => {

    // Check owner
    const [groups] = await db.query(
        `
        SELECT groupid
        FROM user_groups
        WHERE groupid = ?
        AND userid = ?
        `,
        [
            groupid,
            ownerid
        ]
    );

    if (groups.length === 0) {
        throw new AppError('You are not the owner of this group', 403);
    }

    // Owner cannot remove himself
    if (Number(ownerid) === Number(userid)) {
        // 400 Bad Request: Hành động không hợp lệ
        throw new AppError('Group owner cannot be removed from the group', 400);
    }

    // Remove member
    const [result] = await db.query(
        `
        DELETE FROM group_members
        WHERE groupid = ?
        AND userid = ?
        `,
        [
            groupid,
            userid
        ]
    );

    if (result.affectedRows === 0) {
        // 404 Not Found: Người dùng không nằm trong nhóm
        throw new AppError('User is not a member of this group', 404);
    }

    return {
        message: 'Member removed successfully',
        groupid,
        userid
    };
};


// ========================================
// CHANGE GROUP OWNER
// ========================================

const changeGroupOwner = async ({
    groupid,
    ownerid,
    newOwnerid
}) => {

    // Check current owner
    const [groups] = await db.query(
        `
        SELECT groupid
        FROM user_groups
        WHERE groupid = ?
        AND userid = ?
        `,
        [
            groupid,
            ownerid
        ]
    );

    if (groups.length === 0) {
        throw new AppError('You are not the owner of this group', 403);
    }

    // Cannot transfer ownership to yourself
    if (Number(ownerid) === Number(newOwnerid)) {
        throw new AppError('You are already the owner of this group', 400);
    }

    // Check new owner is a member
    const [members] = await db.query(
        `
        SELECT userid
        FROM group_members
        WHERE groupid = ?
        AND userid = ?
        `,
        [
            groupid,
            newOwnerid
        ]
    );

    if (members.length === 0) {
        // 400 Bad Request: Điều kiện chuyển quyền sở hữu chưa đạt
        throw new AppError('New owner must be a member of the group', 400);
    }

    // Change owner
    const [result] = await db.query(
        `
        UPDATE user_groups
        SET userid = ?
        WHERE groupid = ?
        AND userid = ?
        `,
        [
            newOwnerid,
            groupid,
            ownerid
        ]
    );

    if (result.affectedRows === 0) {
        throw new AppError('Failed to change group owner', 500);
    }

    return {
        message: 'Group owner changed successfully',
        groupid,
        ownerid: newOwnerid
    };
};


// ========================================
// VIEW MEMBERS IN GROUP 
// ========================================

const viewGroupMembers = async ({ groupid, userid }) => {

    // Kiểm tra người dùng có phải thành viên của group không
    const [memberCheck] = await db.query(
        `
        SELECT userid
        FROM group_members
        WHERE groupid = ?
        AND userid = ?
        `,
        [
            groupid,
            userid
        ]
    );

    if (memberCheck.length === 0) {
        // 403 Forbidden: Không phải thành viên thì không được xem danh sách
        throw new AppError('You are not a member of this group', 403);
    }

    // Lấy danh sách thành viên trong group
    const [members] = await db.query(
        `
        SELECT
            u.userid,
            u.nickname,
            u.bio,
            gm.joined_at
        FROM group_members gm
        JOIN users u
            ON gm.userid = u.userid
        WHERE gm.groupid = ?
        ORDER BY gm.joined_at ASC
        `,
        [groupid]
    );

    return {
        groupid,
        members
    };
};


// ========================================
// VIEW GROUP USER JOINED
// ========================================

const viewGroup = async ({ userid }) => {

    const query = `
        SELECT
            ug.groupid,
            ug.groupname,
            ug.userid AS ownerid,
            u.nickname AS ownerNickname,
            gm.joined_at
        FROM group_members gm

        JOIN user_groups ug
            ON gm.groupid = ug.groupid

        JOIN users u
            ON ug.userid = u.userid

        WHERE gm.userid = ?

        ORDER BY ug.created_at DESC
    `;

    const [groups] = await db.query(query, [userid]);

    return groups;
};


// ========================================
// LEAVE GROUP 
// ========================================

const leaveGroup = async ({ groupid, userid }) => {

    // Check if group exists
    const [groups] = await db.query(
        `
        SELECT groupid, userid AS ownerid
        FROM user_groups
        WHERE groupid = ?
        `,
        [groupid]
    );

    if (groups.length === 0) {
        throw new AppError('Group not found', 404);
    }

    const ownerid = groups[0].ownerid;

    // Owner cannot leave directly
    if (Number(ownerid) === Number(userid)) {
        throw new AppError('Group owner cannot leave. Transfer ownership first.', 400);
    }

    // Remove current user from group
    const [result] = await db.query(
        `
        DELETE FROM group_members
        WHERE groupid = ?
        AND userid = ?
        `,
        [
            groupid,
            userid
        ]
    );

    if (result.affectedRows === 0) {
        throw new AppError('You are not a member of this group', 404);
    }

    return {
        message: 'You left the group successfully',
        groupid
    };
};


// ========================================
// EXPORT
// ========================================

module.exports = {
    createGroup,
    deleteGroup,
    addMember,
    removeMember,
    changeGroupOwner,
    viewGroupMembers,
    viewGroup,
    leaveGroup
};