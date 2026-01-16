const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cleanupChromeSession() {
    try {
        const uid = 'DpCw3RC0m4hIDtefItsncGmTdul2';
        const fingerprintToDelete = '16e18a65c9636245d6594b512cb227e8';

        console.log(`\n========== MANUAL SESSION CLEANUP ==========\n`);
        console.log(`Deleting session: ${fingerprintToDelete}`);

        const userRef = db.collection('users').doc(uid);

        // Delete the flat key
        await userRef.update({
            [`activeSessions.${fingerprintToDelete}`]: admin.firestore.FieldValue.delete()
        });

        console.log(`✅ Session deleted successfully!`);

        // Verify
        const updatedDoc = await userRef.get();
        const data = updatedDoc.data();
        const remainingSessions = Object.keys(data).filter(k => k.startsWith('activeSessions'));

        console.log(`\nRemaining session keys:`, remainingSessions);
        console.log(`\n========== CLEANUP COMPLETE ==========\n`);

        process.exit(0);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

cleanupChromeSession();
