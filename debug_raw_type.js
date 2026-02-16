const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
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
            console.log(`Downloading ${data.name}...`);
            await bucket.file(data.storagePath).download({ destination: tempPath });
        }

        const { pdf } = await import('pdf-to-img');
        const document = await pdf(tempPath, { scale: 2 });

        console.log('Iterating pages...');
        for await (const image of document) {
            console.log('Image type:', typeof image);
            console.log('Is Buffer?', Buffer.isBuffer(image));
            if (Buffer.isBuffer(image)) {
                console.log('Buffer length:', image.length);
                console.log('First 10 bytes:', image.slice(0, 10).toString('hex'));

                // Write directly to file to see if it's viewable
                fs.writeFileSync('debug_raw_output.bin', image);
                console.log('Saved debug_raw_output.bin');
            } else {
                console.log('Image keys:', Object.keys(image));
            }
            break;
        }
    } catch (e) {
        console.error(e);
    }
}

run();
