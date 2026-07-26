# Notes Sharing App

A full-stack notes-sharing application, containerized with Docker Compose. Users register/login, post notes visible **publicly**, **privately**, or to a **group**, and interact via comments and likes. Notes automatically expire after a configurable number of hours.

**Stack:** Nginx (static frontend + reverse proxy, same-origin to the browser) → Node.js/Express API → MySQL, each running in its own container.

## Architecture

```
                 ┌────────────────────────┐
  Browser  ───▶  │  frontend (nginx:80)   │
                 │  serves /public + proxies
                 │  /api/* → backend:3000 │
                 └───────────┬────────────┘
                              │ backend_network / frontend_network
                 ┌───────────▼────────────┐
                 │  backend (node:3000)   │
                 │  Express REST API      │
                 └───────────┬────────────┘
                              │ backend_network
                 ┌───────────▼────────────┐
                 │  db (mysql)            │
                 │  notes_app database    │
                 └─────────────────────────┘
```

- `frontend` is the only container with a published port (`80:80`); `backend` and `db` are reachable only over the internal Docker networks.
- Nginx proxies any request under `/api/` to the backend container, stripping the `/api/` prefix (`proxy_pass http://backend:3000/`) — so the browser calls e.g. `/api/login` and Nginx forwards it to the backend's `/login` route.
- `db` has a healthcheck (`mysqladmin ping`); `backend` waits for `db` to be healthy before starting.

## Project Structure

```
.
├── docker-compose.yml
├── .env                        # not committed — see Environment Variables
├── frontend/
│   ├── Dockerfile              # nginx:alpine, copies ./public + nginx.conf
│   ├── nginx.conf              # serves SPA, proxies /api/ to backend:3000
│   └── public/
│       ├── index.html / login.html / register.html / profile.html / groups.html
│       ├── css/style.css
│       └── js/
│           ├── api.js          # fetch wrapper / API base config
│           ├── auth.js         # login/register logic
│           ├── notes.js
│           ├── groups.js
│           └── profile.js
├── backend/
│   ├── Dockerfile              # Node image, installs deps, runs `npm start`
│   ├── package.json
│   ├── index.js                # App entry point, route definitions
│   ├── db.js                   # MySQL connection pool
│   ├── aut/
│   │   ├── aut_regis.js        # register, login
│   │   ├── changeinfo.js       # changeEmail, changePassword
│   │   └── jwt.js              # provideToken, checkToken
│   ├── middlewave/
│   │   └── authMiddleware.js   # JWT bearer auth guard
│   ├── note/
│   │   ├── note.js             # writeNote, updateNote, deleteNote, receiveNotes
│   │   ├── notePermission.js   # checkNotePermission (visibility rules)
│   │   ├── comment.js          # comment, deleteComment
│   │   └── likes.js            # likes, unlikes
│   ├── profile/
│   │   └── userprofile.js      # viewProfile, updateProfile
│   ├── group/
│   │   └── group.js            # createGroup, deleteGroup, addMember, removeMember,
│   │                            # changeGroupOwner, viewGroupMembers, viewGroup, leaveGroup
│   └── jobs/
│       └── deleteExpiredNotes.js  # hourly cleanup of expired notes
└── db/
    ├── Dockerfile               # custom MySQL image
    ├── schema.sql                # tables: users, user_groups, group_members, notes, comments, likes
    └── permissions.sql           # GRANTs for the app DB user
```

## Environment Variables

Create a `.env` file at the project root (used by `docker-compose.yml`):

```env
# --- Backend ---
PORT=3000
JWT_SECRET=your-secret-key

# --- Database connection (used by backend) ---
DB_HOST=db
DB_PORT=3306
DB_NAME=notes_app
DB_USER=notes_app_user
DB_PASSWORD=your-db-user-password

# --- MySQL container init (used by db) ---
MYSQL_ROOT_PASSWORD=your-root-password
MYSQL_DATABASE=notes_app
MYSQL_USER=notes_app_user
MYSQL_PASSWORD=your-db-user-password
```

