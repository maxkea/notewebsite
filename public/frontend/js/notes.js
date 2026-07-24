/* ==========================================================================
   notes.js — powers index.html (the notes dashboard)
   ========================================================================== */

let currentUserId = null;
let groupNameMap = {}; // groupid -> groupname, built from /groups

function escapeForAttr(str) {
    return String(str).replace(/"/g, '&quot;');
}

function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}
//group loading when typing
async function grouploadingtyping() {
    const textArea = document.getElementById('noteMode');
    textArea.addEventListener('change', async () => {
        await loadGroupsForForm();
    });
}
/* ---------------- init ---------------- */

async function initNotesPage() {
    requireAuth();
    initNav('notes');

    const me = getCurrentUser();
    currentUserId = me ? Number(me.userid) : null;

    wireCreateForm();
    await loadGroupsForForm();
    await loadNotes();

    document.getElementById('refreshBtn').addEventListener('click', loadNotes);
}

/* ---------------- load groups (for group-name lookup + create-note selector) ---------------- */

async function loadGroupsForForm() {
    const select = document.getElementById('noteGroupSelect');
    try {
        const groups = await apiGetGroups();
        groupNameMap = {};
        select.innerHTML = '<option value="">Select a group…</option>';

        groups.forEach(g => {
            groupNameMap[g.groupid] = g.groupname;
            const opt = document.createElement('option');
            opt.value = g.groupid;
            opt.textContent = g.groupname;
            select.appendChild(opt);
        });

        if (groups.length === 0) {
            select.innerHTML = '<option value="">No groups yet — join or create one</option>';
        }
    } catch (err) {
        // Non-fatal: creating public/private notes still works without this.
        select.innerHTML = '<option value="">Could not load groups</option>';
    }
}

function groupLabel(groupid) {
    if (!groupid) return '';
    return groupNameMap[groupid] ? groupNameMap[groupid] : `Group #${groupid}`;
}

/* ---------------- create note form ---------------- */

function wireCreateForm() {
    const modeSelect = document.getElementById('noteMode');
    const groupField = document.getElementById('noteGroupField');
    const textArea = document.getElementById('noteText');
    const charCount = document.getElementById('noteCharCount');
    const form = document.getElementById('createNoteForm');
    const errorEl = document.getElementById('createNoteError');

    modeSelect.addEventListener('change', () => {
        groupField.classList.toggle('hidden', modeSelect.value !== 'group');
    });

    textArea.addEventListener('input', () => {
        charCount.textContent = `${textArea.value.length} / 300`;
    });

    form.addEventListener('submit', async (e) => {
        apiGetGroups()
        e.preventDefault();
        hideAlert(errorEl);

        const mode = modeSelect.value;
        const text = textArea.value.trim();
        const customHours = Number(document.getElementById('noteHours').value) || 24;
        // public/private: groupid must be null. group: user must pick one.
        let groupid = null;

        if (mode === 'group') {
            const val = document.getElementById('noteGroupSelect').value;
            if (!val) {
                showAlert(errorEl, 'Choose a group for a group note.');
                return;
            }
            groupid = Number(val);
        }

        if (!text) {
            showAlert(errorEl, 'Note text cannot be empty.');
            return;
        }

        const submitBtn = document.getElementById('createNoteSubmit');
        submitBtn.disabled = true;

        try {
            await apiCreateNote({ mode, groupid, text, customHours });
            form.reset();
            charCount.textContent = '0 / 300';
            groupField.classList.add('hidden');
            await loadNotes();
        } catch (err) {
            showAlert(errorEl, err.message);
        } finally {
            submitBtn.disabled = false;
        }
    });
}

/* ---------------- load & render notes ---------------- */

