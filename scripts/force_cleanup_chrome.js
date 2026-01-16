const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function forceCleanupAllChromeSessions() {
    try {
        const uid = 'DpCw3RC0m4hIDtefItsncGmTdul2';
        const chromeFingerprint = '16e18a65c9636245d6594b512cb227e8';

        console.log(`\n========== FORCE CLEANUP ==========\n`);
        console.log(`Deleting ALL instances of Chrome session: ${chromeFingerprint}`);

        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        const data = userDoc.data();

        console.log('\nBefore cleanup:');
        console.log('  Flat keys:', Object.keys(data).filter(k => k.startsWith('activeSessions.')));
        console.log('  Nested object keys:', data.activeSessions ? Object.keys(data.activeSessions) : 'none');

        // Delete both the flat key AND from nested object
        const updates = {
            [`activeSessions.${chromeFingerprint}`]: admin.firestore.FieldValue.delete()
        };

        // Also delete from nested object if it exists
        if (data.activeSessions && data.activeSessions[chromeFingerprint]) {
            // We need to update the nested object by removing the key
            const newActiveSessions = { ...data.activeSessions };
            delete newActiveSessions[chromeFingerprint];
            updates.activeSessions = newActiveSessions;
        }

        await userRef.update(updates);
        console.log(`\n✅ Deletion commands sent`);

        // Verify
        const updatedDoc = await userRef.get();
        const updatedData = updatedDoc.data();

        console.log('\nAfter cleanup:');
        console.log('  Flat keys:', Object.keys(updatedData).filter(k => k.startsWith('activeSessions.')));
        console.log('  Nested object keys:', updatedData.activeSessions ? Object.keys(updatedData.activeSessions) : 'none');

        console.log(`\n========== CLEANUP COMPLETE ==========\n`);

        process.exit(0);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

forceCleanupAllChromeSessions();
