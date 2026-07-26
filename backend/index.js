require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const logger = require('./logger');
const requestLogger = require('./middlewave/requestLogger');
const { AppError } = require('./error/error')

const app = express();

// Trust Nginx proxy
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"],
                frameAncestors: ["'none'"]
            }
        }
    })
);

app.use(requestLogger);

app.use(express.json());


// ==========================
// Import Middleware
// ==========================

const authMiddleware = require('./middlewave/authMiddleware');


// ==========================
// Import Auth Functions
// ==========================

const {
    register,
    login
} = require('./aut/aut_regis');

const {
    changeEmail,
    changePassword
} = require('./aut/changeinfo');


// ==========================
// Import Note Functions
// ==========================

const {
    writeNote,
    updateNote,
    deleteNote,
    receiveNotes
} = require('./note/note');

// ==========================
// Import comment, like function
// ==========================
const {comment,deleteComment} = require('./note/comment');

const {likes,unlikes} =require('./note/likes');

// ==========================
// Import Profile Functions
// ==========================

const {
    viewProfile,
    updateProfile
} = require('./profile/userprofile');

// import jobs
const {
    deleteExpiredNotes
} = require('./jobs/deleteExpiredNotes');

// ==========================
// import GROUP ROUTES
// ==========================

const {
    createGroup,
    deleteGroup,
    addMember,
    removeMember,
    changeGroupOwner,
    viewGroupMembers,
    viewGroup,
    leaveGroup
} = require('./group/group');



// ==========================
// AUTH ROUTES
// ==========================

// Register
app.post('/register', async (req, res, next) => {
    try {
        const result = await register(req.body); //nickname, email, password

        res.status(201).json(result);

    } catch (error) {
        next(error);
    }
});


// Login
app.post('/login', async (req, res, next) => {
    try {
        const result = await login(req.body); // email, password

        res.status(200).json(result);

    } catch (error) {
        next(error);
    }
});


// ==========================
// USER ROUTES
// ==========================

// Change Email
app.put('/users/email', authMiddleware, async (req, res, next) => {
    try {

        // userid lấy từ JWT
        const userid = req.user.userid;

        const {
            newEmail,
            password
        } = req.body;

        const result = await changeEmail({
            userid,
            newEmail,
            password
        }); // userid, newEmail, password

        res.status(200).json(result);

    } catch (error) {
        next(error);
    }
});


// Change Password
app.put('/users/password', authMiddleware, async (req, res, next) => {
    try {

        // userid lấy từ JWT
        const userid = req.user.userid;

        const {
            currentPassword,
            newPassword
        } = req.body;

        const result = await changePassword({
            userid,
            currentPassword,
            newPassword
        });

        res.status(200).json(result);

    } catch (error) {
        next(error);
    }
});


// ==========================
// NOTE ROUTES
// ==========================

// Create Note
app.post('/notes', authMiddleware, async (req, res, next) => {
    try {

        // Không lấy userid từ client
        const userid = req.user.userid;

        const {
            mode,
            groupid,
            text,
            customHours
        } = req.body;

        const noteid = await writeNote({
            userid,
            mode,
            groupid,
            text,
            customHours
        });

        res.status(201).json({
            message: 'Note created successfully',
            noteid
        });

    } catch (error) {
        next(error);
    }
});


// Receive Note
app.get('/notes', authMiddleware, async (req, res, next) => {
    try {

        const userid = req.user.userid;
        const result = await receiveNotes({
            userid
        });

        res.status(200).json(result);

    } catch (error) {
        next(error);
    }
});


// Update Note
app.put('/notes/:noteid', authMiddleware, async (req, res, next) => {
    try {

        const userid = req.user.userid;
        const noteid = req.params.noteid;

        const {
            text,
            mode,
            groupid
        } = req.body;

        const result = await updateNote({
            noteid,
            userid,
            text,
            mode,
            groupid
        });//noteid, userid, text, mode, groupid

        res.status(200).json(result);

    } catch (error) {
        next(error);
    }
});


// Delete Note
app.delete('/notes/:noteid', authMiddleware, async (req, res, next) => {
    try {

        const userid = req.user.userid;
        const noteid = req.params.noteid;

        const result = await deleteNote(
            noteid,
            userid
        );

        res.status(200).json(result);

    } catch (error) {
        next(error);
    }
});

// ==========================
// COMMENT & LIKE ROUTES
// ==========================

// Add Comment
app.post('/notes/:noteid/comments', authMiddleware, async (req, res, next) => {
    try {

        // userid lấy từ JWT
        const userid = req.user.userid;

        // noteid lấy từ URL
        const noteid = req.params.noteid;

        const {
            comment: commentText
        } = req.body;

        const result = await comment({
            userid,
            noteid,
            comment: commentText
        });

        res.status(201).json({
            message: 'Comment added successfully',
            result
        });

    } catch (error) {
        next(error);
    }
});


// Like Note
app.post('/notes/:noteid/like', authMiddleware, async (req, res, next ) => {
    try {

        // userid lấy từ JWT
        const userid = req.user.userid;

        // noteid lấy từ URL
        const noteid = req.params.noteid;

        const result = await likes({
            userid,
            noteid
        });

        res.status(201).json({
            message: 'Note liked successfully',
            result
        });

    } catch (error) {
       next(error);
    }
});

