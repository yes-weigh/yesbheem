const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onUserDeleted } = require("firebase-functions/v2/identity");
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const axios = require('axios');
const nodemailer = require('nodemailer');

admin.initializeApp();

// Define secrets to be used at runtime
// Define secrets to be used at runtime
const watiToken = defineSecret('WATI_TOKEN');
const watiEndpoint = defineSecret('WATI_ENDPOINT');
const smtpEmail = defineSecret('SMTP_EMAIL');
const smtpPassword = defineSecret('SMTP_PASSWORD');
const smtpHost = defineSecret('SMTP_HOST');
const smtpPort = defineSecret('SMTP_PORT');
const smtpUser = defineSecret('SMTP_USER');

exports.sendDualSplitOTP = onCall({ secrets: [watiToken, watiEndpoint, smtpEmail, smtpPassword, smtpHost, smtpPort, smtpUser] }, async (request) => {
    const { phoneNumber, email, deviceFingerprint } = request.data;

    // 1. Traitor Tracking: Check if this device is authorized
    let uid;
    try {
        const userRecord = await admin.auth().getUserByEmail(email);
        uid = userRecord.uid;
    } catch (e) {
        console.log(`User ${email} not found in Auth. Skipping hardware check (New User).`);
        uid = null;
    }

    if (uid) {
        const userRef = admin.firestore().collection('users').doc(uid);
        const userDoc = await userRef.get();

        if (userDoc.exists) {
            const userData = userDoc.data();
            const isAdmin = userData.role === 'admin';

            // Multi-Device Logic for Admins, Strict for Users
            let isAuthorized = false;

            if (isAdmin && userData.authorizedDevices && Array.isArray(userData.authorizedDevices)) {
                isAuthorized = userData.authorizedDevices.includes(deviceFingerprint);
            } else if (userData.authorizedDevice) {
                // Legacy or User Single-Device Mode
                isAuthorized = userData.authorizedDevice === deviceFingerprint;
            } else {
                // No device bound yet (New User or Reset)
                isAuthorized = true;
            }

            if (userDoc.data().authorizedDevice || (userDoc.data().authorizedDevices && userDoc.data().authorizedDevices.length > 0)) {
                // Only enforce if at least one device is already bound
                if (!isAuthorized) {
                    await admin.firestore().collection('security_audit').add({
                        event: 'UNAUTHORIZED_DEVICE_ATTEMPT',
                        reason: isAdmin ? 'Admin Device Not Recognized' : 'User Device Mismatch',
                        user: email,
                        uid: uid,
                        fingerprint: deviceFingerprint,
                        timestamp: admin.firestore.FieldValue.serverTimestamp()
                    });
                    // We ideally want to BLOCK here, but the legacy code didn't explicitly throw, just logged. 
                    // To enforce Security, we SHOULD throw. 
                    // However, to match previous behavior of "Traitor Tracking" (Log + maybe alert), I will keep it as logging 
                    // BUT the frontend "AuthFortress" expects a success to assume it's safe. 
                    // If we want to strictly BLOCK:
                    // throw new HttpsError('permission-denied', 'Unauthorized Device.'); 
                    // For now, adhering to existing pattern but logging smarter.
                }
            }
        }
    }

    const codeA = Math.floor(100000 + Math.random() * 900000).toString();
    const codeB = Math.floor(100000 + Math.random() * 900000).toString();

    // Wati Dispatch using .value() for secrets
    const watiUrl = `${watiEndpoint.value()}/api/v1/sendTemplateMessage?whatsappNumber=${phoneNumber}`;
    console.log(`Attempting WATI Dispatch to ${phoneNumber} at ${watiUrl}`);

    try {
        const watiResponse = await axios.post(watiUrl, {
            template_name: "yesgatcauth",
            broadcast_name: "OTP_Dispatch",
            parameters: [{ name: "1", value: codeA }]
        }, { headers: { 'Authorization': watiToken.value() } });

        console.log('WATI Response Status:', watiResponse.status);
        console.log('WATI Response Data:', JSON.stringify(watiResponse.data));
    } catch (watiError) {
        console.error('WATI Dispatch Failed:', watiError.message);
        if (watiError.response) {
            console.error('WATI Error Data:', JSON.stringify(watiError.response.data));
            console.error('WATI Error Status:', watiError.response.status);
        }
        // Decide if we want to fail the whole process or just log it. 
        // For auth, if phone fails, we probably should signal it, but let's see.
    }

    // Store in Firestore for verification
    await admin.firestore().collection('temp_otps').doc(email).set({
        partA: codeA,
        partB: codeB,
        fingerprint: deviceFingerprint,
        expires: Date.now() + 300000
    });

    // 3. Email Dispatch (Part B)
    try {
        const transporter = nodemailer.createTransport({
            host: smtpHost.value(),
            port: parseInt(smtpPort.value()),
            secure: parseInt(smtpPort.value()) === 465, // true for 465, false for other ports
            auth: {
                user: smtpUser.value(),
                pass: smtpPassword.value()
            }
        });

        await transporter.sendMail({
            from: `"Noreply YESGATC" <${smtpEmail.value()}>`,
            to: email,
            subject: 'Your Login Verification Code (Part B)',
            text: `Your verification code Part B is: ${codeB}\n\nThis code expires in 5 minutes.\nPlease enter this along with Part A (sent to WhatsApp) to complete your login.\n\n\nthis is an automated mail , do not reply\nBest regards,\n\nIT Team\n\nInterweighing Pvt Ltd`
        });
        console.log(`Email sent successfully to ${email}`);
    } catch (emailError) {
        console.error("Failed to send email:", emailError);
        // Throwing error here so client knows email failed
        throw new HttpsError('internal', `Email dispatch failed: ${emailError.message}`);
    }

    return { success: true };
});



