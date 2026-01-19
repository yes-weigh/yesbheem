const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function forceClean() {
    const uid = 'DpCw3RC0m4hIDtefItsncGmTdul2'; // mhdfazalvs@gmail.com
    console.log(`Force cleaning data for ${uid}...`);

    const userRef = db.collection('users').doc(uid);
    const doc = await userRef.get();

    if (!doc.exists) {
        console.log('User not found');
        return;
    }

    const data = doc.data();
    const cleanData = {};
    let deletedCount = 0;

    Object.keys(data).forEach(key => {
        // Identify flat keys: starts with 'activeSessions.' (has dot)
        if (key.startsWith('activeSessions.')) {
            console.log(`Skipping ghost/flat key: ${key}`);
            deletedCount++;
        } else {
            cleanData[key] = data[key];
        }
    });

    console.log(`\nRe-writing document with ${Object.keys(cleanData).length} keys. (Removed ${deletedCount} keys)`);

    // Validate we kept the activeSessions map
    if (cleanData.activeSessions) {
        console.log('Valid activeSessions map preserved with keys:', Object.keys(cleanData.activeSessions));
    } else {
        console.warn('WARNING: activeSessions map is MISSING or EMPTY (might be correct if user has no sessions)');
    }

    // Perform the overwrite
    await userRef.set(cleanData);
    console.log('Document rewritten successfully.');
}

forceClean().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
