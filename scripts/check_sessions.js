const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkUserSessions() {
    try {
        // Get all users
        const usersSnapshot = await db.collection('users').get();

        console.log(`\n========== USER SESSIONS DIAGNOSTIC ==========\n`);
        console.log(`Total users: ${usersSnapshot.size}\n`);

        usersSnapshot.forEach(doc => {
            const data = doc.data();
            const uid = doc.id;
            const email = data.email || 'unknown';

            console.log(`User: ${email} (${uid})`);
            console.log(`  Email: ${email}`);
            console.log(`  Role: ${data.role || 'user'}`);

            // Check for activeSessions
            if (data.activeSessions) {
                const sessionKeys = Object.keys(data.activeSessions);
                console.log(`  Active Sessions (${sessionKeys.length}):`);
                sessionKeys.forEach(key => {
                    const session = data.activeSessions[key];
                    console.log(`    - ${key}:`);
                    console.log(`        IP: ${session.ip || 'N/A'}`);
                    console.log(`        Location: ${session.location || 'N/A'}`);
                    console.log(`        Last Active: ${session.lastActiveAt ? session.lastActiveAt.toDate() : 'N/A'}`);
                });
            } else {
                console.log(`  Active Sessions: NONE`);
            }

            console.log('');
        });

        console.log(`========== END DIAGNOSTIC ==========\n`);
        process.exit(0);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkUserSessions();
