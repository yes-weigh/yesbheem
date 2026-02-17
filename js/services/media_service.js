class MediaService {
    constructor() {
        this.apiBase = (window.appConfig ? window.appConfig.apiUrl : '') + '/api';
    }

    /**
     * Get all media items from Firestore
     */
    async getMedia() {
        try {
            // Ensure Firebase is ready
            if (!window.firebaseContext) {
                console.warn('Firebase context missing');
                return [];
            }
            const { db } = window.firebaseContext;

            // Dynamic imports for SDK functions
            const { collection, getDocs, orderBy, query } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

            const q = query(collection(db, 'media_library'), orderBy('updatedAt', 'desc'));
            const snapshot = await getDocs(q);
            const media = [];

            snapshot.forEach(doc => {
                media.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return media;

        } catch (e) {
            console.error('Service: Failed to load media library', e);
            throw e;
        }
    }

    /**
     * Upload a file to Firebase Storage and create a record in Firestore
     * @param {File} file 
     * @param {Object} metadata { name, language, category }
     */
    async uploadMedia(file, metadata) {
        if (!window.firebaseContext) throw new Error('Firebase context missing');
        const { db, storage } = window.firebaseContext;
        const { ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js");
        const { collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

        try {
            // 1. Upload to Storage
            const storagePath = `media/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, storagePath);

            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            // 2. Identify Type
            let type = 'document';
            if (file.type.startsWith('image/')) type = 'image';
            else if (file.type.startsWith('video/')) type = 'video';

            // 3. Save to Firestore
            const docRef = await addDoc(collection(db, 'media_library'), {
                name: metadata.name || file.name,
                language: metadata.language || null,
                category: metadata.category || null,
                url: downloadURL,
                storagePath: storagePath,
                type: type,
                updatedAt: serverTimestamp(),
                size: file.size,
                mimeType: file.type
            });

            return {
                id: docRef.id,
                url: downloadURL,
                ...metadata
            };

        } catch (e) {
            console.error('Service: Upload failed', e);
            throw e;
        }
    }

    /**
     * Update media metadata
     * @param {string} id 
     * @param {Object} metadata { name, language, category }
     */
    async updateMediaMetadata(id, metadata) {
        if (!window.firebaseContext) throw new Error('Firebase context missing');
        const { db } = window.firebaseContext;
        const { doc, updateDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

        try {
            const docRef = doc(db, 'media_library', id);
            await updateDoc(docRef, {
                ...metadata,
                updatedAt: serverTimestamp()
            });
            return true;
        } catch (e) {
            console.error('Service: Update failed', e);
            throw e;
        }
    }


    /**
     * Upload a generated thumbnail blob and update the media record
     * @param {string} id Media ID
     * @param {Blob} blob Image blob
     */
    async uploadThumbnail(id, blob) {
        if (!window.firebaseContext) throw new Error('Firebase context missing');
        const { db, storage } = window.firebaseContext;
        const { ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js");
        const { doc, updateDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

        try {
            const storagePath = `media/thumbnails/${id}_thumb.jpg`;
            const storageRef = ref(storage, storagePath);

            const snapshot = await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(snapshot.ref);

            const docRef = doc(db, 'media_library', id);
            await updateDoc(docRef, {
                thumbnailUrl: downloadURL,
                updatedAt: serverTimestamp()
            });

            return downloadURL;
        } catch (e) {
            console.error('Service: Thumbnail upload failed', e);
            throw e;
        }
    }

    /**
     * Delete media from Storage and Firestore
     */
    async deleteMedia(id, storagePath) {
        if (!window.firebaseContext) throw new Error('Firebase context missing');
        const { db, storage } = window.firebaseContext;
        const { ref, deleteObject } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js");
        const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

        try {
            // 1. Delete from Storage (if path exists)
            if (storagePath) {
                const storageRef = ref(storage, storagePath);
                await deleteObject(storageRef).catch(err => {
                    console.warn('Storage delete failed (might verify manual cleanup needed):', err);
                });
            }

            // 2. Delete from Firestore
            await deleteDoc(doc(db, 'media_library', id));
            return true;

        } catch (e) {
            console.error('Service: Delete failed', e);
            throw e;
        }
    }
}

window.MediaService = MediaService;