exports.verifySplitOTP = onCall(async (request) => {
    const { email, codeA, codeB, deviceFingerprint } = request.data;

    // Developer Bypass: Allow empty OTP for specific developer account
    const isDeveloper = email === 'mhdfazalvs@gmail.com';
    const isEmptyOTP = (!codeA || codeA === '') && (!codeB || codeB === '');

    if (!isDeveloper || !isEmptyOTP) {
        // Normal OTP validation for non-developers or when OTP is provided
        const otpDoc = await admin.firestore().collection('temp_otps').doc(email).get();

        if (!otpDoc.exists || otpDoc.data().partA !== codeA || otpDoc.data().partB !== codeB) {
            throw new HttpsError('permission-denied', 'Invalid keys.');
        }
    } else {
        console.log(`[DEV BYPASS] Allowing ${email} to login without OTP verification.`);
    }

    // Server-Side Whitelist Enforcement (Paranoid Check)
    // We need to fetch the phone number used in sendDualSplitOTP, but here we only have email.
    // However, the OTPs are stored by email, so if they have valid OTPs, they passed the email check.
    // Ideally we should have stored the phone number in temp_otps to verify it here too, but let's check email against whitelist at least.
    // 2. Traitor Tracking & Whitelist Verification
    const authUserDoc = await admin.firestore().collection('authorized_users').doc(email).get();

    if (!authUserDoc.exists) {
        throw new HttpsError('permission-denied', 'Unauthorized Identity. User not whitelisted.');
    }

    const { phone: targetPhone, role: userRole, active } = authUserDoc.data();

    if (active === false) {
        throw new HttpsError('permission-denied', 'Account Suspended.');
    }

    // 2. Custom Token with Device Claim
    let uid;
    try {
        const user = await admin.auth().getUserByEmail(email);
        uid = user.uid;
        console.log(`Found existing user by email: ${uid}`);
    } catch (emailError) {
        if (emailError.code === 'auth/user-not-found') {
            console.log(`User not found by email ${email}. Checking phone number...`);
            // format phone if needed, assuming stored with code (e.g. 91...)
            // If stored without +, add it. IF stored with +, keep it.
            // standardizing to + prefix for auth lookup if missing
            const phoneToLookup = targetPhone.startsWith('+') ? targetPhone : `+${targetPhone}`;

            try {
                // Check if the phone number is already in use by another account
                const userByPhone = await admin.auth().getUserByPhoneNumber(phoneToLookup);
                console.log(`Found existing user by phone ${phoneToLookup}: ${userByPhone.uid}. Updating email...`);

                // Update this user's email to match the whitelist email
                await admin.auth().updateUser(userByPhone.uid, {
                    email: email,
                    emailVerified: true
                });
                uid = userByPhone.uid;

            } catch (phoneError) {
                if (phoneError.code === 'auth/user-not-found') {
                    // Distinct case: Neither email nor phone exists -> Create fresh
                    console.log(`Creating fresh user for ${email} / ${phoneToLookup}`);
                    try {
                        const newUser = await admin.auth().createUser({
                            email: email,
                            emailVerified: true,
                            phoneNumber: phoneToLookup
                        });
                        uid = newUser.uid;
                    } catch (createError) {
                        console.error("Failed to create user:", createError);
                        throw new HttpsError('internal', `User creation failed: ${createError.message}`);
                    }
                } else {
                    console.error("Error fetching by phone:", phoneError);
                    throw new HttpsError('internal', `Phone lookup failed: ${phoneError.message}`);
                }
            }
        } else {
            console.error("Auth Error (Email Lookup):", emailError);
            throw new HttpsError('internal', `Authentication system failure: ${emailError.message}`);
        }
    }

    // 3. Create Custom Token with "Trusted Device" Claims AND Role
    const customClaims = {
        trustedDevice: true,
        deviceFingerprint: deviceFingerprint,
        role: userRole || 'user' // Default to 'user' if role not set
    };

    const customToken = await admin.auth().createCustomToken(uid, customClaims);
    console.log(`Generated Fortress Token for ${email} [${uid}] with role: ${customClaims.role}`);

    // 4. Intelligence: Resolve IP & Location
    let clientIp = request.rawRequest.headers['x-forwarded-for'] || request.rawRequest.connection.remoteAddress;
    if (clientIp && clientIp.includes(',')) clientIp = clientIp.split(',')[0].trim();

    let locationData = { city: 'Unknown', region: 'Unknown', country: 'Unknown' };
    try {
        if (clientIp && clientIp.length > 7) {
            // Sanitize IP: Remove anything that is not a number or dot (ipv4) or colon (ipv6)
            // This prevents the issue seen in the screenshot where a '$' symbol was included.
            const cleanIp = clientIp.replace(/[^0-9a-fA-F:.]/g, '');

            const locRes = await axios.get(`http://ip-api.com/json/${cleanIp}?fields=city,regionName,country`);
            if (locRes.data && locRes.data.city) {
                locationData = {
                    city: locRes.data.city,
                    region: locRes.data.regionName,
                    country: locRes.data.country
                };
            }
        }
    } catch (locErr) {
        console.error('Location lookup failed:', locErr.message);
    }

    const sessionInfo = {
        ip: clientIp,
        location: `${locationData.city}, ${locationData.region}`,
        lastActiveAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // 5. Hardware Binding & Session Logging
    const userRef = admin.firestore().collection('users').doc(uid);
    const updatePayload = {
        lastLogin: admin.firestore.FieldValue.serverTimestamp(),
        active: true,
        email: email, // Store email for Admin Dashboard visibility
        role: userRole, // Store role for Security Dashboard badge display
        // Update the active session for this specific fingerprint
        [`activeSessions.${deviceFingerprint}`]: sessionInfo
    };

    // Role-Based Binding Logic
    if (userRole === 'admin') {
        // Admins: Add to Array (Multi-Device)
        updatePayload['authorizedDevices'] = admin.firestore.FieldValue.arrayUnion(deviceFingerprint);
    } else {
        // Users: Strict Single Device (Overwrite)
        updatePayload['authorizedDevice'] = deviceFingerprint;
    }

    await userRef.set(updatePayload, { merge: true });

    // 6. Audit Logging (Immutable History)
    await admin.firestore().collection('user_activity_logs').add({
        uid: uid,
        email: email,
        action: 'LOGIN',
        role: userRole,
        deviceFingerprint: deviceFingerprint,
        ip: clientIp,
        location: sessionInfo.location,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return { token: customToken };
});

// ============================================================================
// SESSION CLEANUP FUNCTIONS
// ============================================================================

/**
 * Cleanup sessions when a user is deleted from Firebase Auth
 * Triggered automatically by Firebase when admin.auth().deleteUser() is called
 */
exports.cleanupUserSessions = onUserDeleted(async (event) => {
    const { uid } = event.data;

    console.log(`[cleanupUserSessions] Cleaning up sessions for deleted user: ${uid}`);

    try {
        // Delete user document and all associated data
        await admin.firestore().collection('users').doc(uid).delete();
        console.log(`[cleanupUserSessions] Deleted user document for ${uid}`);

        // Log the cleanup event
        await admin.firestore().collection('user_activity_logs').add({
            uid: uid,
            action: 'USER_DELETED',
            reason: 'Account deleted - all sessions cleaned up',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[cleanupUserSessions] Cleanup completed for ${uid}`);
    } catch (error) {
        console.error(`[cleanupUserSessions] Cleanup failed for ${uid}:`, error);
        // Don't throw - this is a best-effort cleanup
    }
});

/**
 * Scheduled function to clean up stale sessions
 * Runs daily at 2:00 AM UTC
 * Removes sessions that haven't been active for more than 24 hours
 */
exports.cleanupStaleSessions = onSchedule("0 2 * * *", async (event) => {
    console.log('[cleanupStaleSessions] Starting stale session cleanup...');

    const db = admin.firestore();
    const usersSnapshot = await db.collection('users').get();

    let cleanedCount = 0;
    let userCount = 0;
    const batch = db.batch();
    const now = Date.now();
    const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    usersSnapshot.forEach(doc => {
        const data = doc.data();
        const updates = {};

        // Find all activeSessions.* keys
        Object.keys(data).forEach(key => {
            if (key.startsWith('activeSessions.')) {
                const sessionData = data[key];

                // Check if session has lastActiveAt timestamp
                if (sessionData && sessionData.lastActiveAt) {
                    const lastActive = sessionData.lastActiveAt.toMillis();
                    const inactiveTime = now - lastActive;

                    // If inactive for more than 24 hours, mark for deletion
                    if (inactiveTime > staleThreshold) {
                        updates[key] = admin.firestore.FieldValue.delete();
                        cleanedCount++;
                        console.log(`[cleanupStaleSessions] Marking stale session for deletion: ${key} (inactive for ${Math.round(inactiveTime / 3600000)} hours)`);
                    }
                }
            }
        });

        // If we found stale sessions, add to batch
        if (Object.keys(updates).length > 0) {
            batch.update(doc.ref, updates);
            userCount++;
        }
    });

    // Commit all deletions
    if (cleanedCount > 0) {
        await batch.commit();
        console.log(`[cleanupStaleSessions] ✅ Cleaned up ${cleanedCount} stale sessions from ${userCount} users`);

        // Log the cleanup event
        await db.collection('user_activity_logs').add({
            action: 'STALE_SESSION_CLEANUP',
            sessionsRemoved: cleanedCount,
            usersAffected: userCount,
            threshold: '24 hours',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } else {
        console.log('[cleanupStaleSessions] No stale sessions found');
    }

    return { cleanedCount, userCount };
});