async function loadNotes() {
    const list = document.getElementById('notesList');
    list.innerHTML = '<p class="skeleton">Loading notes…</p>';

    try {
        const notes = await apiGetNotes();

        if (!notes || notes.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <h3>No notes yet</h3>
                    <p class="muted">Notes you can see — yours, public ones, and your groups' — will show up here.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = '';
        notes.forEach(note => list.appendChild(renderNoteCard(note)));
    } catch (err) {
        list.innerHTML = `<div class="alert alert-error show">${escapeForAttr(err.message)}</div>`;
    }
}

function renderNoteCard(note) {
    const card = document.createElement('article');
    card.className = 'note-card';
    card.dataset.mode = note.mode;
    card.dataset.noteid = note.noteid;

    const isOwner = currentUserId !== null && Number(note.userid) === currentUserId;

    // ---- head ----
    const head = document.createElement('div');
    head.className = 'note-head';

    const left = document.createElement('div');
    const author = document.createElement('div');
    author.className = 'note-author';
    author.textContent = note.nickname;
    left.appendChild(author);

    const meta = document.createElement('div');
    meta.className = 'note-meta';
    meta.innerHTML = `
        <span>created ${formatDate(note.time_create)}</span>
        <span>expires ${formatDate(note.time_end)}</span>
    `;
    left.appendChild(meta);
    head.appendChild(left);

    const tag = document.createElement('span');
    tag.className = 'mode-tag';
    tag.textContent = note.mode === 'group' ? `group · ${groupLabel(note.groupid)}` : note.mode;
    head.appendChild(tag);

    card.appendChild(head);

    // ---- text (edit mode swaps this out) ----
    const textEl = document.createElement('p');
    textEl.className = 'note-text';
    textEl.textContent = note.text; // textContent only — never innerHTML for user content
    card.appendChild(textEl);

    // ---- actions ----
    const actions = document.createElement('div');
    actions.className = 'note-actions';

    const likeBtn = document.createElement('button');
    likeBtn.className = 'like-btn';
    likeBtn.type = 'button';
    likeBtn.innerHTML = `♥ <span class="like-count">${note.likeCount || 0}</span>`;
    likeBtn.addEventListener('click', () => toggleLike(note, likeBtn));
    actions.appendChild(likeBtn);

    const commentsToggle = document.createElement('button');
    commentsToggle.className = 'btn btn-ghost btn-sm';
    commentsToggle.type = 'button';
    const commentCount = (note.comments || []).length;
    commentsToggle.textContent = `Comments (${commentCount})`;
    actions.appendChild(commentsToggle);

    if (isOwner) {
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-ghost btn-sm';
        editBtn.type = 'button';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => enterEditMode(card, note, textEl));
        actions.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-ghost btn-sm';
        deleteBtn.type = 'button';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => deleteNoteCard(note.noteid, card));
        actions.appendChild(deleteBtn);
    }

    card.appendChild(actions);

    // ---- comments box (hidden until toggled) ----
    const commentsBox = document.createElement('div');
    commentsBox.className = 'comments-box hidden';
    renderComments(commentsBox, note);
    card.appendChild(commentsBox);

    commentsToggle.addEventListener('click', () => {
        commentsBox.classList.toggle('hidden');
    });

    return card;
}

/* ---------------- edit note ---------------- */

async function enterEditMode(card, note, textEl) {
    await loadGroupsForForm();

    if (card.querySelector('.edit-form')) return; // already editing

    const wrap = document.createElement('div');
    wrap.className = 'edit-form';

    const textarea = document.createElement('textarea');
    textarea.value = note.text;
    textarea.maxLength = 300;
    wrap.appendChild(textarea);

    const modeSelect = document.createElement('select');
    ['public', 'private', 'group'].forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        if (m === note.mode) opt.selected = true;
        modeSelect.appendChild(opt);
    });

    const groupSelect = document.createElement('select');
    groupSelect.className = note.mode === 'group' ? '' : 'hidden';
    Object.entries(groupNameMap).forEach(([gid, gname]) => {
        const opt = document.createElement('option');
        opt.value = gid;
        opt.textContent = gname;
        if (Number(gid) === Number(note.groupid)) opt.selected = true;
        groupSelect.appendChild(opt);
    });

    modeSelect.addEventListener('change', () => {
        groupSelect.classList.toggle('hidden', modeSelect.value !== 'group');
    });

    const row = document.createElement('div');
    row.className = 'inline-form';
    row.style.marginTop = '8px';
    row.appendChild(modeSelect);
    row.appendChild(groupSelect);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary btn-sm';
    saveBtn.textContent = 'Save';
    saveBtn.type = 'button';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary btn-sm';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.type = 'button';

    const errorEl = document.createElement('div');
    errorEl.className = 'alert alert-error';
    errorEl.style.marginTop = '8px';

    row.appendChild(saveBtn);
    row.appendChild(cancelBtn);
    wrap.appendChild(row);
    wrap.appendChild(errorEl);

    textEl.replaceWith(wrap);

    cancelBtn.addEventListener('click', () => {
        wrap.replaceWith(textEl);
    });

    saveBtn.addEventListener('click', async () => {
        hideAlert(errorEl);
        const newText = textarea.value.trim();
        const newMode = modeSelect.value;
        const newGroupid = newMode === 'group' ? Number(groupSelect.value) || null : null;

        if (!newText) {
            showAlert(errorEl, 'Note text cannot be empty.');
            return;
        }
        if (newMode === 'group' && !newGroupid) {
            showAlert(errorEl, 'Choose a group.');
            return;
        }

        saveBtn.disabled = true;
        try {
            await apiUpdateNote(note.noteid, { text: newText, mode: newMode, groupid: newGroupid });
            await loadNotes();
        } catch (err) {
            showAlert(errorEl, err.message);
            saveBtn.disabled = false;
        }
    });
}

