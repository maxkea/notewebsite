/* ==========================================================================
   groups.js — powers groups.html
   ========================================================================== */

let myUserId = null;

async function initGroupsPage() {
    requireAuth();
    initNav('groups');

    const me = getCurrentUser();
    myUserId = me ? Number(me.userid) : null;

    wireCreateGroupForm();
    await loadGroups();
}

function wireCreateGroupForm() {
    const form = document.getElementById('createGroupForm');
    const errorEl = document.getElementById('createGroupError');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert(errorEl);

        const nameInput = document.getElementById('groupNameInput');
        const groupname = nameInput.value.trim();
        if (!groupname) {
            showAlert(errorEl, 'Group name is required.');
            return;
        }

        const submitBtn = document.getElementById('createGroupSubmit');
        submitBtn.disabled = true;

        try {
            await apiCreateGroup(groupname);
            nameInput.value = '';
            await loadGroups();
        } catch (err) {
            showAlert(errorEl, err.message);
        } finally {
            submitBtn.disabled = false;
        }
    });
}

async function loadGroups() {
    const list = document.getElementById('groupsList');
    list.innerHTML = '<p class="skeleton">Loading groups…</p>';

    try {
        const groups = await apiGetGroups();

        if (!groups || groups.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <h3>No groups yet</h3>
                    <p class="muted">Create a group above to start sharing notes with people you choose.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = '';
        groups.forEach(g => list.appendChild(renderGroupCard(g)));
    } catch (err) {
        list.innerHTml = '';
        list.innerHTML = `<div class="alert alert-error show">${err.message}</div>`;
    }
}

function renderGroupCard(group) {
    const isOwner = myUserId !== null && Number(group.ownerid) === myUserId;

    const card = document.createElement('div');
    card.className = 'group-card';

    const head = document.createElement('div');
    head.className = 'group-head';

    const left = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = group.groupname;
    left.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'muted';
    meta.style.fontSize = '0.85rem';
    meta.textContent = `#${group.groupid} · owner: ${group.ownerNickname}`;
    left.appendChild(meta);

    head.appendChild(left);

    if (isOwner) {
        const badge = document.createElement('span');
        badge.className = 'owner-badge';
        badge.textContent = 'you own this';
        head.appendChild(badge);
    }

    card.appendChild(head);

    const actions = document.createElement('div');
    actions.className = 'toolbar';
    actions.style.marginTop = '12px';

    const membersToggle = document.createElement('button');
    membersToggle.className = 'btn btn-secondary btn-sm';
    membersToggle.type = 'button';
    membersToggle.textContent = 'View members';
    actions.appendChild(membersToggle);

    if (isOwner) {
        const changeOwnerBtn = document.createElement('button');
        changeOwnerBtn.className = 'btn btn-ghost btn-sm';
        changeOwnerBtn.type = 'button';
        changeOwnerBtn.textContent = 'Change owner';
        actions.appendChild(changeOwnerBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-ghost btn-sm';
        deleteBtn.type = 'button';
        deleteBtn.textContent = 'Delete group';
        deleteBtn.addEventListener('click', async () => {
            if (!confirm(`Delete "${group.groupname}"? This removes it for everyone.`)) return;
            try {
                await apiDeleteGroup(group.groupid);
                card.remove();
            } catch (err) {
                alert(err.message);
            }
        });
        actions.appendChild(deleteBtn);

        changeOwnerBtn.addEventListener('click', () => {
            const idStr = prompt('Enter the user ID of the new owner (must already be a member):');
            if (!idStr) return;
            const newOwnerid = Number(idStr);
            if (!newOwnerid) {
                alert('Enter a valid numeric user ID.');
                return;
            }
            apiChangeGroupOwner(group.groupid, newOwnerid)
                .then(() => loadGroups())
                .catch(err => alert(err.message));
        });
    } else {
        const leaveBtn = document.createElement('button');
        leaveBtn.className = 'btn btn-ghost btn-sm';
        leaveBtn.type = 'button';
        leaveBtn.textContent = 'Leave group';
        leaveBtn.addEventListener('click', async () => {
            if (!confirm(`Leave "${group.groupname}"?`)) return;
            try {
                // Leaving is just removing yourself as a member.
                await apiLeaveGroup(group.groupid);
                card.remove();
            } catch (err) {
                alert(err.message);
            }
        });
        actions.appendChild(leaveBtn);
    }

    card.appendChild(actions);

    // ---- members panel (hidden until "View members") ----
    const panel = document.createElement('div');
    panel.className = 'hidden';
    panel.style.marginTop = '12px';
    card.appendChild(panel);

    let loaded = false;
    membersToggle.addEventListener('click', async () => {
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden') && !loaded) {
            loaded = true;
            await renderMembersPanel(panel, group, isOwner);
        }
    });

    return card;
}

async function renderMembersPanel(panel, group, isOwner) {
    panel.innerHTML = '<p class="skeleton">Loading members…</p>';

    try {
        const data = await apiGetGroupMembers(group.groupid);
        const members = data.members || [];

        panel.innerHTML = '';

        members.forEach(m => {
            const row = document.createElement('div');
            row.className = 'member-row';

            const label = document.createElement('span');
            label.textContent = `${m.nickname} (#${m.userid})`;
            row.appendChild(label);

            if (isOwner && Number(m.userid) !== myUserId) {
                const removeBtn = document.createElement('button');
                removeBtn.className = 'btn btn-ghost btn-sm';
                removeBtn.type = 'button';
                removeBtn.textContent = 'Remove';
                removeBtn.addEventListener('click', async () => {
                    if (!confirm(`Remove ${m.nickname} from the group?`)) return;
                    try {
                        await apiRemoveMember(group.groupid, m.userid);
                        row.remove();
                    } catch (err) {
                        alert(err.message);
                    }
                });
                row.appendChild(removeBtn);
            }

            panel.appendChild(row);
        });

        if (isOwner) {
            const addForm = document.createElement('form');
            addForm.className = 'inline-form';
            addForm.style.marginTop = '10px';

            const input = document.createElement('input');
            input.type = 'number';
            input.placeholder = 'User ID to add';
            input.min = '1';

            const btn = document.createElement('button');
            btn.className = 'btn btn-secondary btn-sm';
            btn.type = 'submit';
            btn.textContent = 'Add member';

            addForm.appendChild(input);
            addForm.appendChild(btn);
            panel.appendChild(addForm);

            addForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const userid = Number(input.value);
                if (!userid) return;
                try {
                    await apiAddMember(group.groupid, userid);
                    input.value = '';
                    await renderMembersPanel(panel, group, isOwner);
                } catch (err) {
                    alert(err.message);
                }
            });
        }
    } catch (err) {
        panel.innerHTML = `<div class="alert alert-error show">${err.message}</div>`;
    }
}
