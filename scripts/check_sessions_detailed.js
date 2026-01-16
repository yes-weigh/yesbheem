const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkDetailedSessions() {
    try {
        const usersSnapshot = await db.collection('users').get();

        console.log(`\n========== DETAILED SESSION CHECK ==========\n`);

        usersSnapshot.forEach(doc => {
            const data = doc.data();
            const uid = doc.id;

            console.log(`User: ${data.email} (${uid})`);
            console.log(`\nAll document fields:`);

            // Show ALL fields
            Object.keys(data).forEach(key => {
                if (key.startsWith('activeSessions')) {
                    console.log(`  ${key}:`, JSON.stringify(data[key], null, 2));
                }
            });

            console.log('\n');
        });

        console.log(`========== END CHECK ==========\n`);
        process.exit(0);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkDetailedSessions();
