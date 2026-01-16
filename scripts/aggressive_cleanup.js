const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function aggressiveCleanup() {
    try {
        const uid = 'DpCw3RC0m4hIDtefItsncGmTdul2';
        const edgeFingerprint = 'ee45c120011022e504f6233c47a01b25';

        console.log(`\n========== AGGRESSIVE CLEANUP ==========\n`);

        const userRef = db.collection('users').doc(uid);

        // Step 1: Get current data
        const userDoc = await userRef.get();
        const data = userDoc.data();

        console.log('Current state:');
        Object.keys(data).filter(k => k.startsWith('activeSessions')).forEach(k => {
            console.log(`  ${k}`);
        });

        // Step 2: Delete ALL activeSessions keys (both flat and nested)
        const deleteUpdates = {};
        Object.keys(data).forEach(key => {
            if (key.startsWith('activeSessions')) {
                deleteUpdates[key] = admin.firestore.FieldValue.delete();
            }
        });

        console.log(`\nDeleting ${Object.keys(deleteUpdates).length} session keys...`);
        await userRef.update(deleteUpdates);
        console.log('✅ All session keys deleted');

        // Step 3: Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Step 4: Recreate ONLY the Edge session
        console.log(`\nRecreating Edge session: ${edgeFingerprint}`);
        await userRef.update({
            [`activeSessions.${edgeFingerprint}`]: {
                lastActiveAt: admin.firestore.Timestamp.now(),
                ip: '111.92.116.61',
                location: 'Kochi, Kerala'
            }
        });
        console.log('✅ Edge session recreated');

        // Step 5: Verify
        const finalDoc = await userRef.get();
        const finalData = finalDoc.data();

        console.log('\nFinal state:');
        Object.keys(finalData).filter(k => k.startsWith('activeSessions')).forEach(k => {
            console.log(`  ${k}`);
        });

        console.log(`\n========== CLEANUP COMPLETE ==========\n`);

        process.exit(0);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

aggressiveCleanup();
