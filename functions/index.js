const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
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
    const isDeveloper = email === 'fak.mzn@gmail.com';
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

            // Normalize phone number format
            let normalizedPhone = targetPhone.trim();

            // Remove any spaces, dashes, or parentheses
            normalizedPhone = normalizedPhone.replace(/[\s\-()]/g, '');

            // If phone doesn't start with + or country code, assume India (91)
            // Indian mobile numbers are 10 digits starting with 6-9
            if (!normalizedPhone.startsWith('+') && !normalizedPhone.startsWith('91')) {
                // Check if it looks like an Indian mobile number (10 digits starting with 6-9)
                if (/^[6-9]\d{9}$/.test(normalizedPhone)) {
                    normalizedPhone = '91' + normalizedPhone;
                    console.log(`Auto-prepended country code 91 to phone number`);
                }
            }

            // Ensure + prefix for Firebase Auth
            const phoneToLookup = normalizedPhone.startsWith('+') ? normalizedPhone : `+${normalizedPhone}`;

            console.log(`Looking up user by phone: ${phoneToLookup}`);

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
// LOGOUT FUNCTION
// ============================================================================

/**
 * Server-side logout function
 * Handles session cleanup and audit logging
 */
exports.performLogout = onCall(async (request) => {
    const { fingerprint, reason } = request.data;

    // Must be authenticated
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to logout');
    }

    const uid = request.auth.uid;
    const email = request.auth.token.email;

    console.log(`[performLogout] Processing logout for ${email}, fingerprint: ${fingerprint}`);

    try {
        const db = admin.firestore();

        // 1. Log LOGOUT event
        await db.collection('user_activity_logs').add({
            uid: uid,
            email: email,
            action: 'LOGOUT',
            reason: reason || 'User initiated logout',
            deviceFingerprint: fingerprint || 'unknown',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[performLogout] LOGOUT event logged for ${email}`);

        // 2. Clean up Firestore session
        if (fingerprint) {
            const userRef = db.collection('users').doc(uid);
            await userRef.update({
                [`activeSessions.${fingerprint}`]: admin.firestore.FieldValue.delete()
            });
            console.log(`[performLogout] Session ${fingerprint} deleted for ${email}`);
        }

        return { success: true, message: 'Logout successful' };

    } catch (error) {
        console.error(`[performLogout] Error during logout:`, error);
        throw new HttpsError('internal', `Logout failed: ${error.message}`);
    }
});

// ============================================================================
// SESSION CLEANUP FUNCTION
// ============================================================================

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
    const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours

    usersSnapshot.forEach(doc => {
        const data = doc.data();
        const updates = {};

        // Check if activeSessions exists and is an object
        if (data.activeSessions && typeof data.activeSessions === 'object') {
            // Iterate through each session in the activeSessions map
            Object.keys(data.activeSessions).forEach(fingerprint => {
                const sessionData = data.activeSessions[fingerprint];

                if (sessionData && sessionData.lastActiveAt) {
                    const lastActive = sessionData.lastActiveAt.toMillis();
                    const inactiveTime = now - lastActive;

                    if (inactiveTime > staleThreshold) {
                        // Mark this specific session for deletion
                        updates[`activeSessions.${fingerprint}`] = admin.firestore.FieldValue.delete();
                        cleanedCount++;
                        console.log(`[cleanupStaleSessions] Marking session ${fingerprint} for deletion (inactive for ${Math.round(inactiveTime / 3600000)} hours)`);
                    }
                }
            });
        }

        if (Object.keys(updates).length > 0) {
            batch.update(doc.ref, updates);
            userCount++;
        }
    });

    if (cleanedCount > 0) {
        await batch.commit();
        console.log(`[cleanupStaleSessions] ✅ Cleaned up ${cleanedCount} stale sessions from ${userCount} users`);

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

// ============================================================================
// TRANSLATION FUNCTION
// ============================================================================

const { Translate } = require('@google-cloud/translate').v2;

/**
 * Translates text using Google Cloud Translation API
 * Input: { text: string, targetLanguage: string }
 * Output: { translatedText: string }
 */
exports.translateText = onCall(async (request) => {
    // Lazy load outside global scope
    const translate = new Translate();

    // 1. Authentication Check
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to use translation services.');
    }

    const { text, targetLanguage } = request.data;

    // 2. Validation
    if (!text || !targetLanguage) {
        throw new HttpsError('invalid-argument', 'Text and targetLanguage are required.');
    }

    try {
        // 3. Perform Translation
        // Result is [translation, metadata]
        let [translations] = await translate.translate(text, targetLanguage);

        // Ensure we handle array or single string return based on input
        translations = Array.isArray(translations) ? translations[0] : translations;

        console.log(`[translateText] Translated "${text.substring(0, 20)}..." to ${targetLanguage} for ${request.auth.email}`);

        return { translatedText: translations };

    } catch (error) {
        console.error('[translateText] Translation failed:', error);
        throw new HttpsError('internal', `Translation failed: ${error.message}`);
    }
});

// ============================================================================
// MEDIA PASSKEY AUTH
// ============================================================================

/**
 * Verifies the shared passkey and returns a custom Auth Token
 * used for public media access
 */
exports.verifyMediaPasskey = onCall({ cors: true }, async (request) => {
    // 1. Validate Input
    const { passkey } = request.data;
    if (!passkey) {
        throw new HttpsError('invalid-argument', 'Passkey required.');
    }

    // 2. Check Passkey
    // In production, this should be in an environment variable (e.g. process.env.MEDIA_PASSKEY)
    // For now, hardcoding as agreed in plan
    const CORRECT_PASSKEY = "YesMedia2024!";

    if (passkey !== CORRECT_PASSKEY) {
        // Log the failed attempt for security auditing
        console.warn(`[verifyMediaPasskey] Failed attempt with passkey: ${passkey.substring(0, 3)}***`);
        throw new HttpsError('permission-denied', 'Invalid Passkey.');
    }

    // 3. Mint Custom Token
    // We create a "virtual" user UID. 
    // It's better to use a random UID each time so sessions are unique 
    // and we don't hit rate limits on a single UID.
    const uniqueSessionId = `media-viewer-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    try {
        const customClaims = {
            role: 'media_viewer',
            restricted: true,
            trustedDevice: true // Bypass the security overlay check naturally
        };

        const token = await admin.auth().createCustomToken(uniqueSessionId, customClaims);
        console.log(`[verifyMediaPasskey] Generated token for session: ${uniqueSessionId}`);

        return { token };

    } catch (e) {
        console.error('[verifyMediaPasskey] Token creation failed:', e);
        throw new HttpsError('internal', 'Auth Token Generation Failed');
    }
});

// ============================================================================
// AUTOMATED CAMPAIGN REPORTS
// ============================================================================

/**
 * Triggered when a campaign document is updated.
 * Checks if status changes to 'completed' and sends an email report.
 */
exports.onCampaignCompleted = onDocumentUpdated({
    document: "campaigns/{campaignId}",
    secrets: [smtpEmail, smtpPassword, smtpHost, smtpPort, smtpUser]
}, async (event) => {
    const newData = event.data.after.data();
    const previousData = event.data.before.data();

    // Only email if status changed to 'completed'
    // Also handle case where it was already completed but updated (we likely don't want to spam, so strict check)
    if (previousData.status === 'completed' || newData.status !== 'completed') {
        return;
    }

    const campaignId = event.params.campaignId;
    const campaignName = newData.name || 'Untitled Campaign';
    const stats = newData.stats || { sent: 0, delivered: 0, read: 0, failed: 0, total: 0 };

    console.log(`[onCampaignCompleted] Campaign ${campaignId} completed. Sending report...`);

    try {
        const transporter = nodemailer.createTransport({
            host: smtpHost.value(),
            port: parseInt(smtpPort.value()),
            secure: parseInt(smtpPort.value()) === 465,
            auth: {
                user: smtpUser.value(),
                pass: smtpPassword.value()
            }
        });

        // Fetch detailed items for the report
        const itemsSnapshot = await admin.firestore()
            .collection('campaigns')
            .doc(campaignId)
            .collection('items')
            .orderBy('sentAt', 'desc') // effective ordering
            .limit(500) // Safety limit for email size
            .get();

        const items = itemsSnapshot.docs.map(doc => doc.data());

        const { generateCampaignReportHtml } = require('./templates/campaignReport');
        // Pass newData (as campaignData) and items
        const htmlContent = generateCampaignReportHtml(campaignName, stats, campaignId, newData, items);

        const recipients = [
            "fak.mzn@gmail.com",
            "mhdfazalvs@gmail.com"
        ];

        await transporter.sendMail({
            from: `"Campaign Manager" <${smtpEmail.value()}>`,
            to: recipients.join(', '), // Send to all recipients
            subject: `Campaign Report: ${campaignName}`,
            html: htmlContent
        });

        console.log(`[onCampaignCompleted] Report sent to fak.mzn@gmail.com for ${campaignId}`);

    } catch (error) {
        console.error('[onCampaignCompleted] Failed to send email report:', error);
    }
});
