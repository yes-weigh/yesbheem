import { app } from './services/firebase_config.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import { getAuth, signInWithCustomToken, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const functions = getFunctions(app, 'us-central1');
const auth = getAuth(app);


export class AuthFortress {
    constructor() {
        this.fingerprint = null;
        this.initFingerprint();
    }

    async initFingerprint() {
        // Initialize FingerprintJS
        const fpPromise = import('https://openfpcdn.io/fingerprintjs/v4')
            .then(FingerprintJS => FingerprintJS.load());
        const fp = await fpPromise;
        const result = await fp.get();
        this.fingerprint = result.visitorId;
        console.log("Hardware Identity Secured:", this.fingerprint);
    }

    async initiateLogin(email, phone) {
        if (!this.fingerprint) {
            await this.initFingerprint();
        }

        // 1. Backend Authorization Check (Handled by Cloud Function)
        return new Promise(async (resolve, reject) => {
            try {
                const sendDualSplitOTP = httpsCallable(functions, 'sendDualSplitOTP');
                await sendDualSplitOTP({
                    email: email,
                    phoneNumber: phone,
                    deviceFingerprint: this.fingerprint
                });
                resolve({ success: true, message: "Secure channels established. Dispatching dual-keys." });
            } catch (error) {
                console.error("Dispatch Failed:", error);
                reject(error);
            }
        });
    }

    async verifyAndSession(email, codeA, codeB) {
        if (!this.fingerprint) {
            await this.initFingerprint();
        }

        try {
            const verifySplitOTP = httpsCallable(functions, 'verifySplitOTP');
            const result = await verifySplitOTP({
                email: email,
                codeA: codeA,
                codeB: codeB,
                deviceFingerprint: this.fingerprint
            });

            if (result.data.token) {
                // Sign in with the custom token
                const userCredential = await signInWithCustomToken(auth, result.data.token);
                const idTokenResult = await userCredential.user.getIdTokenResult();

                // Check for trustedDevice claim
                if (idTokenResult.claims.trustedDevice) {
                    return { success: true, user: userCredential.user, isTrusted: true };
                } else {
                    // This shouldn't happen if the token was minted correctly by verifySplitOTP
                    throw new Error("Security Violation: Token lacks hardware trust signature.");
                }
            } else {
                throw new Error("Handshake Failed: No token received.");
            }
        } catch (error) {
            console.error("Verification Failed:", error);
            throw error;
        }
    }

    logout() {
        return signOut(auth);
    }
}
