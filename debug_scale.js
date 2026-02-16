const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: 'yesweighmomentumhub.firebasestorage.app'
    });
}
const db = admin.firestore();
const bucket = admin.storage().bucket();

async function run() {
    try {
        console.log('Fetching PDF...');
        const snapshot = await db.collection('media_library')
            .where('mimeType', '==', 'application/pdf')
            .limit(1)
            .get();

        if (snapshot.empty) return;

        const doc = snapshot.docs[0];
        const data = doc.data();
        const tempPath = 'test_debug_strip.pdf';

        if (!fs.existsSync(tempPath)) {
            await bucket.file(data.storagePath).download({ destination: tempPath });
        }

        const { pdf } = await import('pdf-to-img');

        // Test Scale 1
        console.log('Testing Scale 1...');
        const doc1 = await pdf(tempPath, { scale: 1 });
        for await (const image of doc1) {
            await sharp(image)
                .negate({ alpha: false })
                .flatten({ background: '#ffffff' })
                .jpeg({ quality: 80 })
                .toFile('debug_scale_1_negate.jpg');
            console.log('Saved debug_scale_1_negate.jpg');
            break;
        }

        // Test Scale 1.5
        console.log('Testing Scale 1.5...');
        const doc15 = await pdf(tempPath, { scale: 1.5 });
        for await (const image of doc15) {
            await sharp(image)
                .negate({ alpha: false })
                .flatten({ background: '#ffffff' })
                .jpeg({ quality: 80 })
                .toFile('debug_scale_1.5_negate.jpg');
            console.log('Saved debug_scale_1.5_negate.jpg');
            break;
        }

    } catch (e) {
        console.error(e);
    }
}

run();
