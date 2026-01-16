import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, updateDoc, deleteField, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app } from './services/firebase_config.js';

const auth = getAuth(app);
const db = getFirestore(app);

/**
 * Centralized logout handler that properly cleans up sessions
 * and logs logout events for audit trail
 */
export class LogoutHandler {
    /**
     * Perform a complete logout with proper cleanup
     * @param {string} fingerprint - Device fingerprint
     * @param {string} reason - Reason for logout (for audit log)
     */
    static async performLogout(fingerprint, reason = 'User initiated logout') {
        const user = auth.currentUser;

        if (!user) {
            // Already logged out, just redirect
            console.log('[LogoutHandler] No user logged in, redirecting to login');
            window.location.href = 'login.html';
            return;
        }

        console.log(`[LogoutHandler] Starting logout for ${user.email}, reason: ${reason}`);
        console.log(`[LogoutHandler] Fingerprint provided: ${fingerprint}`);

        // If no fingerprint provided, try to get it from localStorage
        if (!fingerprint) {
            fingerprint = localStorage.getItem('deviceFingerprint');
            console.log(`[LogoutHandler] Retrieved fingerprint from localStorage: ${fingerprint}`);
        }

        try {
            // CRITICAL: Stop the heartbeat FIRST to prevent session recreation
            if (window.securityOverlay && window.securityOverlay.heartbeatInterval) {
                clearInterval(window.securityOverlay.heartbeatInterval);
                window.securityOverlay.heartbeatInterval = null;
                console.log('[LogoutHandler] ✅ Heartbeat stopped');
            }

            // Call server-side logout function
            const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js");
            const functions = getFunctions(app);
            const performLogoutFn = httpsCallable(functions, 'performLogout');

            console.log('[LogoutHandler] Calling server-side logout function...');
            await performLogoutFn({ fingerprint, reason });
            console.log('[LogoutHandler] ✅ Server-side logout successful');

            // Sign out from Firebase Auth
            await signOut(auth);
            console.log('[LogoutHandler] Firebase Auth signOut successful');

            // Clear any stored user data
            localStorage.removeItem('lastUserUid');
            localStorage.removeItem('deviceFingerprint');
            console.log('[LogoutHandler] Cleared localStorage data');

            // Redirect to login
            console.log('[LogoutHandler] Redirecting to login page...');
            window.location.href = 'login.html';

        } catch (error) {
            console.error('[LogoutHandler] Logout error:', error);

            // Even if cleanup fails, force logout for security
            try {
                // Stop heartbeat
                if (window.securityOverlay && window.securityOverlay.heartbeatInterval) {
                    clearInterval(window.securityOverlay.heartbeatInterval);
                    window.securityOverlay.heartbeatInterval = null;
                }

                await signOut(auth);
            } catch (signOutError) {
                console.error('[LogoutHandler] Force signOut also failed:', signOutError);
            }

            // Always redirect to login
            window.location.href = 'login.html';
        }
    }

    /**
     * Attempt to clean up a session without logging out
     * Used when detecting stale sessions or browser data clearing
     * @param {string} uid - User ID
     * @param {string} fingerprint - Device fingerprint
     */
    static async cleanupSessionOnly(uid, fingerprint) {
        if (!uid || !fingerprint) {
            console.warn('[LogoutHandler] Cannot cleanup session: missing uid or fingerprint');
            return;
        }

        try {
            const userRef = doc(db, 'users', uid);
            await updateDoc(userRef, {
                [`activeSessions.${fingerprint}`]: deleteField()
            });
            console.log(`[LogoutHandler] Cleaned up session for uid: ${uid}, fingerprint: ${fingerprint.substring(0, 8)}...`);
        } catch (error) {
            console.error('[LogoutHandler] Session cleanup failed:', error);
            // Don't throw - this is a best-effort cleanup
        }
    }
}
