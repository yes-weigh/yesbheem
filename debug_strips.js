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
        const document = await pdf(tempPath, { scale: 2 });

        for await (const image of document) {
            // 1. Reproduce "Strips" (Negate)
            await sharp(image)
                .negate({ alpha: false })
                .flatten({ background: '#ffffff' })
                .jpeg({ quality: 80 })
                .toFile('debug_strip_repro.jpg');
            console.log('Saved debug_strip_repro.jpg (Expect Strips)');

            // 2. Just Flatten (The fix we want)
            await sharp(image)
                .flatten({ background: '#ffffff' })
                .jpeg({ quality: 80 })
                .toFile('debug_strip_flatten.jpg');
            console.log('Saved debug_strip_flatten.jpg (Expect Normal)');

            // 3. Raw
            await sharp(image)
                .png()
                .toFile('debug_strip_raw.png');
            console.log('Saved debug_strip_raw.png');

            break;
        }
    } catch (e) {
        console.error(e);
    }
}

run();
