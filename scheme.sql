-- ===============================================
-- DATABASE SCHEMA FOR NOTES SHARING APP
-- ===============================================
 
-- Create Database
CREATE DATABASE IF NOT EXISTS notes_app;
USE notes_app;
 
-- ===============================================
-- 1. USERS TABLE
-- ===============================================
CREATE TABLE users (
    userid INT AUTO_INCREMENT PRIMARY KEY,
    nickname VARCHAR(10) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    bio VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_userid (userid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
-- ===============================================
-- 2. user_groups TABLE
-- ===============================================
CREATE TABLE user_groups (
    groupid INT AUTO_INCREMENT PRIMARY KEY,
    userid INT NOT NULL,
    groupname VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (userid) REFERENCES users(userid) ON DELETE CASCADE,
    INDEX idx_userid (userid),
    INDEX idx_groupid (groupid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
-- ===============================================
-- 3. GROUP_MEMBERS TABLE
-- ===============================================
CREATE TABLE group_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    groupid INT NOT NULL,
    userid INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (groupid) REFERENCES user_groups(groupid) ON DELETE CASCADE,
    FOREIGN KEY (userid) REFERENCES users(userid) ON DELETE CASCADE,
    
    UNIQUE KEY unique_group_member (groupid, userid),
    INDEX idx_groupid (groupid),
    INDEX idx_userid (userid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
-- ===============================================
-- 4. NOTES TABLE
-- ===============================================
CREATE TABLE notes (
    noteid INT AUTO_INCREMENT PRIMARY KEY,
    userid INT NOT NULL,
    mode ENUM('public', 'private', 'group') NOT NULL DEFAULT 'private',
    groupid INT,
    text VARCHAR(300) NOT NULL,
    time_create TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_end TIMESTAMP NOT NULL,
    
    FOREIGN KEY (userid) REFERENCES users(userid) ON DELETE CASCADE,
    FOREIGN KEY (groupid) REFERENCES user_groups(groupid) ON DELETE SET NULL,
    
    INDEX idx_userid (userid),
    INDEX idx_noteid (noteid),
    INDEX idx_mode (mode),
    INDEX idx_groupid (groupid),
    INDEX idx_time_end (time_end),
    INDEX idx_user_mode (userid, mode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
-- ===============================================
-- 5. COMMENTS TABLE
-- ===============================================
CREATE TABLE comments (
    commentid INT AUTO_INCREMENT PRIMARY KEY,
    noteid INT NOT NULL,
    userid INT NOT NULL,
    comment VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (noteid) REFERENCES notes(noteid) ON DELETE CASCADE,
    FOREIGN KEY (userid) REFERENCES users(userid) ON DELETE CASCADE,
    
    INDEX idx_noteid (noteid),
    INDEX idx_userid (userid),
    INDEX idx_commentid (commentid),
    INDEX idx_note_user (noteid, userid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
-- ===============================================
-- 6. LIKES TABLE
-- ===============================================
CREATE TABLE likes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userid INT NOT NULL,
    noteid INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (userid) REFERENCES users(userid) ON DELETE CASCADE,
    FOREIGN KEY (noteid) REFERENCES notes(noteid) ON DELETE CASCADE,
    
    UNIQUE KEY unique_like (userid, noteid),
    INDEX idx_userid (userid),
    INDEX idx_noteid (noteid),
    INDEX idx_note_likes (noteid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
-- ===============================================
-- INDEXES FOR PERFORMANCE
-- ===============================================
 
-- For receiveNotes query optimization
ALTER TABLE notes ADD INDEX idx_mode_time_end (mode, time_end);
ALTER TABLE notes ADD INDEX idx_user_time_end (userid, mode, time_end);
 
-- For comment/like queries
ALTER TABLE comments ADD INDEX idx_noteid_sort (noteid, created_at);