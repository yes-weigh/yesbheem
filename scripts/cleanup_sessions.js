// Script to clean up all session data and activity logs from Firestore
// Run this with: node scripts/cleanup_sessions.js

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cleanupSessions() {
    console.log('🧹 Starting cleanup process...\n');

    try {
        // 1. Clean up all activeSessions from users collection
        console.log('📋 Step 1: Cleaning up user sessions...');
        const usersSnapshot = await db.collection('users').get();

        let sessionCount = 0;
        const batch = db.batch();

        usersSnapshot.forEach(doc => {
            const data = doc.data();
            const updates = {};

            // Find all activeSessions.* keys
            Object.keys(data).forEach(key => {
                if (key.startsWith('activeSessions.')) {
                    updates[key] = admin.firestore.FieldValue.delete();
                    sessionCount++;
                }
            });

            // Also clear authorizedDevices for admins (optional - keeps device authorization)
            // Uncomment if you want to reset device authorization too:
            // if (data.authorizedDevices) {
            //     updates['authorizedDevices'] = admin.firestore.FieldValue.delete();
            // }
            // if (data.authorizedDevice) {
            //     updates['authorizedDevice'] = admin.firestore.FieldValue.delete();
            // }

            if (Object.keys(updates).length > 0) {
                batch.update(doc.ref, updates);
            }
        });

        await batch.commit();
        console.log(`   ✅ Removed ${sessionCount} active sessions from ${usersSnapshot.size} users\n`);

        // 2. Delete all activity logs
        console.log('📋 Step 2: Deleting activity logs...');
        const logsSnapshot = await db.collection('user_activity_logs').get();

        if (logsSnapshot.size > 0) {
            const logBatch = db.batch();
            logsSnapshot.forEach(doc => {
                logBatch.delete(doc.ref);
            });
            await logBatch.commit();
            console.log(`   ✅ Deleted ${logsSnapshot.size} activity log entries\n`);
        } else {
            console.log('   ℹ️  No activity logs found\n');
        }

        // 3. Delete security audit logs (optional)
        console.log('📋 Step 3: Deleting security audit logs...');
        const auditSnapshot = await db.collection('security_audit').get();

        if (auditSnapshot.size > 0) {
            const auditBatch = db.batch();
            auditSnapshot.forEach(doc => {
                auditBatch.delete(doc.ref);
            });
            await auditBatch.commit();
            console.log(`   ✅ Deleted ${auditSnapshot.size} security audit entries\n`);
        } else {
            console.log('   ℹ️  No security audit logs found\n');
        }

        // 4. Delete temporary OTPs
        console.log('📋 Step 4: Cleaning up temporary OTPs...');
        const otpSnapshot = await db.collection('temp_otps').get();

        if (otpSnapshot.size > 0) {
            const otpBatch = db.batch();
            otpSnapshot.forEach(doc => {
                otpBatch.delete(doc.ref);
            });
            await otpBatch.commit();
            console.log(`   ✅ Deleted ${otpSnapshot.size} temporary OTP entries\n`);
        } else {
            console.log('   ℹ️  No temporary OTPs found\n');
        }

        console.log('✨ Cleanup completed successfully!');
        console.log('\n📊 Summary:');
        console.log(`   - Active sessions removed: ${sessionCount}`);
        console.log(`   - Activity logs deleted: ${logsSnapshot.size}`);
        console.log(`   - Security audits deleted: ${auditSnapshot.size}`);
        console.log(`   - Temp OTPs deleted: ${otpSnapshot.size}`);
        console.log('\n🎯 Your Firestore is now clean and ready for testing!');

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        process.exit(1);
    }

    process.exit(0);
}

// Run the cleanup
cleanupSessions();
