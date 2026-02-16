const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Initialize with credential
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: 'yesweighmomentumhub.firebasestorage.app'
    });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

async function generateDebugThumbnail(pdfPath, outputPrefix) {
    try {
        const { pdf } = await import('pdf-to-img');

        // Convert first page to image
        const document = await pdf(pdfPath, { scale: 2 });

        console.log('Generating debug images...');

        for await (const image of document) {
            // Test 1: Standard conversion (what we have now)
            await sharp(image)
                .flatten({ background: '#ffffff' })
                .jpeg({ quality: 80 })
                .toFile(`${outputPrefix}_flatten_white.jpg`);
            console.log(`Saved: ${outputPrefix}_flatten_white.jpg`);

            // Test 2: Ensure alpha then flatten
            await sharp(image)
                .ensureAlpha()
                .flatten({ background: '#ffffff' })
                .jpeg({ quality: 80 })
                .toFile(`${outputPrefix}_ensure_alpha_flatten.jpg`);
            console.log(`Saved: ${outputPrefix}_ensure_alpha_flatten.jpg`);

            // Test 3: Remove alpha (might turn black if transparent)
            await sharp(image)
                .removeAlpha()
                .jpeg({ quality: 80 })
                .toFile(`${outputPrefix}_remove_alpha.jpg`);
            console.log(`Saved: ${outputPrefix}_remove_alpha.jpg`);

            // Test 4: PNG output (check transparency)
            await sharp(image)
                .png()
                .toFile(`${outputPrefix}_raw.png`);
            console.log(`Saved: ${outputPrefix}_raw.png`);

            return; // Return after first page (from previous loop)
        }

        // Test 5: Render with background param
        console.log('Testing renderParams: { background: true }...');
        const docWithBg = await pdf(pdfPath, {
            scale: 2,
            renderParams: { background: true }
        });

        for await (const image of docWithBg) {
            await sharp(image)
                .jpeg({ quality: 80 })
                .toFile(`${outputPrefix}_with_bg_param.jpg`);
            console.log(`Saved: ${outputPrefix}_with_bg_param.jpg`);
            return;
        }

        async function run() {
            try {
                // Get ONE PDF to test with
                console.log('Fetching a PDF to test...');
                const snapshot = await db.collection('media_library')
                    .where('mimeType', '==', 'application/pdf')
                    .limit(1)
                    .get();

                if (snapshot.empty) {
                    console.log('No PDFs found.');
                    return;
                }

                const doc = snapshot.docs[0];
                const data = doc.data();
                console.log(`Testing with PDF: ${data.name} (${doc.id})`);

                const tempPath = 'test_debug.pdf';

                console.log('Downloading...');
                await bucket.file(data.storagePath).download({ destination: tempPath });
                console.log('Downloaded.');

                await generateDebugThumbnail(tempPath, 'debug_thumb');

            } catch (e) {
                console.error(e);
            }
        }

        run();
