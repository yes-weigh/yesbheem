// Quick script to call generateMissingThumbnails function
// Run with: node call-thumbnail-function.js

const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');

// Initialize with credential
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'yesweighmomentumhub.firebasestorage.app'
});

const db = admin.firestore();
const bucket = admin.storage().bucket();
const sharp = require('sharp');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Use pdf-to-img for real PDF rendering
// const pdfImgConvert = require('pdf-img-convert'); // Failed

async function generatePdfThumbnail(pdfPath, outputPath) {
    try {
        const { pdf } = await import('pdf-to-img');
        const thumbnailPath = path.join(outputPath, 'thumb.jpg');

        // Convert first page to image
        const document = await pdf(pdfPath, { scale: 1.5 }); // Use 1.5 to avoid stride issues at scale 2

        for await (const image of document) {
            // image is a Buffer (PNG)
            // Use sharp to negate (fix inversion) AND flatten transparency (white bg)
            await sharp(image)
                .negate({ alpha: false })
                .flatten({ background: '#ffffff' })
                .jpeg({ quality: 80 })
                .toFile(thumbnailPath);
            return thumbnailPath; // Return after first page
        }

        throw new Error('No images generated from PDF');
    } catch (error) {
        console.error('[generatePdfThumbnail] Error:', error);
        throw error;
    }
}

async function generateMissingThumbnails() {
    console.log('[Script] Starting batch thumbnail generation...');

    // Get all media items
    console.log('[Script] Querying collection: media_library');
    const mediaSnapshot = await db.collection('media_library').get();

    let generated = 0;
    let skipped = 0;
    const errors = [];

    console.log(`[Script] Found ${mediaSnapshot.size} total media files`);

    // Filter for PDFs
    const pdfDocs = mediaSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.type === 'document' || data.mimeType === 'application/pdf';
    });

    console.log(`[Script] Identified ${pdfDocs.length} PDF files`);

    for (const doc of pdfDocs) {
        const mediaData = doc.data();
        const mediaId = doc.id;
        const storagePath = mediaData.storagePath;

        console.log(`\n[Script] Processing: ${mediaId}`);

        // Skip if thumbnail already exists in Firestore
        if (mediaData.thumbnailUrl) {
            console.log(`  ✓ Skipping: already has thumbnailUrl`);
            skipped++;
            continue;
        }


        // Check if thumbnail exists in Storage
        /*
        const thumbnailPath = `media/thumbnails/${mediaId}.jpg`;
        const [thumbnailExists] = await bucket.file(thumbnailPath).exists();

        if (thumbnailExists) {
            console.log(`  ✓ Thumbnail exists in storage, updating Firestore...`);
            // Update Firestore with the existing thumbnail URL
            const file = bucket.file(thumbnailPath);
            const [metadata] = await file.getMetadata();
            const token = metadata.metadata?.firebaseStorageDownloadTokens;
            if (token) {
                const thumbnailUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(thumbnailPath)}?alt=media&token=${token}`;
                await doc.ref.update({ thumbnailUrl });
            }
            skipped++;
            continue;
        }
        */

        const thumbnailPath = `media/thumbnails/${mediaId}.jpg`;


        // const thumbnailPath = `media/thumbnails/${mediaId}.jpg`; // This line is now redundant

        // Generate thumbnail
        const tempDir = os.tmpdir();
        const tempPdfPath = path.join(tempDir, `${mediaId}.pdf`);
        const tempThumbDir = path.join(tempDir, `thumb_${mediaId}`);

        try {
            // Create temp directory
            if (!fs.existsSync(tempThumbDir)) {
                fs.mkdirSync(tempThumbDir, { recursive: true });
            }

            console.log(`  → Downloading PDF...`);
            await bucket.file(storagePath).download({ destination: tempPdfPath });

            console.log(`  → Generating thumbnail...`);
            const thumbnailLocalPath = await generatePdfThumbnail(tempPdfPath, tempThumbDir);

            console.log(`  → Uploading thumbnail...`);
            await bucket.upload(thumbnailLocalPath, {
                destination: thumbnailPath,
                metadata: {
                    contentType: 'image/jpeg',
                    metadata: {
                        firebaseStorageDownloadTokens: require('crypto').randomBytes(16).toString('hex')
                    }
                }
            });

            // Get public URL
            const file = bucket.file(thumbnailPath);
            const [metadata] = await file.getMetadata();
            const token = metadata.metadata.firebaseStorageDownloadTokens;
            const thumbnailUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(thumbnailPath)}?alt=media&token=${token}`;

            // Update Firestore
            await doc.ref.update({
                thumbnailUrl: thumbnailUrl,
                thumbnailGeneratedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`  ✓ Generated and uploaded successfully`);
            generated++;

            // Cleanup
            fs.unlinkSync(tempPdfPath);
            fs.unlinkSync(thumbnailLocalPath);
            fs.rmdirSync(tempThumbDir);

        } catch (error) {
            console.error(`  ✗ Error processing ${mediaId}:`, error.message);
            errors.push({ mediaId, error: error.message });

            // Cleanup on error
            try {
                if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
                if (fs.existsSync(tempThumbDir)) {
                    fs.readdirSync(tempThumbDir).forEach(file => {
                        fs.unlinkSync(path.join(tempThumbDir, file));
                    });
                    fs.rmdirSync(tempThumbDir);
                }
            } catch (cleanupError) {
                console.error('  Cleanup error:', cleanupError);
            }
        }
    }

    const summary = {
        success: true,
        total: mediaSnapshot.size,
        generated,
        skipped,
        errors: errors.length > 0 ? errors : undefined
    };

    console.log('\n========================================');
    console.log('✅ Batch processing complete!');
    console.log(`Total PDFs: ${summary.total}`);
    console.log(`Generated: ${summary.generated}`);
    console.log(`Skipped: ${summary.skipped}`);
    if (errors.length > 0) {
        console.log(`Errors: ${errors.length}`);
        errors.forEach(e => console.log(`  - ${e.mediaId}: ${e.error}`));
    }
    console.log('========================================\n');

    process.exit(0);
}

// Run the function
generateMissingThumbnails().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
