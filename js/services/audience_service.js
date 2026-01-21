
import { db } from './firebase_config.js';
import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class AudienceService {
    constructor() {
        this.collection = 'audiences';
    }

    /**
     * Create a new audience
     * @param {Object} data 
     * @returns {Promise<string>} new audience ID
     */
    async createAudience(data) {
        try {
            const payload = {
                ...data,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, this.collection), payload);
            return docRef.id;
        } catch (error) {
            console.error('Error creating audience:', error);
            throw error;
        }
    }

    /**
     * Get all audiences, optionally filtered
     * @returns {Promise<Array>} List of audiences
     */
    async getAudiences() {
        try {
            const q = query(
                collection(db, this.collection),
                orderBy('createdAt', 'desc')
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error fetching audiences:', error);
            throw error;
        }
    }
}
