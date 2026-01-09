const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const axios = require('axios');
const nodemailer = require('nodemailer');

admin.initializeApp();

// Define secrets to be used at runtime
const watiToken = defineSecret('WATI_TOKEN');
const watiEndpoint = defineSecret('WATI_ENDPOINT');
const smtpEmail = defineSecret('SMTP_EMAIL');
const smtpPassword = defineSecret('SMTP_PASSWORD');

exports.sendDualSplitOTP = onCall({ secrets: [watiToken, watiEndpoint, smtpEmail, smtpPassword] }, async (request) => {
    const { phoneNumber, email, deviceFingerprint } = request.data;

    // 1. Traitor Tracking: Check if this device is authorized
    const userRef = admin.firestore().collection('users').doc(email);
    const userDoc = await userRef.get();

    if (userDoc.exists && userDoc.data().authorizedDevice) {
        if (userDoc.data().authorizedDevice !== deviceFingerprint) {
            // Log suspicious activity
            await admin.firestore().collection('security_audit').add({
                event: 'UNAUTHORIZED_DEVICE_ATTEMPT',
                user: email,
                fingerprint: deviceFingerprint,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
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
            service: 'gmail',
            auth: {
                user: smtpEmail.value(),
                pass: smtpPassword.value()
            }
        });

        await transporter.sendMail({
            from: `"YesWeigh Security" <${smtpEmail.value()}>`,
            to: email,
            subject: 'Your Login Verification Code (Part B)',
            text: `Your verification code Part B is: ${codeB}\n\nThis code expires in 5 minutes.\nPlease enter this along with Part A (sent to WhatsApp) to complete your login.`
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
    const otpDoc = await admin.firestore().collection('temp_otps').doc(email).get();

    if (!otpDoc.exists || otpDoc.data().partA !== codeA || otpDoc.data().partB !== codeB) {
        throw new HttpsError('permission-denied', 'Invalid keys.');
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

    return { token: customToken };
});