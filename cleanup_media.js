const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: 'yesweighmomentumhub.firebasestorage.app'
    });
}
const db = admin.firestore();
const bucket = admin.storage().bucket();

const DRY_RUN = false; // Set to false to actually delete

async function run() {
    console.log(`Starting Cleanup (${DRY_RUN ? 'DRY RUN' : 'LIVE DELETION'})...`);

    try {
        // 1. Get Valid Media from Firestore
        console.log('Fetching valid media from Firestore...');
        const snapshot = await db.collection('media_library').get();
        const validStoragePaths = new Set();
        const validThumbnailPaths = new Set();

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.storagePath) {
                validStoragePaths.add(data.storagePath);
            }
            // Add expected thumbnail path (doc.id based)
            validThumbnailPaths.add(`media/thumbnails/${doc.id}.jpg`);

            // Also check if thumbnailUrl is a direct storage path (unlikely but good to check)
            if (data.thumbnailUrl && data.thumbnailUrl.includes('o/')) {
                // Try to decode if it's a signed URL, but relying on ID-based path is safer for this structure
            }
        });

        console.log(`Found ${snapshot.size} valid media entries.`);
        console.log(`Valid Paths: ${validStoragePaths.size}, Valid Thumbnails: ${validThumbnailPaths.size}`);

        // 2. List Files in 'media/' using Stream/Pagination to handle large number of files
        console.log('Listing files in Storage (prefix: media/)...');
        //const [files] = await bucket.getFiles({ prefix: 'media/' });

        let files = [];
        const options = { prefix: 'media/', autoPaginate: false };
        let query = await bucket.getFiles(options);

        // Handle pagination manually or just use autoPaginate: true (default for getFiles, but let's be explicit)
        // Actually, bucket.getFiles() by default fetches ALL unless autoPaginate: false is set.
        // Given the delay, it might be better to just proceed with the list we got, or trust getFiles() handles it.
        // Let's stick to getFiles() as it worked in dry run, just took time.
        // Re-declaring for clarity in replacement
        const [allFiles] = await bucket.getFiles({ prefix: 'media/' });
        files = allFiles;

        console.log(`Found ${files.length} total files in 'media/' folder.`);

        const toDelete = [];
        const kept = [];

        for (const file of files) {
            // Skip folder placeholders/directories if any
            if (file.name.endsWith('/')) continue;

            const isOriginal = validStoragePaths.has(file.name);
            const isThumbnail = validThumbnailPaths.has(file.name);

            if (isOriginal || isThumbnail) {
                kept.push(file.name);
            } else {
                toDelete.push(file);
            }
        }

        console.log('\n--- SUMMARY ---');
        console.log(`Kept: ${kept.length}`);
        console.log(`To Delete: ${toDelete.length}`);

        if (toDelete.length > 0) {
            console.log('\nFiles to be deleted:');
            toDelete.forEach(f => console.log(` - ${f.name} (${(f.metadata.size / 1024).toFixed(2)} KB)`));

            if (!DRY_RUN) {
                console.log('\nDELETING FILES in 5 seconds... Press Ctrl+C to cancel.');
                await new Promise(r => setTimeout(r, 5000));

                let deletedCount = 0;
                for (const file of toDelete) {
                    await file.delete();
                    console.log(`Deleted: ${file.name}`);
                    deletedCount++;
                }
                console.log(`\nSuccessfully deleted ${deletedCount} files.`);
            } else {
                console.log('\n[DRY RUN] No files were deleted. Change DRY_RUN to false to execute.');
            }
        } else {
            console.log('Storage is clean! No orphaned files found.');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

run();
