// Quick script to call generateMissingThumbnails function
// Run with: node call-thumbnail-function.js

const admin = require('firebase-admin');

// Initialize with default credentials
admin.initializeApp({
    projectId: 'yesweighmomentumhub',
    storageBucket: 'yesweighmomentumhub.appspot.com'
});

const db = admin.firestore();
const bucket = admin.storage().bucket();
const sharp = require('sharp');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Reuse the same generatePdfThumbnail function
async function generatePdfThumbnail(pdfPath, outputPath) {
    try {
        const thumbnailPath = path.join(outputPath, 'thumb.jpg');
        const width = 800;
        const height = 1131; // A4 aspect ratio

        const svg = `
            <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:#f9fafb;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#e5e7eb;stop-opacity:1" />
                    </linearGradient>
                </defs>
                <rect width="100%" height="100%" fill="url(#bg)"/>
                <rect x="40" y="40" width="${width - 80}" height="${height - 80}" 
                      fill="#ffffff" stroke="#d1d5db" stroke-width="2" rx="8"/>
                <path d="M ${width / 2 - 60} ${height / 2 - 80} 
                         l 80 0 l 40 40 l 0 120 l -120 0 z" 
                      fill="#ef4444" stroke="#dc2626" stroke-width="2"/>
                <text x="${width / 2}" y="${height / 2 + 20}" 
                      font-family="Arial, sans-serif" font-size="48" font-weight="bold"
                      fill="#ffffff" text-anchor="middle">PDF</text>
                <text x="${width / 2}" y="${height / 2 + 80}" 
                      font-family="Arial, sans-serif" font-size="24"
                      fill="#6b7280" text-anchor="middle">Document Preview</text>
            </svg>
        `;

        await sharp(Buffer.from(svg))
            .jpeg({ quality: 85 })
            .toFile(thumbnailPath);

        return thumbnailPath;
    } catch (error) {
        console.error('[generatePdfThumbnail] Error:', error);
        throw error;
    }
}

async function generateMissingThumbnails() {
    console.log('[Script] Starting batch thumbnail generation...');

    // Get all PDF media items
    const mediaSnapshot = await db.collection('media')
        .where('mimeType', '==', 'application/pdf')
        .get();

    let generated = 0;
    let skipped = 0;
    const errors = [];

    console.log(`[Script] Found ${mediaSnapshot.size} PDF files`);

    for (const doc of mediaSnapshot.docs) {
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
