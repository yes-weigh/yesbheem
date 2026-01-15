import { app } from './services/firebase_config.js';
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
                } catch (e) {
                    console.error("[SecurityOverlay] Token verification error:", e);
                    this.terminate("Auth Verification Failed");
                    return;
                }
            } else {
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

        signOut(auth).then(() => {
            // Create a scary violation screen
            document.body.innerHTML = `
                <div style="background:black; color:red; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; font-family:monospace; text-align:center;">
                    <h1 style="font-size:3rem;">SECURITY VIOLATION</h1>
                    <p>${reason}</p>
                    <p>Referencing Incident ID: ${Date.now()}-${Math.floor(Math.random() * 1000)}</p>
                    <p>Your IP (${this.ip}) has been logged.</p>
                </div>
            `;
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 3000);
        });
    }
}

// Initialize
new SecurityOverlay();
