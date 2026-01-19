const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function createDummySession() {
    const uid = 'DpCw3RC0m4hIDtefItsncGmTdul2'; // mhdfazalvs@gmail.com
    const fakeFingerprint = 'dummy_session_' + Date.now();

    console.log(`Creating dummy session for ${uid}...`);

    const userRef = db.collection('users').doc(uid);

    await userRef.update({
        [`activeSessions.${fakeFingerprint}`]: {
            lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
            ip: '127.0.0.1',
            userAgent: 'Dummy Test Device',
            location: 'Test Lab',
            deviceType: 'desktop',
            os: 'TestOS',
            browser: 'TestBrowser'
        },
        // Also add to authorized devices to simulate full login
        authorizedDevices: admin.firestore.FieldValue.arrayUnion(fakeFingerprint)
    });

    console.log(`Dummy session created: ${fakeFingerprint}`);
}

createDummySession().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
