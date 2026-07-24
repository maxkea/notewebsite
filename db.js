const mysql = require('mysql2/promise');
require('dotenv').config();

// ===============================================
// CREATE CONNECTION POOL
// ===============================================

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'notes_app',
    port: Number(process.env.DB_PORT) || 3306,

    // Connection pool settings
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    // Keep connection alive
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,

    // Timeout
    connectTimeout: 10000
});

//test connection
const testConnection = async () => {
    try {
        const connection = await pool.getConnection();

        console.log('✅ MySQL connected');

        connection.release();
    } catch (error) {
        console.error('❌ MySQL connection error:', error.message);
    }
};

testConnection();

// ===============================================
// EXPORT POOL
// ===============================================

module.exports = pool;