# Notes Sharing App — API

A REST API for a notes-sharing application. Users can register/login, post notes that are visible **publicly**, **privately**, or to a **group**, and interact via comments and likes. Notes automatically expire after a configurable number of hours.

Built with **Express**, **MySQL (mysql2/promise)**, **JWT** authentication, **bcryptjs** password hashing, **xss** input sanitization, and **helmet**/**cors** for HTTP security.

## Features

- Email/password authentication with JWT (1h expiry)
- Change email / change password (requires current password)
- Notes with `public`, `private`, or `group` visibility and custom expiry (1–24h), auto-purged hourly by a background job
- Comments and likes on notes, gated by note-visibility permission checks
- Groups: create/delete, add/remove members, transfer ownership, leave, list members, list joined groups
- User profile with nickname/bio, sanitized against XSS
- Security middleware: `helmet` CSP, `cors` allow-list, JWT bearer auth middleware

## Tech Stack

| Layer | Library |
|---|---|
| Server | Express |
| Database | MySQL via `mysql2/promise` (connection pool) |
| Auth | `jsonwebtoken`, `bcryptjs` |
| Sanitization | `xss` |
| Security headers / CORS | `helmet`, `cors` |
| Env config | `dotenv` |

## Project Structure

```
.
├── index.js                  # App entry point, route definitions
├── db.js                     # MySQL connection pool
├── scheme.sql                 # Database schema
├── aut/
│   ├── aut_regis.js          # register, login
│   ├── changeinfo.js         # changeEmail, changePassword
│   └── jwt.js                # provideToken, checkToken
├── middlewave/
│   └── authMiddleware.js     # JWT bearer auth guard
├── note/
│   ├── note.js                # writeNote, updateNote, deleteNote, receiveNotes
│   ├── notePermission.js      # checkNotePermission (visibility rules)
│   ├── comment.js             # comment, deleteComment
│   └── likes.js                # likes, unlikes
├── profile/
│   └── userprofile.js        # viewProfile, updateProfile
├── group/
│   └── group.js               # createGroup, deleteGroup, addMember, removeMember,
│                               # changeGroupOwner, viewGroupMembers, viewGroup, leaveGroup
└── jobs/
    └── deleteExpiredNotes.js  # Cron-style hourly cleanup of expired notes
```

> Note: folder names in `index.js` requires (`aut/`, `middlewave/`, `note/`, `profile/`, `group/`) should match your actual directory layout.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `_env.example` to `.env` and fill in the values:

```
JWT_SECRET=your-secret-key
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=notes_app
DB_PORT=3306
ALLOW_LIST=http://localhost:3000,http://localhost:5173,https://example.com
```

`ALLOW_LIST` is a comma-separated list of origins allowed by CORS (no spaces around commas). It is required — the server reads `process.env.ALLOW_LIST.split(',')` at startup and will throw if unset.

### 3. Create the database

Run the schema against your MySQL instance:

```bash
mysql -u root -p < scheme.sql
```

This creates the `notes_app` database and the `users`, `user_groups`, `group_members`, `notes`, `comments`, and `likes` tables (InnoDB, `utf8mb4`, with foreign keys and supporting indexes).

### 4. Run the server

```bash
node index.js
```

The server starts on `PORT` (default `3000`) and logs each request's method, path, status, and duration. An hourly interval job purges expired notes (`time_end <= NOW()`).

## Authentication

Protected routes require a JWT bearer token:

```
Authorization: Bearer <token>
```

Obtain a token via `POST /login`. Tokens expire after 1 hour and encode `{ userid, email }`.

## API Reference

### Auth

| Method | Route | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/register` | — | `nickname, email, password` | Create a new user. Nickname ≤10 chars (XSS-stripped), valid email format, password ≥6 chars. |
| POST | `/login` | — | `email, password` | Returns `{ user, token }`. |

### User

| Method | Route | Auth | Body | Description |
|---|---|---|---|---|
| PUT | `/users/email` | ✔ | `newEmail, password` | Change email; requires current password match. |
| PUT | `/users/password` | ✔ | `currentPassword, newPassword` | Change password (new password ≥6 chars). |

### Notes

| Method | Route | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/notes` | ✔ | `mode, groupid?, text, customHours?` | Create a note. `mode` ∈ `public/private/group`; `groupid` required (and membership checked) for `group` mode. Text ≤300 chars, XSS-stripped. `customHours` clamped to 1–24 (default 24). |
| GET | `/notes` | ✔ | — | Returns visible, non-expired notes: the caller's own private notes, all public notes, and notes from groups the caller belongs to — each with like count and comments, newest first. |
| PUT | `/notes/:noteid` | ✔ | `text, mode, groupid?` | Update a note (owner only). |
| DELETE | `/notes/:noteid` | ✔ | — | Delete a note (owner only). |

### Comments & Likes

| Method | Route | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/notes/:noteid/comments` | ✔ | `comment` | Add a comment (requires view permission on the note). ≤100 chars, XSS-stripped. |
| DELETE | `/notes/comments/:commentid` | ✔ | — | Delete own comment. |
| POST | `/notes/:noteid/like` | ✔ | — | Like a note (requires view permission; one like per user per note). |
| DELETE | `/notes/:noteid/like` | ✔ | — | Unlike a note. |

### Profile

| Method | Route | Auth | Body | Description |
|---|---|---|---|---|
| GET | `/profile/:userid` | — | — | Public view of a user's `userid, nickname, bio`. |
| PUT | `/profile` | ✔ | `nickname?, bio?` | Update own nickname (≤10 chars) and/or bio (≤200 chars), XSS-stripped. |

### Groups

| Method | Route | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/groups` | ✔ | `groupname` | Create a group; creator becomes owner and first member (transactional). |
| DELETE | `/groups/:groupid` | ✔ | — | Delete a group (owner only). Members cascade-delete. |
| POST | `/groups/:groupid/members` | ✔ | `userid` | Add a member (owner only). |
| DELETE | `/groups/:groupid/members/:userid` | ✔ | — | Remove a member (owner only; owner can't remove self). |
| PUT | `/groups/:groupid/owner` | ✔ | `newOwnerid` | Transfer ownership to an existing member. |
| GET | `/groups/:groupid/members` | ✔ | — | List members (caller must be a member). |
| GET | `/groups` | ✔ | — | List groups the caller has joined. |
| DELETE | `/groups/:groupid/leave` | ✔ | — | Leave a group (owner must transfer ownership first). |

## Note Visibility Rules

Implemented in `notePermission.js`, applied to comments and likes:

- **public** — visible to anyone
- **private** — visible only to the note's owner
- **group** — visible only to members of the note's group
- Expired notes (`time_end <= NOW()`) are never accessible

## Security Notes

- Passwords hashed with `bcryptjs` (10 salt rounds); never returned in API responses.
- All free-text user input (nickname, bio, note text, comments) is sanitized with `xss` (no HTML allowed) and length-capped.
- `userid` for mutating actions is always taken from the verified JWT (`req.user.userid`), never from the request body/URL, preventing spoofing.
- `helmet` sets a restrictive Content-Security-Policy; `cors` is restricted to an explicit origin allow-list configured via the `ALLOW_LIST` env var (comma-separated, no spaces — update per environment/deployment).
- Group ownership transfer, member add/remove, and note/comment mutations all re-verify ownership/membership server-side before acting.

## Known Gaps / Suggestions

- `_env.example` and `db.js` env var names should be double-checked against your actual `.env` file.
- No fallback/validation if `ALLOW_LIST` is unset — `process.env.ALLOW_LIST.split(',')` will throw at startup; consider a default or a clearer startup error.
- `index.js` `require` paths (`./aut/...`, `./middlewave/...`, `./note/...`, `./profile/...`, `./group/...`) assume a specific folder layout — adjust if your files live elsewhere (e.g. `authMiddleware.js` internally requires `../aut/jwt`, implying it lives in a sibling folder to `aut/`).
- No pagination on `GET /notes` — could grow expensive with large datasets.
- No rate limiting on `/login` or `/register`.