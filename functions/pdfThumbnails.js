
// ============================================================================
// PDF THUMBNAIL GENERATION
// ============================================================================

/**
 * Helper function to generate a thumbnail from a PDF file
 * @param {string} pdfPath - Local path to the PDF file
 * @param {string} outputPath - Local path where thumbnail should be saved
 * @returns {Promise<string>} Path to generated thumbnail
 */
async function generatePdfThumbnail(pdfPath, outputPath) {
    const opts = {
        format: 'jpeg',
        out_dir: outputPath,
        out_prefix: 'thumb',
        page: 1, // First page only
        scale: 800 // Output width in pixels
    };

    try {
        await poppler.convert(pdfPath, opts);
        // pdf-poppler generates: thumb-1.jpg
        const thumbnailPath = path.join(outputPath, 'thumb-1.jpg');
        return thumbnailPath;
    } catch (error) {
        console.error('[generatePdfThumbnail] Error:', error);
        throw error;
    }
}

/**
 * Storage Trigger: Generates thumbnail when a PDF is uploaded to /media/*
 * Automatically runs on every new file upload to the media folder
 */
exports.onMediaFileUploaded = onObjectFinalized(async (event) => {
    const filePath = event.data.name; // e.g. "media/abc123.pdf"
    const contentType = event.data.contentType;
    const bucket = admin.storage().bucket(event.bucket);

    // Only process PDFs
    if (!contentType || contentType !== 'application/pdf') {
        console.log(`[onMediaFileUploaded] Skipping non-PDF file: ${filePath}`);
        return;
    }

    // Skip if this is already a thumbnail
    if (filePath.includes('/thumbnails/')) {
        console.log(`[onMediaFileUploaded] Skipping thumbnail file: ${filePath}`);
        return;
    }

    console.log(`[onMediaFileUploaded] Processing PDF: ${filePath}`);

    // Extract media ID from path (e.g. "media/abc123.pdf" -> "abc123")
    const fileName = path.basename(filePath, path.extname(filePath));
    const mediaId = fileName;

    // Check if thumbnail already exists
    const thumbnailPath = `media/thumbnails/${mediaId}.jpg`;
    const [thumbnailExists] = await bucket.file(thumbnailPath).exists();

    if (thumbnailExists) {
        console.log(`[onMediaFileUploaded] Thumbnail already exists: ${thumbnailPath}`);
        return;
    }

    // Download PDF to temp directory
    const tempDir = os.tmpdir();
    const tempPdfPath = path.join(tempDir, `${mediaId}.pdf`);
    const tempThumbDir = path.join(tempDir, `thumb_${mediaId}`);

    try {
        // Create temp directory for thumbnail output
        if (!fs.existsSync(tempThumbDir)) {
            fs.mkdirSync(tempThumbDir, { recursive: true });
        }

        // Download PDF
        await bucket.file(filePath).download({ destination: tempPdfPath });
        console.log(`[onMediaFileUploaded] Downloaded PDF to: ${tempPdfPath}`);

        // Generate thumbnail
        const thumbnailLocalPath = await generatePdfThumbnail(tempPdfPath, tempThumbDir);
        console.log(`[onMediaFileUploaded] Generated thumbnail: ${thumbnailLocalPath}`);

        // Upload thumbnail to Storage
        await bucket.upload(thumbnailLocalPath, {
            destination: thumbnailPath,
            metadata: {
                contentType: 'image/jpeg',
                metadata: {
                    firebaseStorageDownloadTokens: require('crypto').randomBytes(16).toString('hex')
                }
            }
        });
        console.log(`[onMediaFileUploaded] Uploaded thumbnail to: ${thumbnailPath}`);

        // Get public URL
        const file = bucket.file(thumbnailPath);
        const [metadata] = await file.getMetadata();
        const token = metadata.metadata.firebaseStorageDownloadTokens;
        const thumbnailUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(thumbnailPath)}?alt=media&token=${token}`;

        // Update Firestore document
        const db = admin.firestore();
        const mediaQuery = await db.collection('media')
            .where('storagePath', '==', filePath)
            .limit(1)
            .get();

        if (!mediaQuery.empty) {
            const mediaDoc = mediaQuery.docs[0];
            await mediaDoc.ref.update({
                thumbnailUrl: thumbnailUrl,
                thumbnailGeneratedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`[onMediaFileUploaded] Updated Firestore document: ${mediaDoc.id}`);
        } else {
            console.warn(`[onMediaFileUploaded] No Firestore document found for: ${filePath}`);
        }

        // Cleanup temp files
        fs.unlinkSync(tempPdfPath);
        fs.unlinkSync(thumbnailLocalPath);
        fs.rmdirSync(tempThumbDir);

    } catch (error) {
        console.error(`[onMediaFileUploaded] Error processing ${filePath}:`, error);
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
            console.error('[onMediaFileUploaded] Cleanup error:', cleanupError);
        }
    }
});

/**
 * Callable Function: Batch generates thumbnails for all PDFs without thumbnails
 * Call this after deployment to process existing PDFs
 */
exports.generateMissingThumbnails = onCall(async (request) => {
    // Check authentication
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Check if user is admin
    const userRole = request.auth.token.role;
    if (userRole !== 'admin') {
        throw new HttpsError('permission-denied', 'Only admins can generate thumbnails');
    }

    console.log('[generateMissingThumbnails] Starting batch thumbnail generation...');

    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    // Get all PDF media items
    const mediaSnapshot = await db.collection('media')
        .where('mimeType', '==', 'application/pdf')
        .get();

    let generated = 0;
    let skipped = 0;
    const errors = [];

    for (const doc of mediaSnapshot.docs) {
        const mediaData = doc.data();
        const mediaId = doc.id;
        const storagePath = mediaData.storagePath;

        // Skip if thumbnail already exists in Firestore
        if (mediaData.thumbnailUrl) {
            console.log(`[generateMissingThumbnails] Skipping ${mediaId}: already has thumbnailUrl`);
            skipped++;
            continue;
        }

        // Check if thumbnail exists in Storage
        const thumbnailPath = `media/thumbnails/${mediaId}.jpg`;
        const [thumbnailExists] = await bucket.file(thumbnailPath).exists();

        if (thumbnailExists) {
            console.log(`[generateMissingThumbnails] Skipping ${mediaId}: thumbnail exists in storage`);
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

            // Download PDF
            await bucket.file(storagePath).download({ destination: tempPdfPath });

            // Generate thumbnail
            const thumbnailLocalPath = await generatePdfThumbnail(tempPdfPath, tempThumbDir);

            // Upload thumbnail
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

            console.log(`[generateMissingThumbnails] Generated thumbnail for: ${mediaId}`);
            generated++;

            // Cleanup
            fs.unlinkSync(tempPdfPath);
            fs.unlinkSync(thumbnailLocalPath);
            fs.rmdirSync(tempThumbDir);

        } catch (error) {
            console.error(`[generateMissingThumbnails] Error processing ${mediaId}:`, error);
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
                console.error('[generateMissingThumbnails] Cleanup error:', cleanupError);
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

    console.log('[generateMissingThumbnails] Batch processing complete:', summary);
    return summary;
});
