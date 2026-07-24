/* ==========================================================================
   profile.js — powers profile.html
   ========================================================================== */

async function initProfilePage() {
    requireAuth();
    initNav('profile');

    const me = getCurrentUser();
    if (!me) {
        forceLogout();
        return;
    }

    await loadProfile(me.userid);
    wireProfileForm(me.userid);
    wireEmailForm();
    wirePasswordForm();
}

async function loadProfile(userid) {
    const box = document.getElementById('profileSummary');
    box.innerHTML = '<p class="skeleton">Loading profile…</p>';

    try {
        const profile = await apiGetProfile(userid);

        box.innerHTML = '';
        const idRow = document.createElement('p');
        idRow.innerHTML = `<span class="muted">User ID</span>`;
        idRow.appendChild(document.createTextNode(' #' + profile.userid));
        box.appendChild(idRow);

        document.getElementById('nicknameInput').value = profile.nickname || '';
        document.getElementById('bioInput').value = profile.bio || '';
        document.getElementById('bioCharCount').textContent = `${(profile.bio || '').length} / 200`;
    } catch (err) {
        box.innerHTML = `<div class="alert alert-error show">${err.message}</div>`;
    }
}

function wireProfileForm(userid) {
    const form = document.getElementById('profileForm');
    const errorEl = document.getElementById('profileError');
    const successEl = document.getElementById('profileSuccess');
    const bioInput = document.getElementById('bioInput');
    const bioCharCount = document.getElementById('bioCharCount');

    bioInput.addEventListener('input', () => {
        bioCharCount.textContent = `${bioInput.value.length} / 200`;
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert(errorEl);
        hideAlert(successEl);

        const nickname = document.getElementById('nicknameInput').value.trim();
        const bio = bioInput.value.trim();

        if (nickname.length > 10) {
            showAlert(errorEl, 'Nickname must be 10 characters or fewer.');
            return;
        }
        if (bio.length > 200) {
            showAlert(errorEl, 'Bio must be 200 characters or fewer.');
            return;
        }

        const btn = document.getElementById('profileSubmit');
        btn.disabled = true;

        try {
            await apiUpdateProfile({ nickname, bio });
            showAlert(successEl, 'Profile updated.');
        } catch (err) {
            showAlert(errorEl, err.message);
        } finally {
            btn.disabled = false;
        }
    });
}

function wireEmailForm() {
    const form = document.getElementById('emailForm');
    const errorEl = document.getElementById('emailError');
    const successEl = document.getElementById('emailSuccess');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert(errorEl);
        hideAlert(successEl);

        const newEmail = document.getElementById('newEmailInput').value.trim();
        const password = document.getElementById('emailPasswordInput').value;

        const btn = document.getElementById('emailSubmit');
        btn.disabled = true;

        try {
            await apiChangeEmail({ newEmail, password });
            showAlert(successEl, 'Email updated. Use your new email next time you log in.');
            form.reset();
        } catch (err) {
            showAlert(errorEl, err.message);
        } finally {
            btn.disabled = false;
        }
    });
}

function wirePasswordForm() {
    const form = document.getElementById('passwordForm');
    const errorEl = document.getElementById('passwordError');
    const successEl = document.getElementById('passwordSuccess');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert(errorEl);
        hideAlert(successEl);

        const currentPassword = document.getElementById('currentPasswordInput').value;
        const newPassword = document.getElementById('newPasswordInput').value;

        if (newPassword.length < 6) {
            showAlert(errorEl, 'New password must be at least 6 characters.');
            return;
        }

        const btn = document.getElementById('passwordSubmit');
        btn.disabled = true;

        try {
            await apiChangePassword({ currentPassword, newPassword });
            showAlert(successEl, 'Password updated.');
            form.reset();
        } catch (err) {
            showAlert(errorEl, err.message);
        } finally {
            btn.disabled = false;
        }
    });
}
