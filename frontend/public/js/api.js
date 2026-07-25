/* ==========================================================================
   api.js — single place all backend requests go through.
   Nothing else in this app should call fetch() directly.
   ========================================================================== */

const API_BASE = '/api';
const TOKEN_KEY = 'notes_app_token';

/* ---------------- token helpers ---------------- */

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

function isLoggedIn() {
    return !!getToken();
}

/* Send the user back to login and drop whatever token we had. */
function forceLogout() {
    clearToken();
    if (!location.pathname.endsWith('login.html')) {
        window.location.href = 'login.html';
    }
}

/* Call this at the top of any page that requires a session. */
function requireAuth() {
    if (!isLoggedIn()) {
        window.location.href = 'login.html';
    }
}

/* ---------------- core request wrapper ---------------- */

/**
 * @param {string} path        e.g. '/notes'
 * @param {object} options     { method, body, auth }
 *   auth defaults to true — pass auth:false for /login, /register, /profile/:id
 */
async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };

    if (auth) {
        const token = getToken();
        if (!token) {
            forceLogout();
            throw new Error('Not logged in');
        }
        headers['Authorization'] = `Bearer ${token}`;
    }

    let res;
    try {
        res = await fetch(`${API_BASE}${path}`, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined
        });
    } catch (networkErr) {
        throw new Error('Cannot reach the server. Is the backend running?');
    }

    // Expired / invalid token -> clear it and send user to login.
    if (res.status === 401 && auth) {
        forceLogout();
        throw new Error('Session expired. Please log in again.');
    }

    let data = null;
    const text = await res.text();
    if (text) {
        try {
            data = JSON.parse(text);
        } catch (e) {
            data = null;
        }
    }

    if (!res.ok) {
        const message = (data && data.message) ? data.message : `Request failed (${res.status})`;
        throw new Error(message);
    }

    return data;
}

/* ---------------- Auth ---------------- */

function apiRegister({ nickname, email, password }) {
    return apiRequest('/register', {
        method: 'POST',
        body: { nickname, email, password },
        auth: false
    });
}

function apiLogin({ email, password }) {
    return apiRequest('/login', {
        method: 'POST',
        body: { email, password },
        auth: false
    });
}

/* ---------------- User account ---------------- */

function apiChangeEmail({ newEmail, password }) {
    return apiRequest('/users/email', {
        method: 'PUT',
        body: { newEmail, password }
    });
}

function apiChangePassword({ currentPassword, newPassword }) {
    return apiRequest('/users/password', {
        method: 'PUT',
        body: { currentPassword, newPassword }
    });
}

/* ---------------- Notes ---------------- */

function apiGetNotes() {
    return apiRequest('/notes', { method: 'GET' });
}

function apiCreateNote({ mode, groupid, text, customHours }) {
    return apiRequest('/notes', {
        method: 'POST',
        body: { mode, groupid, text, customHours }
    });
}

function apiUpdateNote(noteid, { text, mode, groupid }) {
    return apiRequest(`/notes/${noteid}`, {
        method: 'PUT',
        body: { text, mode, groupid }
    });
}

function apiDeleteNote(noteid) {
    return apiRequest(`/notes/${noteid}`, { method: 'DELETE' });
}

/* ---------------- Comments & Likes ---------------- */

// TODO(backend): POST /notes/:noteid/comments responds with
// { message, result: { commentid, noteid, userid, comment } } — result has
// no `nickname` field (unlike the comments embedded in GET /notes). The
// caller falls back to "You" when rendering a freshly-posted comment.
function apiAddComment(noteid, comment) {
    return apiRequest(`/notes/${noteid}/comments`, {
        method: 'POST',
        body: { comment }
    });
}

function apiDeleteComment(commentid) {
    return apiRequest(`/notes/comments/${commentid}`, { method: 'DELETE' });
}

function apiLikeNote(noteid) {
    return apiRequest(`/notes/${noteid}/like`, { method: 'POST' });
}

function apiUnlikeNote(noteid) {
    return apiRequest(`/notes/${noteid}/like`, { method: 'DELETE' });
}

/* ---------------- Groups ---------------- */

function apiGetGroups() {
    return apiRequest('/groups', { method: 'GET' });
}

function apiCreateGroup(groupname) {
    return apiRequest('/groups', {
        method: 'POST',
        body: { groupname }
    });
}

function apiDeleteGroup(groupid) {
    return apiRequest(`/groups/${groupid}`, { method: 'DELETE' });
}

function apiGetGroupMembers(groupid) {
    return apiRequest(`/groups/${groupid}/members`, { method: 'GET' });
}

function apiAddMember(groupid, userid) {
    return apiRequest(`/groups/${groupid}/members`, {
        method: 'POST',
        body: { userid }
    });
}

function apiRemoveMember(groupid, userid) {
    return apiRequest(`/groups/${groupid}/members/${userid}`, { method: 'DELETE' });
}

function apiLeaveGroup(groupid){
    return apiRequest(`/groups/${groupid}/leave`, {method: 'DELETE'})
}

function apiChangeGroupOwner(groupid, newOwnerid) {
    return apiRequest(`/groups/${groupid}/owner`, {
        method: 'PUT',
        body: { newOwnerid }
    });
}

/* ---------------- Profile ---------------- */

function apiGetProfile(userid) {
    return apiRequest(`/profile/${userid}`, { method: 'GET', auth: false });
}

function apiUpdateProfile({ nickname, bio }) {
    return apiRequest('/profile', {
        method: 'PUT',
        body: { nickname, bio }
    });
}

/* ---------------- JWT payload read (client-side only, for display) ---------------- */

/* Decodes the payload of the stored JWT without verifying it — verification
   always happens server-side. Used only to show "logged in as" info and to
   know our own userid for things like "is this my group". */
function getCurrentUser() {
    const token = getToken();
    if (!token) return null;
    try {
        const payload = token.split('.')[1];
        const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
        return decoded; // { userid, email }
    } catch (e) {
        return null;
    }
}