Notes:
- `DB_HOST` must be the Compose service name (`db`), not `localhost`, since the backend reaches MySQL over the Docker network.
- `DB_USER`/`DB_PASSWORD` should match `MYSQL_USER`/`MYSQL_PASSWORD` (or a user created via `permissions.sql`) so the backend can authenticate.
- `MYSQL_USER`/`MYSQL_PASSWORD`/`MYSQL_DATABASE` are consumed by the official MySQL entrypoint to bootstrap the database and user on first run.
- The backend no longer uses the `cors` package or an `ALLOW_LIST` variable — see [CORS / Cross-Origin Notes](#cors--cross-origin-notes).

## Running with Docker Compose

```bash
# Build and start all three services in the background
docker compose up --build -d

# Follow logs
docker compose logs -f backend

# Stop
docker compose down

# Stop and wipe the MySQL volume (full reset)
docker compose down -v
```

Once running:
- App: **http://localhost/**
- API (via proxy): **http://localhost/api/...**
- MySQL data persists in the `mysql_data` named volume between restarts.

### First-time database setup

The `db` service builds from `db/Dockerfile` on top of a MySQL base image. If it doesn't already bootstrap the schema automatically (e.g. via `docker-entrypoint-initdb.d`), apply it manually once the container is healthy:

```bash
docker exec -i mysql_database mysql -u root -p"$MYSQL_ROOT_PASSWORD" < db/schema.sql
docker exec -i mysql_database mysql -u root -p"$MYSQL_ROOT_PASSWORD" < db/permissions.sql
```

`schema.sql` creates the `notes_app` database and the `users`, `user_groups`, `group_members`, `notes`, `comments`, and `likes` tables (InnoDB, `utf8mb4`). `permissions.sql` grants `SELECT, INSERT, UPDATE, DELETE` on `notes_app.*` to `notes_app_user`.

## CORS / Cross-Origin Notes

The backend does **not** set any CORS headers (the `cors` middleware and `ALLOW_LIST` env var were removed). This works because the browser only ever talks to the Nginx `frontend` container — same origin, via the `/api/` proxy — so no cross-origin request is ever made in the Docker Compose setup.

This means:
- Calling the backend directly from a **different origin** (e.g. a separate frontend dev server on `http://localhost:5173` hitting `http://localhost:3000` directly) will be blocked by the browser, since no `Access-Control-Allow-Origin` header is returned.
- If you ever need the frontend and backend on different origins again (e.g. local development without the Nginx proxy), you'd need to reintroduce `cors` with an explicit allow-list rather than a wildcard.

## Running Without Docker (local dev)

```bash
cd backend
npm install
# create backend/.env with PORT, JWT_SECRET, DB_HOST=localhost, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
npm start
```

Serve `frontend/public` with any static server, or point it at Nginx locally using `frontend/nginx.conf` (adjust `proxy_pass` if the backend isn't on `backend:3000`). Since the backend has no CORS headers, opening `frontend/public` directly (a different origin than the backend) will fail on `fetch`/`XHR` calls unless served through the Nginx proxy or the same origin.

## Authentication

Protected routes require a JWT bearer token:

```
Authorization: Bearer <token>
```

Obtain a token via `POST /login` (or `POST /api/login` through the proxy). Tokens expire after 1 hour and encode `{ userid, email }`.

## API Reference

All routes below are relative to the backend root; through the Nginx proxy, prefix each with `/api`.

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

Implemented in `backend/note/notePermission.js`, applied to comments and likes:

- **public** — visible to anyone
- **private** — visible only to the note's owner
- **group** — visible only to members of the note's group
- Expired notes (`time_end <= NOW()`) are never accessible

## Security Notes

- Passwords hashed with `bcryptjs` (10 salt rounds); never returned in API responses.
- All free-text user input (nickname, bio, note text, comments) is sanitized with `xss` (no HTML allowed) and length-capped.
- `userid` for mutating actions is always taken from the verified JWT (`req.user.userid`), never from the request body/URL, preventing spoofing.
- `helmet` sets a restrictive Content-Security-Policy. There is no CORS middleware — the backend relies on the Nginx proxy keeping all browser requests same-origin (see [CORS / Cross-Origin Notes](#cors--cross-origin-notes)).
- The MySQL container is not exposed to the host (`db` has no published `ports:`, only reachable on `backend_network`); the app DB user (`permissions.sql`) is scoped to `notes_app.*` rather than granted global/root privileges.
- Group ownership transfer, member add/remove, and note/comment mutations all re-verify ownership/membership server-side before acting.

## Known Gaps / Suggestions

- Confirm whether `db/Dockerfile` actually copies `schema.sql`/`permissions.sql` into `/docker-entrypoint-initdb.d/` for automatic first-run initialization, or whether they must be applied manually (see [First-time database setup](#first-time-database-setup)).
- `db` service has no published port — fine for production, but makes local DB inspection (e.g. via a GUI client) require `docker exec` or a temporary port mapping.
- No pagination on `GET /notes` — could grow expensive with large datasets.
- No rate limiting on `/login` or `/register`.
- `.env` is required for `docker-compose.yml` to work but isn't committed — keep an `.env.example` (mirroring `_env.example`) in the repo root for onboarding.
- With no CORS headers on the backend, any legitimate future need for a separate frontend origin (mobile app, third-party client, separate dev server) will require deliberately reintroducing `cors` with a scoped allow-list.
