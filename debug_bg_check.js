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

        const doc = snapshot.docs[0]; // Gets the first doc (Yes Weigh Brochure)
        const data = doc.data();
        const tempPath = 'test_debug_2.pdf';

        console.log(`Downloading ${data.name}...`);
        await bucket.file(data.storagePath).download({ destination: tempPath });

        const { pdf } = await import('pdf-to-img');

        console.log('Generating Page 2...');
        const docWithBg = await pdf(tempPath, {
            scale: 2,
            renderParams: { background: true }
        });

        let pageNum = 0;
        for await (const image of docWithBg) {
            pageNum++;
            // Skip Page 1
            if (pageNum === 1) {
                console.log('Skipping Page 1...');
                continue;
            }

            await sharp(image)
                .jpeg({ quality: 80 })
                .toFile('debug_thumb_page2.jpg');
            console.log('Saved debug_thumb_page2.jpg');
            await checkColor('debug_thumb_page2.jpg');
            return; // Done
        }

    } catch (e) {
        console.error(e);
    }
}

run();