/* ---------------- delete note ---------------- */

async function deleteNoteCard(noteid, card) {
    if (!confirm('Delete this note? This cannot be undone.')) return;
    try {
        await apiDeleteNote(noteid);
        card.remove();
    } catch (err) {
        alert(err.message);
    }
}

/* ---------------- likes ---------------- */

async function toggleLike(note, btn) {
    const liked = btn.classList.contains('liked');
    btn.disabled = true;
    try {
        if (liked) {
            await apiUnlikeNote(note.noteid);
            btn.classList.remove('liked');
            const countEl = btn.querySelector('.like-count');
            countEl.textContent = Math.max(0, Number(countEl.textContent) - 1);
        } else {
            await apiLikeNote(note.noteid);
            btn.classList.add('liked');
            const countEl = btn.querySelector('.like-count');
            countEl.textContent = Number(countEl.textContent) + 1;
        }
    } catch (err) {
        // "already liked" / "not found" — just refresh state from the server.
        alert(err.message);
    } finally {
        btn.disabled = false;
    }
}

/* ---------------- comments ---------------- */

function renderComments(box, note) {
    box.innerHTML = '';

    const list = document.createElement('div');
    (note.comments || []).forEach(c => {
        list.appendChild(renderCommentRow(c));
    });
    box.appendChild(list);

    const form = document.createElement('form');
    form.className = 'comment-form';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Add a comment…';
    input.maxLength = 100;

    const submit = document.createElement('button');
    submit.className = 'btn btn-secondary btn-sm';
    submit.type = 'submit';
    submit.textContent = 'Post';

    form.appendChild(input);
    form.appendChild(submit);
    box.appendChild(form);

    const errorEl = document.createElement('div');
    errorEl.className = 'alert alert-error';
    errorEl.style.marginTop = '6px';
    box.appendChild(errorEl);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert(errorEl);
        const text = input.value.trim();
        if (!text) return;

        submit.disabled = true;
        try {
            const result = await apiAddComment(note.noteid, text);
            const newComment = result.result || result;
            // Backend doesn't return nickname on this endpoint (see TODO in api.js) — it's always us.
            if (!newComment.nickname) newComment.nickname = 'You';
            list.appendChild(renderCommentRow(newComment));
            input.value = '';
        } catch (err) {
            showAlert(errorEl, err.message);
        } finally {
            submit.disabled = false;
        }
    });
}

function renderCommentRow(c) {
    const row = document.createElement('div');
    row.className = 'comment-row';

    const left = document.createElement('span');
    const authorSpan = document.createElement('span');
    authorSpan.className = 'comment-author';
    authorSpan.textContent = (c.nickname || 'user') + ':';
    left.appendChild(authorSpan);

    const textSpan = document.createElement('span');
    textSpan.textContent = c.comment; // textContent, never innerHTML
    left.appendChild(textSpan);

    row.appendChild(left);

    const isOwner = currentUserId !== null && Number(c.userid) === currentUserId;
    if (isOwner) {
        const del = document.createElement('button');
        del.className = 'btn btn-ghost btn-sm';
        del.type = 'button';
        del.textContent = 'Delete';
        del.addEventListener('click', async () => {
            if (!confirm('Delete this comment?')) return;
            try {
                await apiDeleteComment(c.commentid);
                row.remove();
            } catch (err) {
                alert(err.message);
            }
        });
        row.appendChild(del);
    }

    return row;
}
