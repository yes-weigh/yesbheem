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

async function checkColor(file) {
    try {
        const { data, info } = await sharp(file)
            .raw()
            .toBuffer({ resolveWithObject: true });

        const r = data[0];
        const g = data[1];
        const b = data[2];
        const a = info.channels === 4 ? data[3] : 'N/A';
        console.log(`${file}: R=${r}, G=${g}, B=${b}, A=${a}`);
    } catch (e) {
        console.log(`${file}: Error - ${e.message}`);
    }
}

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
        const tempPath = 'test_debug_2.pdf'; // Reuse existing if downloaded

        if (!fs.existsSync(tempPath)) {
            console.log(`Downloading ${data.name}...`);
            await bucket.file(data.storagePath).download({ destination: tempPath });
        }

        const { pdf } = await import('pdf-to-img');

        console.log('Generating with negate()...');
        const docGen = await pdf(tempPath, { scale: 2 });

        for await (const image of docGen) {
            await sharp(image)
                .negate({ alpha: false }) // Invert colors, keep alpha
                .flatten({ background: '#ffffff' }) // Flatten just in case
                .jpeg({ quality: 80 })
                .toFile('debug_thumb_negate.jpg');
            console.log('Saved debug_thumb_negate.jpg');
            await checkColor('debug_thumb_negate.jpg');
            return;
        }

    } catch (e) {
        console.error(e);
    }
}

run();
