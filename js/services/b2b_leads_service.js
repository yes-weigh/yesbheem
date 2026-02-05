/**
 * B2BLeadsService
 * Handles Firestore operations for B2B Leads
 */
import { db, app } from './firebase_config.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class B2BLeadsService {
    constructor() {
        this.collectionName = 'b2b_leads';
        this.db = db;
    }

    /**
     * Fetch all leads from Firestore
     * @returns {Promise<Array>} Array of lead objects
     */
    async getAllLeads() {
        try {
            console.log('[B2BLeadsService] Fetching all leads...');
            const querySnapshot = await getDocs(collection(this.db, this.collectionName));
            const leads = [];
            querySnapshot.forEach((doc) => {
                leads.push({ id: doc.id, ...doc.data() });
            });
            console.log(`[B2BLeadsService] Fetched ${leads.length} leads.`);
            return leads;
        } catch (error) {
            console.error('[B2BLeadsService] Error fetching leads:', error);
            throw error;
        }
    }

    /**
     * Add a new lead
     * @param {Object} leadData 
     * @returns {Promise<Object>} Created lead with ID
     */
    async addLead(leadData) {
        try {
            // Ensure mandatory field phone is present (though UI should handle this)
            if (!leadData.phone) {
                throw new Error('Phone number is mandatory');
            }

            const docRef = await addDoc(collection(this.db, this.collectionName), {
                ...leadData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            console.log('[B2BLeadsService] Lead created with ID:', docRef.id);
            return { id: docRef.id, ...leadData };
        } catch (error) {
            console.error('[B2BLeadsService] Error adding lead:', error);
            throw error;
        }
    }

    /**
     * Update an existing lead
     * @param {string} id 
     * @param {Object} updates 
     */
    async updateLead(id, updates) {
        try {
            const leadRef = doc(this.db, this.collectionName, id);
            await updateDoc(leadRef, {
                ...updates,
                updatedAt: new Date().toISOString()
            });
            console.log('[B2BLeadsService] Lead updated:', id);
        } catch (error) {
            console.error('[B2BLeadsService] Error updating lead:', error);
            throw error;
        }
    }

    /**
     * Delete a lead
     * @param {string} id 
     */
    async deleteLead(id) {
        try {
            await deleteDoc(doc(this.db, this.collectionName, id));
            console.log('[B2BLeadsService] Lead deleted:', id);
        } catch (error) {
            console.error('[B2BLeadsService] Error deleting lead:', error);
            throw error;
        }
    }

    /**
     * Batch import leads
     * @param {Array} leadsArray 
     */
    async importLeads(leadsArray) {
        try {
            console.log(`[B2BLeadsService] Starting batch import of ${leadsArray.length} leads...`);
            const batchSize = 500;
            const chunks = [];

            for (let i = 0; i < leadsArray.length; i += batchSize) {
                chunks.push(leadsArray.slice(i, i + batchSize));
            }

            for (const chunk of chunks) {
                const batch = writeBatch(this.db);
                chunk.forEach(lead => {
                    const docRef = doc(collection(this.db, this.collectionName)); // Auto-ID
                    batch.set(docRef, {
                        ...lead,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                });
                await batch.commit();
                console.log(`[B2BLeadsService] Committed batch of ${chunk.length} leads.`);
            }
            console.log('[B2BLeadsService] Import complete.');
        } catch (error) {
            console.error('[B2BLeadsService] Error importing leads:', error);
            throw error;
        }
    }
}