// Delete Comment
app.delete('/notes/comments/:commentid', authMiddleware, async (req, res, next) => {
    try {

        // userid lấy từ JWT
        const userid = req.user.userid;

        const commentid = req.params.commentid;

        const result = await deleteComment({
            userid,
            commentid
        });

        res.status(200).json({
            message: 'Comment deleted successfully',
            result
        });

    } catch (error) {
        next(error);
    }
});


// Unlike Note
app.delete('/notes/:noteid/like', authMiddleware, async (req, res, next) => {
    try {

        // userid lấy từ JWT
        const userid = req.user.userid;

        // noteid lấy từ URL
        const noteid = req.params.noteid;

        const result = await unlikes({
            userid,
            noteid
        });

        res.status(200).json({
            message: 'Note unliked successfully',
            result
        });

    } catch (error) {
       next(error);
    }
});


// ==========================
// PROFILE ROUTES
// ==========================

// View Profile
app.get('/profile/:userid', async (req, res, next) => {
    try {

        const userid = req.params.userid;

        const result = await viewProfile({
            userid
        });

        res.status(200).json(result);

    } catch (error) {
        next(error);
    }
});


// Change Bio, nickname
app.put('/profile', authMiddleware, async (req, res, next) => {
    try {

        const userid = req.user.userid;
        const {
            nickname,
            bio
        } = req.body;

        const result = await updateProfile({
            userid,
            nickname,
            bio
        });

        res.status(200).json(result);

    } catch (error) {
        next(error);
    }
});

//===========
//group
//============

// Create Group
app.post('/groups', authMiddleware, async (req, res, next) => {
    try {
        const userid = req.user.userid;
        const { groupname } = req.body;

        const result = await createGroup({
            userid,
            groupname
        });

        res.status(201).json(result);

    } catch (error) {
       next(error);
    }
});


// Delete Group
app.delete('/groups/:groupid', authMiddleware, async (req, res, next) => {
    try {
        const userid = req.user.userid;
        const groupid = req.params.groupid;

        const result = await deleteGroup({
            groupid,
            userid
        });

        res.status(200).json(result);

    } catch (error) {
       next(error);
    }
});


// Add Member
app.post('/groups/:groupid/members', authMiddleware, async (req, res, next) => {
    try {
        const ownerid = req.user.userid;
        const groupid = req.params.groupid;

        const { userid } = req.body;

        const result = await addMember({
            groupid,
            ownerid,
            userid
        });

        res.status(201).json(result);

    } catch (error) {
        next(error);
    }
});


// Remove Member
app.delete('/groups/:groupid/members/:userid', authMiddleware, async (req, res, next) => {
    try {
        const ownerid = req.user.userid;
        const groupid = req.params.groupid;
        const userid = req.params.userid;

        const result = await removeMember({
            groupid,
            ownerid,
            userid
        });

        res.status(200).json(result);

    } catch (error) {
        next(error);
    }
});


// Change Group Owner
app.put('/groups/:groupid/owner', authMiddleware, async (req, res, next) => {
    try {
        const ownerid = req.user.userid;
        const groupid = req.params.groupid;

        const {
            newOwnerid
        } = req.body;

        const result = await changeGroupOwner({
            groupid,
            ownerid,
            newOwnerid
        });

        res.status(200).json(result);

    } catch (error) {
        next(error);
    }
});

app.get('/groups/:groupid/members', authMiddleware, async (req, res, next) => {
    try {
        // Người đang đăng nhập lấy từ JWT
        const userid = req.user.userid;

        // Group muốn xem lấy từ URL
        const groupid = req.params.groupid;

        const result = await viewGroupMembers({
            groupid,
            userid
        });

        res.status(200).json(result);

    } catch (error) {
        next(error);
    }
});

//wiew group user joined

app.get('/groups', authMiddleware, async (req, res, next) => {
    try {
        const userid = req.user.userid;

        const result = await viewGroup({
            userid
        });

        res.status(200).json(result);

    } catch (error) {
        next(error);
    }
});

// leave group 
app.delete(
    '/groups/:groupid/leave',
    authMiddleware,
    async (req, res, next) => {
        try {
            const userid = req.user.userid;
            const groupid = req.params.groupid;

            const result = await leaveGroup({
                groupid,
                userid
            });

            res.status(200).json(result);

        } catch (error) {
            next(error);
        }
    }
);

setInterval(
    deleteExpiredNotes,
    60 * 60 * 1000
);

app.use((err, req, res, next) => {
    const isOperational = err instanceof AppError;
    const statusCode = err.statusCode || 500;

    const level = isOperational ? 'warn' : 'error';

    logger[level]({
        request_id: req.requestId,
        err: {
            message: err.message,
            stack: err.stack,
        },
        method: req.method,
        path: req.originalUrl,
        status: statusCode,
    }, isOperational ? 'Handled application error' : 'Unexpected error');

    res.status(statusCode).json({ message: err.message });
});
// ==========================
// START SERVER
// ==========================

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});