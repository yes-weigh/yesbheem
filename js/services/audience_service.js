
import { db } from './firebase_config.js';
import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    arrayUnion,
    arrayRemove
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

    /**
     * Get a single audience by ID
     * @param {string} audienceId 
     * @returns {Promise<Object>} Audience data
     */
    async getAudience(audienceId) {
        try {
            const docRef = doc(db, this.collection, audienceId);
            const snapshot = await getDoc(docRef);

            if (!snapshot.exists()) {
                throw new Error('Audience not found');
            }

            return {
                id: snapshot.id,
                ...snapshot.data()
            };
        } catch (error) {
            console.error('Error fetching audience:', error);
            throw error;
        }
    }

    /**
     * Update audience metadata (name, etc.)
     * @param {string} audienceId 
     * @param {Object} updates 
     * @returns {Promise<void>}
     */
    async updateAudience(audienceId, updates) {
        try {
            const docRef = doc(db, this.collection, audienceId);
            await updateDoc(docRef, {
                ...updates,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating audience:', error);
            throw error;
        }
    }

    /**
     * Delete an audience
     * @param {string} audienceId 
     * @returns {Promise<void>}
     */
    async deleteAudience(audienceId) {
        try {
            const docRef = doc(db, this.collection, audienceId);
            await deleteDoc(docRef);
        } catch (error) {
            console.error('Error deleting audience:', error);
            throw error;
        }
    }

    /**
     * Add a contact to an audience
     * @param {string} audienceId 
     * @param {Object} contact - {name, phone}
     * @returns {Promise<void>}
     */
    async addContact(audienceId, contact) {
        try {
            const docRef = doc(db, this.collection, audienceId);

            // Get current audience to update count
            const snapshot = await getDoc(docRef);
            if (!snapshot.exists()) {
                throw new Error('Audience not found');
            }

            const currentData = snapshot.data();
            const currentContacts = currentData.contacts || [];

            // Check for duplicate phone number
            const isDuplicate = currentContacts.some(c => c.phone === contact.phone);
            if (isDuplicate) {
                throw new Error('Contact with this phone number already exists');
            }

            await updateDoc(docRef, {
                contacts: arrayUnion(contact),
                count: currentContacts.length + 1,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error adding contact:', error);
            throw error;
        }
    }

    /**
     * Update a contact in an audience
     * @param {string} audienceId 
     * @param {number} contactIndex 
     * @param {Object} updates - {name, phone}
     * @returns {Promise<void>}
     */
    async updateContact(audienceId, contactIndex, updates) {
        try {
            const docRef = doc(db, this.collection, audienceId);
            const snapshot = await getDoc(docRef);

            if (!snapshot.exists()) {
                throw new Error('Audience not found');
            }

            const currentData = snapshot.data();
            const contacts = [...(currentData.contacts || [])];

            if (contactIndex < 0 || contactIndex >= contacts.length) {
                throw new Error('Invalid contact index');
            }

            // Update the contact at the specified index
            contacts[contactIndex] = {
                ...contacts[contactIndex],
                ...updates
            };

            await updateDoc(docRef, {
                contacts: contacts,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating contact:', error);
            throw error;
        }
    }

    /**
     * Remove a contact from an audience
     * @param {string} audienceId 
     * @param {Object} contact - The exact contact object to remove
     * @returns {Promise<void>}
     */
    async removeContact(audienceId, contact) {
        try {
            const docRef = doc(db, this.collection, audienceId);

            // Get current audience to update count
            const snapshot = await getDoc(docRef);
            if (!snapshot.exists()) {
                throw new Error('Audience not found');
            }

            const currentData = snapshot.data();
            const currentContacts = currentData.contacts || [];

            await updateDoc(docRef, {
                contacts: arrayRemove(contact),
                count: Math.max(0, currentContacts.length - 1),
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error removing contact:', error);
            throw error;
        }
    }

    /**
     * Validate phone number format
     * @param {string} phone 
     * @returns {Object} {valid: boolean, normalized: string, error: string}
     */
    validatePhoneNumber(phone) {
        if (!phone || typeof phone !== 'string') {
            return { valid: false, error: 'Phone number is required' };
        }

        // Remove all spaces and dashes
        const cleaned = phone.replace(/[\s-]/g, '');

        // Indian phone number regex: Optional +91, then 10 digits starting with 6-9
        const regex = /^(\+91)?[6-9]\d{9}$/;

        if (!regex.test(cleaned)) {
            return {
                valid: false,
                error: 'Invalid format. Use: +919876543210 or 9876543210'
            };
        }

        // Normalize to E.164 format (+91XXXXXXXXXX)
        const normalized = cleaned.startsWith('+91')
            ? cleaned
            : '+91' + cleaned;

        return { valid: true, normalized, error: null };
    }
}
