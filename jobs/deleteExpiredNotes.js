const db = require('../db');

const deleteExpiredNotes = async () => {
    try {
        const [result] = await db.query(`
            DELETE FROM notes
            WHERE time_end <= NOW()
        `);

        console.log(
            `[DeleteExpiredNotes] Deleted ${result.affectedRows} expired notes`
        );

    } catch (error) {
        console.error(
            '[DeleteExpiredNotes] Error:',
            error.message
        );
    }
};

module.exports = {
    deleteExpiredNotes
};