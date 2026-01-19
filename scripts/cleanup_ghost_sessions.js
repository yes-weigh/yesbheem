const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cleanupGhostSessions() {
    const uid = 'DpCw3RC0m4hIDtefItsncGmTdul2'; // mhdfazalvs@gmail.com
    console.log(`Cleaning up ghost sessions for ${uid}...`);

    const userRef = db.collection('users').doc(uid);
    const doc = await userRef.get();

    if (!doc.exists) {
        console.log('User not found');
        return;
    }

    const data = doc.data();
    const updates = {};
    let deletedCount = 0;

    // Find keys that look like activeSessions.xyz (flat keys)
    for (const key of Object.keys(data)) {
        if (key.startsWith('activeSessions.') && key.length > 15) {
            console.log(`Found ghost session (flat key): ${key}`);
            // To delete a field with dot, we need FieldPath
            // usage: userRef.update({ [new admin.firestore.FieldPath(key)]: admin.firestore.FieldValue.delete() })
            // But we can construct the update object here

            // Using FieldPath specifically for the key
            await userRef.update({
                [new admin.firestore.FieldPath(key)]: admin.firestore.FieldValue.delete()
            });
            console.log(`Deleted ${key}`);
            deletedCount++;
        }
    }

    console.log(`Cleanup complete. Deleted ${deletedCount} ghost sessions.`);
}

cleanupGhostSessions().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
