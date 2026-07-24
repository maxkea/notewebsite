const db = require('../db');


// ========================================
// CREATE GROUP
// ========================================

const createGroup = async ({ userid, groupname }) => {

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

        throw error;

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
        throw new Error(
            'Group not found or you are not the owner'
        );
    }


    // Delete group
    // group_members will be deleted automatically
    // if FOREIGN KEY uses ON DELETE CASCADE
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
        throw new Error(
            'Failed to delete group'
        );
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
        throw new Error(
            'You are not the owner of this group'
        );
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
        throw new Error(
            'User not found'
        );
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
        throw new Error(
            'User is already a member of this group'
        );
    }


    // Add member
    const query = `
        INSERT INTO group_members (groupid, userid)
        VALUES (?, ?)
    `;

    try {
        const [result] = await db.query(query, [
            groupid,
            userid
        ]);

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            throw new Error("User exist in group");
        }

        throw error;
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
        throw new Error(
            'You are not the owner of this group'
        );
    }


    // Owner cannot remove himself
    if (Number(ownerid) === Number(userid)) {
        throw new Error(
            'Group owner cannot be removed from the group'
        );
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
        throw new Error(
            'User is not a member of this group'
        );
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
        throw new Error(
            'You are not the owner of this group'
        );
    }


    // Cannot transfer ownership to yourself
    if (Number(ownerid) === Number(newOwnerid)) {
        throw new Error(
            'You are already the owner of this group'
        );
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
        throw new Error(
            'New owner must be a member of the group'
        );
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
        throw new Error(
            'Failed to change group owner'
        );
    }


    return {
        message: 'Group owner changed successfully',
        groupid,
        ownerid: newOwnerid
    };
};

//wiew members in group 

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
        throw new Error(
            'You are not a member of this group'
        );
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

//wiew group user joined

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

// leave group 

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
        throw new Error('Group not found');
    }

    const ownerid = groups[0].ownerid;

    // Owner cannot leave directly
    if (Number(ownerid) === Number(userid)) {
        throw new Error(
            'Group owner cannot leave. Transfer ownership first.'
        );
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
        throw new Error(
            'You are not a member of this group'
        );
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


