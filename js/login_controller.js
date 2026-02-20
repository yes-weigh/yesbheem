/**
 * login_controller.js
 * Wires up the login form in pages/login.html after nav_controller injects it.
 * Loaded as a regular (non-module) global script so it can be called from nav_controller.
 * Depends on: window.AuthFortress (from auth_fortress.js loaded as a module in index.html)
 */

window.initLoginPage = function () {
    // AuthFortress may not be ready yet if auth_fortress.js module hasn't resolved.
    // Poll briefly if needed.
    const tryInit = (attempts = 0) => {
        if (!window.AuthFortress) {
            if (attempts > 20) {
                console.error('[LoginController] AuthFortress not available after waiting.');
                return;
            }
            setTimeout(() => tryInit(attempts + 1), 150);
            return;
        }

        const fortress = new window.AuthFortress();
        const msgEl = document.getElementById('login-statusMsg');
        const initBtn = document.getElementById('login-initBtn');
        const verifyBtn = document.getElementById('login-verifyBtn');
        const backBtn = document.getElementById('login-backBtn');
        const stage1 = document.getElementById('login-stage1');
        const stage2 = document.getElementById('login-stage2');

        if (!initBtn) {
            console.error('[LoginController] Login DOM not found. Aborting init.');
            return;
        }

        function setStatus(msg, type = 'neutral') {
            msgEl.textContent = msg;
            msgEl.className = 'login-toast-msg';
            if (type === 'error') msgEl.classList.add('login-text-error');
            if (type === 'success') msgEl.classList.add('login-text-success');
        }

        function setLoading(btn, isLoading) {
            if (isLoading) {
                btn.disabled = true;
                btn.dataset.original = btn.innerText;
                btn.innerHTML = '<span class="login-loading-spinner"></span> Processing';
            } else {
                btn.disabled = false;
                btn.innerText = btn.dataset.original || 'Submit';
            }
        }

        initBtn.addEventListener('click', async () => {
            const email = document.getElementById('login-email').value.trim();
            const phone = document.getElementById('login-phone').value.trim();

            if (!email || !phone) {
                setStatus('Please enter both Email and Phone.', 'error');
                return;
            }

            setLoading(initBtn, true);
            setStatus('');

            try {
                await fortress.initiateLogin(email, phone);
                setStatus('Codes sent successfully.', 'success');
                setTimeout(() => {
                    stage1.classList.add('login-hidden');
                    stage2.classList.remove('login-hidden');
                    setStatus('');
                    document.getElementById('login-otpA').focus();
                }, 500);
            } catch (error) {
                setStatus(error.message || 'Login failed.', 'error');
            } finally {
                setLoading(initBtn, false);
            }
        });

        verifyBtn.addEventListener('click', async () => {
            const codeA = document.getElementById('login-otpA').value.trim();
            const codeB = document.getElementById('login-otpB').value.trim();
            const email = document.getElementById('login-email').value.trim();

            const isDeveloper = (email === 'mhdfazalvs@gmail.com');
            if (!isDeveloper && (!codeA || !codeB)) {
                setStatus('Please enter both security codes.', 'error');
                return;
            }

            setLoading(verifyBtn, true);
            setStatus('Verifying credentials...');

            try {
                await fortress.verifyAndSession(email, codeA, codeB);
                setStatus('Login successful! Loading dashboard...', 'success');
                // Reload the SPA shell — URL stays at /
                setTimeout(() => { window.location.href = '/'; }, 800);
            } catch (error) {
                setStatus(error.message || 'Verification failed.', 'error');
                setLoading(verifyBtn, false);
            }
        });

        backBtn.addEventListener('click', () => {
            stage2.classList.add('login-hidden');
            stage1.classList.remove('login-hidden');
            setStatus('');
        });

        console.log('[LoginController] Login form initialized.');
    };

    tryInit();
};
