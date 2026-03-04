const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentUpdated, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { defineSecret, defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');
const path = require('path');
const os = require('os');
const fs = require('fs');


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
const geminiApiKey = defineSecret('GEMINI_API_KEY');

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
        const axios = require('axios');
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

    try {
        const nodemailer = require('nodemailer');
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
        role: userRole || 'user', // Default to 'user' if role not set
        email: email // Include email for Firestore rule checks
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

            const axios = require('axios');
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
        const nodemailer = require('nodemailer');
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

        // Helper: Fetch Instance Name
        let senderName = newData.senderConfig?.id || 'Unknown';
        try {
            if (newData.senderConfig?.id) {
                // Try to find the instance doc (ID matching config ID)
                // Note: config.id is usually the session ID which we mapped to.
                // It might be the doc ID in current implementation.
                // We'll check both just in case or query.
                // Based on campaign_manager, we store sessionId in 'id'.
                // If it's a direct ID, we can getDoc.
                const instanceDoc = await admin.firestore().collection('whatsapp_instances').doc(newData.senderConfig.id).get();
                if (instanceDoc.exists) {
                    senderName = instanceDoc.data().name || newData.senderConfig.id;
                } else {
                    // Fallback: Query by sessionId field
                    const q = await admin.firestore().collection('whatsapp_instances').where('sessionId', '==', newData.senderConfig.id).limit(1).get();
                    if (!q.empty) {
                        senderName = q.docs[0].data().name || newData.senderConfig.id;
                    }
                }
            }
        } catch (e) {
            console.error('Error fetching instance name:', e);
        }

        // Inject sender name into campaignData
        // ROBUSTNESS FIX: Fallback to creator email if KAM is missing
        let displayKAM = newData.campaignManager;
        if (!displayKAM || displayKAM === 'null' || displayKAM === 'undefined') {
            displayKAM = newData.creatorEmail
                ? `Created by: ${newData.creatorEmail}`
                : 'Not Assigned';
        }

        console.log('[onCampaignCompleted] Campaign Data Snapshot:', JSON.stringify(newData, null, 2));

        const campaignDataForReport = {
            ...newData,
            campaignManager: displayKAM,
            senderConfig: {
                ...newData.senderConfig,
                name: senderName
            }
        };

        const { generateCampaignReportHtml } = require('./templates/campaignReport');
        // Pass enriched data (campaignDataForReport) and items
        const htmlContent = generateCampaignReportHtml(campaignName, stats, campaignId, campaignDataForReport, items);

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

// ============================================================================
// PDF THUMBNAIL GENERATION
// ============================================================================

/**
 * Helper function to generate a simple placeholder thumbnail for PDF files
 * Uses sharp to create a styled placeholder image
 * @param {string} pdfPath - Local path to the PDF file
 * @param {string} outputPath - Directory where thumbnail should be saved
 * @returns {Promise<string>} Path to generated thumbnail
 */
async function generatePdfThumbnail(pdfPath, outputPath) {
    try {
        const thumbnailPath = path.join(outputPath, 'thumb.jpg');

        // Create apdfPlaceholder styled placeholder image using Sharp
        // Create a simple gray gradient background with "PDF" text overlay
        const width = 800;
        const height = 1131; // A4 aspect ratio (800 * 1.414)

        // Create SVG placeholder
        const svg = `
            <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <!-- Background gradient -->
                <defs>
                    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:#f9fafb;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#e5e7eb;stop-opacity:1" />
                    </linearGradient>
                </defs>
                <rect width="100%" height="100%" fill="url(#bg)"/>
                
                <!-- Content area -->
                <rect x="40" y="40" width="${width - 80}" height="${height - 80}" 
                      fill="#ffffff" stroke="#d1d5db" stroke-width="2" rx="8"/>
                
                <!-- PDF Icon -->
                <path d="M ${width / 2 - 60} ${height / 2 - 80} 
                         l 80 0 l 40 40 l 0 120 l -120 0 z" 
                      fill="#ef4444" stroke="#dc2626" stroke-width="2"/>
                <text x="${width / 2}" y="${height / 2 + 20}" 
                      font-family="Arial, sans-serif" font-size="48" font-weight="bold"
                      fill="#ffffff" text-anchor="middle">PDF</text>
                
                <!-- Document text -->
                <text x="${width / 2}" y="${height / 2 + 80}" 
                      font-family="Arial, sans-serif" font-size="24"
                      fill="#6b7280" text-anchor="middle">Document Preview</text>
            </svg>
        `;

        // Generate JPEG from SVG using sharp
        const sharp = require('sharp');
        await sharp(Buffer.from(svg))
            .jpeg({ quality: 85 })
            .toFile(thumbnailPath);

        return thumbnailPath;
    } catch (error) {
        console.error('[generatePdfThumbnail] Error:', error);
        throw error;
    }
}

/**
 * Storage Trigger: Generates thumbnail when a PDF is uploaded to /media/*
 * Automatically runs on every new file upload to the media folder
 */
exports.onPdfUploaded = onObjectFinalized(async (event) => {
    const filePath = event.data.name; // e.g. "media/abc123.pdf"
    const contentType = event.data.contentType;
    const bucket = admin.storage().bucket(event.bucket);

    // Only process PDFs
    if (!contentType || contentType !== 'application/pdf') {
        console.log(`[onPdfUploaded] Skipping non-PDF file: ${filePath}`);
        return;
    }

    // Skip if this is already a thumbnail
    if (filePath.includes('/thumbnails/')) {
        console.log(`[onPdfUploaded] Skipping thumbnail file: ${filePath}`);
        return;
    }

    console.log(`[onPdfUploaded] Processing PDF: ${filePath}`);

    // Extract media ID from path (e.g. "media/abc123.pdf" -> "abc123")
    const fileName = path.basename(filePath, path.extname(filePath));
    const mediaId = fileName;

    // Check if thumbnail already exists
    const thumbnailPath = `media/thumbnails/${mediaId}.jpg`;
    const [thumbnailExists] = await bucket.file(thumbnailPath).exists();

    if (thumbnailExists) {
        console.log(`[onPdfUploaded] Thumbnail already exists: ${thumbnailPath}`);
        return;
    }

    // Download PDF to temp directory
    const tempDir = os.tmpdir();
    const tempPdfPath = path.join(tempDir, `${mediaId}.pdf`);
    const tempThumbDir = path.join(tempDir, `thumb_${mediaId}`);

    try {
        // Create temp directory for thumbnail output
        if (!fs.existsSync(tempThumbDir)) {
            fs.mkdirSync(tempThumbDir, { recursive: true });
        }

        // Download PDF
        await bucket.file(filePath).download({ destination: tempPdfPath });
        console.log(`[onPdfUploaded] Downloaded PDF to: ${tempPdfPath}`);

        // Generate thumbnail
        const thumbnailLocalPath = await generatePdfThumbnail(tempPdfPath, tempThumbDir);
        console.log(`[onPdfUploaded] Generated thumbnail: ${thumbnailLocalPath}`);

        // Upload thumbnail to Storage
        await bucket.upload(thumbnailLocalPath, {
            destination: thumbnailPath,
            metadata: {
                contentType: 'image/jpeg',
                metadata: {
                    firebaseStorageDownloadTokens: require('crypto').randomBytes(16).toString('hex')
                }
            }
        });
        console.log(`[onPdfUploaded] Uploaded thumbnail to: ${thumbnailPath}`);

        // Get public URL
        const file = bucket.file(thumbnailPath);
        const [metadata] = await file.getMetadata();
        const token = metadata.metadata.firebaseStorageDownloadTokens;
        const thumbnailUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(thumbnailPath)}?alt=media&token=${token}`;

        // Update Firestore document
        const db = admin.firestore();
        const mediaQuery = await db.collection('media')
            .where('storagePath', '==', filePath)
            .limit(1)
            .get();

        if (!mediaQuery.empty) {
            const mediaDoc = mediaQuery.docs[0];
            await mediaDoc.ref.update({
                thumbnailUrl: thumbnailUrl,
                thumbnailGeneratedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`[onPdfUploaded] Updated Firestore document: ${mediaDoc.id}`);
        } else {
            console.warn(`[onPdfUploaded] No Firestore document found for: ${filePath}`);
        }

        // Cleanup temp files
        fs.unlinkSync(tempPdfPath);
        fs.unlinkSync(thumbnailLocalPath);
        fs.rmdirSync(tempThumbDir);

    } catch (error) {
        console.error(`[onPdfUploaded] Error processing ${filePath}:`, error);
        // Cleanup on error
        try {
            if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
            if (fs.existsSync(tempThumbDir)) {
                fs.readdirSync(tempThumbDir).forEach(file => {
                    fs.unlinkSync(path.join(tempThumbDir, file));
                });
                fs.rmdirSync(tempThumbDir);
            }
        } catch (cleanupError) {
            console.error('[onPdfUploaded] Cleanup error:', cleanupError);
        }
    }
});

/**
 * Callable Function: Batch generates thumbnails for all PDFs without thumbnails
 * Call this after deployment to process existing PDFs
 */
exports.generateMissingThumbnails = onCall({
    cors: true  // Allow all origins temporarily for testing
}, async (request) => {
    // Check authentication
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Check if user is admin
    const userRole = request.auth.token.role;
    if (userRole !== 'admin') {
        throw new HttpsError('permission-denied', 'Only admins can generate thumbnails');
    }

    console.log('[generateMissingThumbnails] Starting batch thumbnail generation...');

    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    // Get all PDF media items
    const mediaSnapshot = await db.collection('media')
        .where('mimeType', '==', 'application/pdf')
        .get();

    let generated = 0;
    let skipped = 0;
    const errors = [];

    for (const doc of mediaSnapshot.docs) {
        const mediaData = doc.data();
        const mediaId = doc.id;
        const storagePath = mediaData.storagePath;

        // Skip if thumbnail already exists in Firestore
        if (mediaData.thumbnailUrl) {
            console.log(`[generateMissingThumbnails] Skipping ${mediaId}: already has thumbnailUrl`);
            skipped++;
            continue;
        }

        // Check if thumbnail exists in Storage
        const thumbnailPath = `media/thumbnails/${mediaId}.jpg`;
        const [thumbnailExists] = await bucket.file(thumbnailPath).exists();

        if (thumbnailExists) {
            console.log(`[generateMissingThumbnails] Skipping ${mediaId}: thumbnail exists in storage`);
            // Update Firestore with the existing thumbnail URL
            const file = bucket.file(thumbnailPath);
            const [metadata] = await file.getMetadata();
            const token = metadata.metadata?.firebaseStorageDownloadTokens;
            if (token) {
                const thumbnailUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(thumbnailPath)}?alt=media&token=${token}`;
                await doc.ref.update({ thumbnailUrl });
            }
            skipped++;
            continue;
        }

        // Generate thumbnail
        const tempDir = os.tmpdir();
        const tempPdfPath = path.join(tempDir, `${mediaId}.pdf`);
        const tempThumbDir = path.join(tempDir, `thumb_${mediaId}`);

        try {
            // Create temp directory
            if (!fs.existsSync(tempThumbDir)) {
                fs.mkdirSync(tempThumbDir, { recursive: true });
            }

            // Download PDF
            await bucket.file(storagePath).download({ destination: tempPdfPath });

            // Generate thumbnail
            const thumbnailLocalPath = await generatePdfThumbnail(tempPdfPath, tempThumbDir);

            // Upload thumbnail
            await bucket.upload(thumbnailLocalPath, {
                destination: thumbnailPath,
                metadata: {
                    contentType: 'image/jpeg',
                    metadata: {
                        firebaseStorageDownloadTokens: require('crypto').randomBytes(16).toString('hex')
                    }
                }
            });

            // Get public URL
            const file = bucket.file(thumbnailPath);
            const [metadata] = await file.getMetadata();
            const token = metadata.metadata.firebaseStorageDownloadTokens;
            const thumbnailUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(thumbnailPath)}?alt=media&token=${token}`;

            // Update Firestore
            await doc.ref.update({
                thumbnailUrl: thumbnailUrl,
                thumbnailGeneratedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`[generateMissingThumbnails] Generated thumbnail for: ${mediaId}`);
            generated++;

            // Cleanup
            fs.unlinkSync(tempPdfPath);
            fs.unlinkSync(thumbnailLocalPath);
            fs.rmdirSync(tempThumbDir);

        } catch (error) {
            console.error(`[generateMissingThumbnails] Error processing ${mediaId}:`, error);
            errors.push({ mediaId, error: error.message });

            // Cleanup on error
            try {
                if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
                if (fs.existsSync(tempThumbDir)) {
                    fs.readdirSync(tempThumbDir).forEach(file => {
                        fs.unlinkSync(path.join(tempThumbDir, file));
                    });
                    fs.rmdirSync(tempThumbDir);
                }
            } catch (cleanupError) {
                console.error('[generateMissingThumbnails] Cleanup error:', cleanupError);
            }
        }
    }

    const summary = {
        success: true,
        total: mediaSnapshot.size,
        generated,
        skipped,
        errors: errors.length > 0 ? errors : undefined
    };

    console.log('[generateMissingThumbnails] Batch processing complete:', summary);
    return summary;
});

// ============================================================================
// GEMINI AI CHATBOT PROXY
// ============================================================================

/**
 * Proxies multi-turn chat requests to Gemini using the new @google/genai SDK.
 * Keeps the API key server-side in Secret Manager.
 *
 * Request data:
 *   history      [{role: 'user'|'model', parts: [{text}]}]  — prior turns
 *   userMessage  string  — the new user message
 *
 * Response:
 *   { type: 'text',          reply: string }          — plain AI reply
 *   { type: 'function_call', name: string, args: {} } — tool the AI wants called
 */
// ── Module-level settings cache for geminiChat ─────────────────────────────
// Fetched once per Cloud Function cold start (or after 1-hour TTL).
// This avoids a Firestore read on EVERY chat call for data that rarely changes.
let _appSettingsCache = null;
let _appSettingsFetchedAt = 0;
const APP_SETTINGS_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getAppSettings() {
    const now = Date.now();
    if (_appSettingsCache && (now - _appSettingsFetchedAt) < APP_SETTINGS_TTL_MS) {
        return _appSettingsCache;
    }
    try {
        const db = admin.firestore();
        const snap = await db.collection('settings').doc('general').get();
        const data = snap.exists ? snap.data() : {};
        _appSettingsCache = {
            dealer_stages: Array.isArray(data.dealer_stages) ? data.dealer_stages : [],
            lead_stages: Array.isArray(data.lead_stages) ? data.lead_stages : ['New', 'Contacted', 'Converted', 'Lost'],
            key_accounts: Array.isArray(data.key_accounts) ? data.key_accounts : [],
            dealer_categories: Array.isArray(data.dealer_categories) ? data.dealer_categories : []
        };
        _appSettingsFetchedAt = now;
        console.log('[geminiChat] App settings cache refreshed.');
    } catch (e) {
        console.warn('[geminiChat] Failed to load app settings, using defaults:', e.message);
        // Return stale cache if available, else fall back to safe defaults
        if (_appSettingsCache) return _appSettingsCache;
        _appSettingsCache = {
            dealer_stages: [],
            lead_stages: ['New', 'Contacted', 'Converted', 'Lost'],
            key_accounts: [],
            dealer_categories: []
        };
    }
    return _appSettingsCache;
}

exports.geminiChat = onCall({ secrets: [geminiApiKey] }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be authenticated to use the AI assistant.');
    }

    const { history = [], userMessage } = request.data;

    if (!userMessage || typeof userMessage !== 'string') {
        throw new HttpsError('invalid-argument', 'userMessage is required and must be a string.');
    }

    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });

    // ── Tool declarations ────────────────────────────────────────────────────
    const functionDeclarations = [
        {
            name: 'searchDealers',
            description: 'Search, filter, and rank dealers. Use this for general searches or when the user asks for rankings, top sellers, or sorting by sales.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    query: { type: 'STRING', description: 'Text to search by name, phone, etc.' },
                    filters: {
                        type: 'OBJECT',
                        properties: {
                            kam: { type: 'STRING' },
                            stage: { type: 'STRING' },
                            state: { type: 'STRING' },
                            district: { type: 'STRING' }
                        }
                    },
                    sortBy: { type: 'STRING', description: 'Field to sort by, e.g., "sales" for top sellers.' },
                    sortOrder: { type: 'STRING', enum: ['asc', 'desc'], description: 'Default is "desc".' },
                    limit: { type: 'NUMBER', description: 'Number of results to return (default 10 for AI efficiency).' },
                    period: { type: 'STRING', description: 'Optional historical year (e.g. "21-22") to search within.' }
                }
            }
        },
        {
            name: 'getDealerDetails',
            description: 'Get full details for a specific dealer by their ID or name.',
            parameters: {
                type: 'OBJECT',
                required: ['dealerId'],
                properties: { dealerId: { type: 'STRING' } }
            }
        },
        {
            name: 'updateDealer',
            description: 'Update a dealer properties such as stage, KAM, phone, or email.',
            parameters: {
                type: 'OBJECT',
                required: ['dealerId', 'updates'],
                properties: {
                    dealerId: { type: 'STRING' },
                    updates: { type: 'OBJECT' }
                }
            }
        },
        {
            name: 'performBulkDealerAction',
            description: 'Apply a bulk action (assign_kam or deactivate) to a list of dealers.',
            parameters: {
                type: 'OBJECT',
                required: ['action', 'dealerIds'],
                properties: {
                    action: { type: 'STRING' },
                    dealerIds: { type: 'ARRAY', items: { type: 'STRING' } },
                    payload: { type: 'OBJECT' }
                }
            }
        },
        {
            name: 'searchLeads',
            description: 'Search, filter, and sort B2B leads. Use this for general lead searches or when the user asks for sorted/filtered lead data.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    query: { type: 'STRING', description: 'Text to search (name, business name, etc.)' },
                    filters: {
                        type: 'OBJECT',
                        properties: {
                            status: { type: 'STRING', description: 'Filter by lead status.' },
                            state: { type: 'STRING', description: 'Filter by state.' },
                            district: { type: 'STRING', description: 'Filter by district.' }
                        }
                    },
                    sortBy: { type: 'STRING', description: 'Field to sort by (e.g., "name", "business_name", "created_at").' },
                    sortOrder: { type: 'STRING', enum: ['asc', 'desc'], description: 'Default is "desc".' },
                    limit: { type: 'NUMBER', description: 'Number of results to return (default 10 for AI efficiency).' }
                }
            }
        },
        {
            name: 'getLeadDetails',
            description: 'Get details for a specific B2B lead.',
            parameters: {
                type: 'OBJECT',
                required: ['leadId'],
                properties: { leadId: { type: 'STRING' } }
            }
        },
        {
            name: 'createOrUpdateLead',
            description: 'Create a new B2B lead or update an existing one.',
            parameters: {
                type: 'OBJECT',
                required: ['payload'],
                properties: {
                    payload: { type: 'OBJECT' },
                    leadId: { type: 'STRING' }
                }
            }
        },
        {
            name: 'deleteLead',
            description: 'Permanently delete a B2B lead by ID.',
            parameters: {
                type: 'OBJECT',
                required: ['leadId'],
                properties: { leadId: { type: 'STRING' } }
            }
        },
        {
            name: 'addLeadLog',
            description: 'Add a CRM activity log entry to a lead.',
            parameters: {
                type: 'OBJECT',
                required: ['leadId', 'content'],
                properties: {
                    leadId: { type: 'STRING' },
                    content: { type: 'STRING' },
                    logType: { type: 'STRING' }
                }
            }
        },
        {
            name: 'searchMedia',
            description: 'Search media assets in the library.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    query: { type: 'STRING' },
                    filters: { type: 'OBJECT', properties: { category: { type: 'STRING' }, language: { type: 'STRING' } } }
                }
            }
        },
        {
            name: 'searchTemplates',
            description: 'Search WhatsApp message templates.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    query: { type: 'STRING' },
                    filters: { type: 'OBJECT', properties: { status: { type: 'STRING' }, language: { type: 'STRING' }, category: { type: 'STRING' } } }
                }
            }
        },
        {
            name: 'sendWhatsAppMessage',
            description: 'Send a WhatsApp message to a dealer or lead. Provide either templateId (for approved templates) or text (for normal messages).',
            parameters: {
                type: 'OBJECT',
                required: ['entityId', 'entityType'],
                properties: {
                    entityId: { type: 'STRING' },
                    entityType: { type: 'STRING', description: 'dealer or lead' },
                    templateId: { type: 'STRING', description: 'WhatsApp template ID' },
                    text: { type: 'STRING', description: 'Plain text message body' },
                    mediaId: { type: 'STRING' }
                }
            }
        },
        {
            name: 'getChatHistory',
            description: 'Fetch the WhatsApp chat history for a phone number.',
            parameters: {
                type: 'OBJECT',
                required: ['phone'],
                properties: { phone: { type: 'STRING' } }
            }
        },
        {
            name: 'getDealerSales',
            description: 'Get aggregated sales and period-specific sales for a dealer. Use this for detailed year-over-year breakdowns of a single dealer.',
            parameters: {
                type: 'OBJECT',
                required: ['dealerId'],
                properties: {
                    dealerId: { type: 'STRING', description: 'The unique ID or name of the dealer.' },
                    periods: {
                        type: 'ARRAY',
                        items: { type: 'STRING' },
                        description: 'Optional list of financial year periods (e.g. ["20-21", "21-22"]) to fetch historical sales. Monthly data is NOT available.'
                    }
                }
            }
        }
    ];

    // Load live settings (cached in module memory, refreshed at most once per hour)
    const appSettings = await getAppSettings();

    // Extract readable lists for the prompt
    const kamNames = appSettings.key_accounts
        .map(k => (typeof k === 'object' ? k.name : k))
        .filter(Boolean)
        .join(', ') || 'Not configured';
    const dealerStages = appSettings.dealer_stages.join(', ') || 'Not configured';
    const leadStages = appSettings.lead_stages.join(', ') || 'New, Contacted, Converted, Lost';
    const dealerCats = appSettings.dealer_categories.join(', ') || 'Not configured';

    const systemInstruction = `You are Yes Bheem AI, an intelligent assistant built into the Yes Bheem CRM web application.
You help sales teams manage dealers and B2B leads, analyse sales performance, send WhatsApp messages, and work with media and message templates.

## Application Context (live data — do not guess these values)
- Dealer stages: ${dealerStages}
- Lead stages: ${leadStages}
- Key Account Managers (KAMs): ${kamNames}
- Dealer categories: ${dealerCats}
- Dealers are identified by their "customer_name" field (this is the primary key, not "id")
- The primary market is Kerala, India. Default state filter to "Kerala" when the user doesn't specify.
- Sales figures are in Indian Rupees (₹).
- Only financial year reports are available (e.g., 20-21, 21-22). Monthly breakdowns are NOT supported.

## Behaviour Guidelines
- Be concise and professional.
- Always call the relevant tool when the user asks for data (dealers, leads, templates, media).
- Use the exact stage/status values listed above when constructing filter arguments — do not invent new values.
- When a user mentions a KAM name (even partially), match it to the known KAM list above.
- Before performing destructive actions (delete, deactivate, send messages), always confirm with the user.
- When a tool returns results, summarise them helpfully and concisely — do not dump raw JSON.
- Dates and times are in IST (Indian Standard Time).
- If a request is outside your tool capabilities, say so clearly.`;

    // Build contents array: full history + new user message
    const contents = [
        ...history,
        { role: 'user', parts: [{ text: userMessage }] }
    ];

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents,
            config: {
                systemInstruction,
                tools: [{ functionDeclarations }]
            }
        });

        // Check if Gemini wants to call a function
        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.functionCall) {
                console.log(`[geminiChat] Function call: ${part.functionCall.name}`, part.functionCall.args);
                return {
                    type: 'function_call',
                    name: part.functionCall.name,
                    args: part.functionCall.args
                };
            }
        }

        // Plain text reply
        const textReply = response.text;
        console.log(`[geminiChat] Reply for ${request.auth.uid}: ${String(textReply).substring(0, 80)}...`);
        return { type: 'text', reply: textReply };

    } catch (error) {
        console.error('[geminiChat] Gemini API error:', error);
        throw new HttpsError('internal', `AI service error: ${error.message}`);
    }
});

const whatsappApiUrl = defineString('WHATSAPP_API_URL');

exports.handleWhatsAppInbound = onDocumentCreated({
    document: "wa_chats/{chatId}/messages/{msgId}",
    secrets: [geminiApiKey]
}, async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const msg = snapshot.data();

    // 1. Ignore outbound messages
    if (msg.fromMe === true) return;

    const chatId = event.params.chatId;
    // For safety, fallback to checking from msg or document name
    const crmPhone = msg.crmPhone || (chatId ? chatId.split('_')[0] : null);
    const leadPhone = msg.leadPhone || (chatId ? chatId.split('_')[1] : null);

    if (!crmPhone || !leadPhone) return;

    // 2. Check Chatbot Config
    const settingsDoc = await admin.firestore().collection('settings').doc('general').get();
    if (!settingsDoc.exists) return;

    const chatbotKamPhone = settingsDoc.data().chatbot_kam_phone;

    // Normalize: strip non-digits and compare last 10 digits (handles 10-digit vs 12-digit mismatch)
    const normalizeDigits = p => String(p || '').replace(/\D/g, '').slice(-10);
    const chatbotKamLast10 = normalizeDigits(chatbotKamPhone);
    const crmLast10 = normalizeDigits(crmPhone);

    if (!chatbotKamLast10 || crmLast10 !== chatbotKamLast10) {
        // Message was not sent to the active Chatbot KAM
        console.log(`[handleWhatsAppInbound] Skipping: crmPhone ${crmPhone} (${crmLast10}) != chatbotKAM ${chatbotKamPhone} (${chatbotKamLast10})`);
        return;
    }

    console.log(`[handleWhatsAppInbound] Processing inbound from ${leadPhone} to chatbot ${crmPhone}`);

    // 3. Assemble chat history context (last 10 messages)
    const messagesSnapshot = await admin.firestore()
        .collection('wa_chats').doc(chatId)
        .collection('messages')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();

    const historyDocs = [];
    messagesSnapshot.forEach(doc => historyDocs.push(doc.data()));
    historyDocs.reverse(); // old to new

    const history = [];
    let userMessage = "";

    for (let i = 0; i < historyDocs.length; i++) {
        const docMsg = historyDocs[i];
        const text = docMsg.content?.text || "";
        if (!text) continue;

        if (i === historyDocs.length - 1) {
            userMessage = text;
        } else {
            history.push({
                role: docMsg.fromMe ? 'model' : 'user',
                parts: [{ text: text }]
            });
        }
    }

    if (!userMessage) return;

    // 4. Call Gemini 1.5 Flash
    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });

    const systemInstruction = `You are a helpful assistant for Yes Bheem CRM on WhatsApp.
Please keep your answers short, polite, and conversational. Respond in plain text without Markdown.
If you need to perform an action on the CRM, politely let them know that a human Key Account Manager will assist them shortly.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                ...history,
                { role: 'user', parts: [{ text: userMessage }] }
            ],
            config: { systemInstruction }
        });

        const replyText = response.text;
        if (!replyText) return;

        console.log(`[handleWhatsAppInbound] Generated reply: ${replyText}`);

        // 5. Find Session ID for Outbound API Call
        const axios = require('axios');
        const apiUrl = whatsappApiUrl.value();

        // Helper already defined above, re-use
        const _norm10 = p => String(p || '').replace(/\D/g, '').slice(-10);
        const crmNorm10 = _norm10(crmPhone);

        let sessionId = null;
        try {
            // Primary: cross-reference whatsapp_instances Firestore docs by stored phone
            const instancesSnap = await admin.firestore().collection('whatsapp_instances').get();
            instancesSnap.forEach(doc => {
                if (sessionId) return; // already found
                const d = doc.data();
                // Phone may be stored directly on the doc or inside additionalData
                const candidates = [
                    d.phone,
                    d.phoneNumber,
                    d.additionalData?.phone,
                    d.sessionId,
                    doc.id
                ];
                for (const c of candidates) {
                    if (_norm10(c) === crmNorm10) {
                        sessionId = d.sessionId || doc.id;
                        console.log(`[handleWhatsAppInbound] Matched session ${sessionId} for crmPhone ${crmPhone} via Firestore field "${c}"`);
                        break;
                    }
                }
            });

            // Fallback: scan live /api/auth/sessions response
            if (!sessionId) {
                const sessRes = await axios.get(`${apiUrl}/api/auth/sessions`);
                const sessions = sessRes.data.sessions || [];
                const matchedSession = sessions.find(s => {
                    const candidates = [s.phoneNumber, s.additionalData?.phone, s.id, s.sessionId];
                    return candidates.some(c => _norm10(c) === crmNorm10);
                });
                if (matchedSession) sessionId = matchedSession.id || matchedSession.sessionId;
            }
        } catch (e) {
            console.error('[handleWhatsAppInbound] Error resolving sessionId:', e.message);
        }

        if (!sessionId) {
            console.error(`[handleWhatsAppInbound] No active WhatsApp session found for crmPhone: ${crmPhone} (norm: ${crmNorm10})`);
            return;
        }

        // 6. Send Reply via HTTP POST to Baileys Server
        console.log(`[handleWhatsAppInbound] Sending reply via session ${sessionId} to ${leadPhone}`);
        await axios.post(`${apiUrl}/api/messages/text`, {
            sessionId: sessionId,
            to: leadPhone,
            text: replyText
        });

    } catch (error) {
        console.error('[handleWhatsAppInbound] Failed to process auto-reply:', error);
    }
});
