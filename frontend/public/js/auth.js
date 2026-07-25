/* ==========================================================================
   auth.js — login page, register page, and the shared navbar/logout wiring
   used by every protected page.
   ========================================================================== */

function showAlert(el, message) {
    el.textContent = message;
    el.classList.add('show');
}

function hideAlert(el) {
    el.textContent = '';
    el.classList.remove('show');
}

/* ---------------- Shared navbar wiring (called on every protected page) ---------------- */

function initNav(activePage) {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            clearToken();
            window.location.href = 'login.html';
        });
    }

    document.querySelectorAll('.nav-links a[data-page]').forEach(link => {
        if (link.dataset.page === activePage) {
            link.classList.add('active');
        }
    });
}

/* ---------------- Login page ---------------- */

function initLoginPage() {
    // Already logged in? skip straight to the app.
    if (isLoggedIn()) {
        window.location.href = 'index.html';
        return;
    }

    const form = document.getElementById('loginForm');
    const errorEl = document.getElementById('loginError');
    const submitBtn = document.getElementById('loginSubmit');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert(errorEl);

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (!email || !password) {
            showAlert(errorEl, 'Enter your email and password.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in…';

        try {
            const result = await apiLogin({ email, password });
            setToken(result.token);
            window.location.href = 'index.html';
        } catch (err) {
            showAlert(errorEl, err.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Log in';
        }
    });
}

/* ---------------- Register page ---------------- */

function initRegisterPage() {
    if (isLoggedIn()) {
        window.location.href = 'index.html';
        return;
    }

    const form = document.getElementById('registerForm');
    const errorEl = document.getElementById('registerError');
    const submitBtn = document.getElementById('registerSubmit');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert(errorEl);

        const nickname = document.getElementById('nickname').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (!nickname) {
            showAlert(errorEl, 'Nickname is required.');
            return;
        }
        if (nickname.length > 10) {
            showAlert(errorEl, 'Nickname must be 10 characters or fewer.');
            return;
        }
        if (!email) {
            showAlert(errorEl, 'Email is required.');
            return;
        }
        if (password.length < 6) {
            showAlert(errorEl, 'Password must be at least 6 characters.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating account…';

        try {
            await apiRegister({ nickname, email, password });
            window.location.href = 'login.html';
        } catch (err) {
            showAlert(errorEl, err.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create account';
        }
    });
}
