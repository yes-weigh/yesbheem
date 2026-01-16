const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function setToNull() {
    try {
        const uid = 'DpCw3RC0m4hIDtefItsncGmTdul2';
        const chromeFingerprint = '16e18a65c9636245d6594b512cb227e8';

        console.log(`\n========== SET TO NULL APPROACH ==========\n`);

        const userRef = db.collection('users').doc(uid);

        // Try setting to null instead of deleting
        console.log(`Setting activeSessions.${chromeFingerprint} to null...`);
        await userRef.set({
            [`activeSessions.${chromeFingerprint}`]: null
        }, { merge: true });

        console.log('✅ Set to null');

        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Now try to delete it
        console.log(`\nNow deleting the null field...`);
        await userRef.update({
            [`activeSessions.${chromeFingerprint}`]: admin.firestore.FieldValue.delete()
        });

        console.log('✅ Deleted');

        // Verify
        await new Promise(resolve => setTimeout(resolve, 1000));
        const finalDoc = await userRef.get();
        const finalData = finalDoc.data();

        console.log('\nFinal state:');
        const sessionKeys = Object.keys(finalData).filter(k => k.startsWith('activeSessions'));
        sessionKeys.forEach(k => {
            console.log(`  ${k}: ${finalData[k] === null ? 'null' : 'exists'}`);
        });

        console.log(`\n========== COMPLETE ==========\n`);

        process.exit(0);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

setToNull();
