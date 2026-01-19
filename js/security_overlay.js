import { app } from './services/firebase_config.js';
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, updateDoc, serverTimestamp, deleteField } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { LogoutHandler } from './logout_handler.js';

const auth = getAuth(app);
const db = getFirestore(app);

class SecurityOverlay {
    constructor() {
        this.fingerprint = null;
        this.ip = '0.0.0.0';
        this.user = null;
        this.overlay = null;
        this.heartbeatInterval = null;

        this.init();
    }

    async init() {
        // 1. Initialize Fingerprint
        const fpPromise = import('https://openfpcdn.io/fingerprintjs/v4')
            .then(FingerprintJS => FingerprintJS.load());
        const fp = await fpPromise;
        const result = await fp.get();
        this.fingerprint = result.visitorId;

        // Store fingerprint in localStorage as backup for logout
        localStorage.setItem('deviceFingerprint', this.fingerprint);
        console.log('[SecurityOverlay] Fingerprint initialized and stored:', this.fingerprint);

        // 2. Fetch IP
        try {
            const res = await fetch('https://api.ipify.org?format=json');
            const data = await res.json();
            this.ip = data.ip;
        } catch (e) {
            console.warn("IP Resolution masked via Proxy/VPN");
            this.ip = "MASKED_IP";
        }

        // 3. Auth Listener & Gatekeeper
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.user = user;

                // Store user UID for cleanup in case of browser data clearing
                localStorage.setItem('lastUserUid', user.uid);

                // Verify Token Claims
                try {
                    const tokenResult = await user.getIdTokenResult();
                    console.log("[SecurityOverlay] Token Claims:", tokenResult.claims);

                    if (!tokenResult.claims.trustedDevice) {
                        console.warn("[SecurityOverlay] Missing trustedDevice claim. Terminating session...");
                        this.terminate("Untrusted Device Detected");
                        return;
                    }

                    this.createOverlay();
                    this.startWatchdog();
                    this.startHeartbeat(); // Start session heartbeat
                    this.startSessionValidator(); // Start listening for remote termination
                } catch (e) {
                    console.error("[SecurityOverlay] Token verification error:", e);
                    this.terminate("Auth Verification Failed");
                    return;
                }
            } else {
                // User logged out or cleared browser data
                console.log('[SecurityOverlay] User logged out or session cleared');

                // Attempt to clean up session if we have fingerprint and last user UID
                if (this.fingerprint) {
                    const lastUserUid = localStorage.getItem('lastUserUid');
                    if (lastUserUid) {
                        console.log('[SecurityOverlay] Attempting to cleanup session for cleared browser data');
                        try {
                            await LogoutHandler.cleanupSessionOnly(lastUserUid, this.fingerprint);
                        } catch (error) {
                            console.log('[SecurityOverlay] Cleanup failed (expected if already logged out):', error);
                        }
                        localStorage.removeItem('lastUserUid');
                    }
                }

                // Redirect to Fortress Login if not authenticated
                window.location.href = 'login.html';
            }
        });

        // 4. UI Hardening
        this.hardenUI();
    }

    createDebugPanel(claims) {


        const isTrusted = claims.trustedDevice ? '<span style="color:#00ff00">YES</span>' : '<span style="color:red">NO</span>';

        panel.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: bold;">FORTRESS STATUS</div>
            <div>User: ${this.user.email}</div>
            <div>Trusted Device: ${isTrusted}</div>
            <button id="force-logout-btn" style="
                margin-top: 10px;
                background: #ff0000;
                color: white;
                border: none;
                padding: 8px 16px;
                cursor: pointer;
                border-radius: 4px;
                font-family: monospace;
                font-weight: bold;
                width: 100%;
            ">FORCE SIGNOUT</button>
        `;

        document.body.appendChild(panel);

        document.getElementById('force-logout-btn').addEventListener('click', () => {
            signOut(auth).then(() => {
                window.location.href = 'login.html';
            });
        });
    }

    createOverlay() {
        // Overlay disabled by user request (Traitor Tracking UI removed)
        // if (this.overlay) return;
        // this.overlay = document.createElement('div');
        // ... (visuals removed)
        console.log("[SecurityOverlay] Monitoring active (Silent Mode)");
    }

    startWatchdog() {
        // 60s Integrity Check
        setInterval(async () => {
            // Re-check IP logic could go here if we want to be super strict
            // For now, checks if fingerprint changed (unlikely but preventing session hijacking via storage copy)

            /* 
               In a real advanced scenario, we'd re-fingerprint.
               Checking auth token validity:
            */
            try {
                await this.user.getIdToken(true); // Force refresh to check if disabled/suspended
            } catch (e) {
                this.terminate("Session Revoked by Server");
            }

        }, 60000);
    }

    startHeartbeat() {
        // Update session heartbeat every 30 seconds
        this.heartbeatInterval = setInterval(async () => {
            if (!this.user || !this.fingerprint) return;

            try {
                const userRef = doc(db, 'users', this.user.uid);
                await updateDoc(userRef, {
                    [`activeSessions.${this.fingerprint}.lastActiveAt`]: serverTimestamp()
                });
                console.log('[SecurityOverlay] Session heartbeat updated');
            } catch (error) {
                console.error('[SecurityOverlay] Heartbeat update failed:', error);
            }
        }, 30000); // Every 30 seconds
    }

    startSessionValidator() {
        // Listen to my own user document to detect remote termination
        if (!this.user || !this.fingerprint) return;

        // Import onSnapshot dynamically if not already imported or use the one from global scope if available
        // But since we are inside a module that already imports other firestore functions, we should add onSnapshot to the top imports.
        // However, I can't easily change top imports in this chunk.
        // Let's assume onSnapshot is available or import it.
        // Wait, the file imports are at the top. I need to check if onSnapshot is imported.
        // It is NOT imported in line 3.
        // I need to add it to imports first.

        // Let's rely on dynamic import for this specific feature to minimize diff noise or I'll do a multi-replace.
        // actually, I'll do a separate edit for imports. For now, let's implement the method using the module pattern 
        // assuming I'll fix imports in next step.

        // Actually, let's just use the global firebase if available or dynamic import.
        import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js").then(({ onSnapshot, doc }) => {
            const userRef = doc(db, 'users', this.user.uid);
            this.sessionUnsubscribe = onSnapshot(userRef, (doc) => {
                if (!doc.exists()) {
                    this.terminate("User Account Not Found");
                    return;
                }

                const data = doc.data();
                // Check if my session still exists
                // We need to handle both flat keys and nested object structure

                let sessionExists = false;

                // Check nested object
                if (data.activeSessions && data.activeSessions[this.fingerprint]) {
                    sessionExists = true;
                }

                // Check flat keys (fallback)
                if (data[`activeSessions.${this.fingerprint}`]) {
                    sessionExists = true;
                }

                if (!sessionExists) {
                    console.warn("[SecurityOverlay] Remote termination detected! Session removed from server.");
                    this.terminate("Session Terminated Remotely");
                }
            });
        });
    }

    hardenUI() {
        // Disable Right Click
        document.addEventListener('contextmenu', e => e.preventDefault());

        // Disable DevTools shortcuts
        document.addEventListener('keydown', e => {
            if (
                e.key === 'F12' ||
                (e.ctrlKey && e.shiftKey && e.key === 'I') ||
                (e.ctrlKey && e.shiftKey && e.key === 'J') ||
                (e.ctrlKey && e.key === 'U')
            ) {
                e.preventDefault();
                console.warn("Security Alert: Debugging Attempt Logged.");
            }
        });
    }

    terminate(reason) {
        console.error("TERMINATING SESSION:", reason);

        // Clear heartbeat interval
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        if (this.sessionUnsubscribe) {
            this.sessionUnsubscribe();
            this.sessionUnsubscribe = null;
        }

        // Use LogoutHandler for proper cleanup
        LogoutHandler.performLogout(this.fingerprint, `Security Violation: ${reason}`).then(() => {
            // Show violation screen before redirect
            document.body.innerHTML = `
                <div style="background:black; color:red; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; font-family:monospace; text-align:center;">
                    <h1 style="font-size:3rem;">SECURITY VIOLATION</h1>
                    <p>${reason}</p>
                    <p>Referencing Incident ID: ${Date.now()}-${Math.floor(Math.random() * 1000)}</p>
                    <p>Your IP (${this.ip}) has been logged.</p>
                    <p style="margin-top: 20px; font-size: 0.9rem;">Redirecting to login...</p>
                </div>
            `;
            // Note: LogoutHandler will redirect, but we set a backup timeout
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 3000);
        }).catch((error) => {
            console.error('[SecurityOverlay] Terminate failed:', error);
            // Force redirect even if cleanup fails
            window.location.href = 'login.html';
        });
    }
}

// Initialize and expose globally for access by nav_controller
window.securityOverlay = new SecurityOverlay();
