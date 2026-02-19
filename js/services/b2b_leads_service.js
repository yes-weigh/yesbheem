/**
 * B2BLeadsService
 * Handles Firestore operations for B2B Leads
 */
import { db, app } from './firebase_config.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, writeBatch, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class B2BLeadsService {
    constructor() {
        this.collectionName = 'b2b_leads_aggregated'; // New sharded collection
        this.legacyCollection = 'b2b_leads'; // Old collection for migration
        this.db = db;
        this.shardSize = 2500; // Max items per shard (approx 1MB safety limit)
    }

    /**
     * Fetch all leads from sharded aggregated documents
     * @returns {Promise<Array>} Array of lead objects
     */
    async getAllLeads() {
        try {
            console.log('[B2BLeadsService] Fetching all leads (Sharded)...');
            const startFetch = performance.now();
            const querySnapshot = await getDocs(collection(this.db, this.collectionName));
            console.log(`[Performance] Firestore Network Request took: ${(performance.now() - startFetch).toFixed(2)}ms`);

            // Check if we have data in new format
            if (querySnapshot.empty) {
                console.warn('[B2BLeadsService] No sharded data found. Checking legacy...');
                // Fallback to legacy if migration hasn't run? 
                // Or return empty if truly new.
                // Let's check legacy count to hint migration
                const legacySnap = await getDocs(collection(this.db, this.legacyCollection));
                if (!legacySnap.empty) {
                    console.warn(`[B2BLeadsService] Found ${legacySnap.size} legacy docs. Migration recommended.`);
                    // Optional: Return legacy data for now? 
                    // Better to force migration or return legacy to not break app.
                    // Let's return legacy for now until migration runs
                    const legacyLeads = [];
                    legacySnap.forEach(doc => legacyLeads.push({ id: doc.id, ...doc.data() }));
                    return legacyLeads;
                }
                return [];
            }

            let allLeads = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (Array.isArray(data.items)) {
                    // Tag items with shard ID for updates
                    const itemsWithShard = data.items.map(item => ({
                        ...item,
                        _shardId: doc.id // Internal use for updates
                    }));
                    allLeads = allLeads.concat(itemsWithShard);
                }
            });

            console.log(`[B2BLeadsService] Fetched ${allLeads.length} leads from ${querySnapshot.size} shards.`);
            return allLeads;
        } catch (error) {
            console.error('[B2BLeadsService] Error fetching leads:', error);
            throw error;
        }
    }

    /**
     * Add a new lead to the last shard
     * @param {Object} leadData 
     * @returns {Promise<Object>} Created lead with ID
     */
    async addLead(leadData) {
        try {
            // Ensure mandatory field phone is present
            if (!leadData.phone) {
                throw new Error('Phone number is mandatory');
            }

            const newId = doc(collection(this.db, this.legacyCollection)).id; // Generate ID
            const newLead = {
                id: newId,
                ...leadData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Find valid shard to write to
            // We want the last shard (lexicographically)
            const shardsSnap = await getDocs(collection(this.db, this.collectionName));
            let targetShardId = 'shard_000';
            let targetShardData = { items: [] };

            if (!shardsSnap.empty) {
                // simple sort
                const shards = [];
                shardsSnap.forEach(doc => shards.push({ id: doc.id, ...doc.data() }));
                shards.sort((a, b) => a.id.localeCompare(b.id)); // shard_000, shard_001

                const lastShard = shards[shards.length - 1];
                if (lastShard.items && lastShard.items.length < this.shardSize) {
                    targetShardId = lastShard.id;
                    targetShardData = lastShard;
                } else {
                    // Create new shard
                    const nextIndex = parseInt(lastShard.id.split('_')[1]) + 1;
                    targetShardId = `shard_${String(nextIndex).padStart(3, '0')}`;
                    // targetShardData stays empty
                }
            }

            const shardRef = doc(this.db, this.collectionName, targetShardId);

            // Add to items
            // We need to re-fetch to be safe? Firestore arrayUnion is safe but doesn't check size limit.
            // Since we just fetched, race condition is possible but low risk for this internal app.
            // Using arrayUnion
            await updateDoc(shardRef, {
                items: window.firebase.firestore.FieldValue.arrayUnion(newLead)
            }).catch(async (err) => {
                // If doc doesn't exist (new shard), set it
                if (err.code === 'not-found') {
                    await setDoc(shardRef, { items: [newLead] });
                } else {
                    throw err;
                }
            });

            console.log('[B2BLeadsService] Lead added to', targetShardId);
            return { ...newLead, _shardId: targetShardId };

        } catch (error) {
            console.error('[B2BLeadsService] Error adding lead:', error);
            throw error;
        }
    }

    /**
     * Update an existing lead
     * @param {string} id 
     * @param {Object} updates 
     * @param {string} shardId - Optional, but recommended for performance
     */
    async updateLead(id, updates, shardId = null) {
        try {
            if (!shardId) {
                // Need to find which shard it's in. Expensive!
                // We should ensure UI passes _shardId.
                console.warn('[B2BLeadsService] No shardId provided for update. Scanning all shards...');
                const shardsSnap = await getDocs(collection(this.db, this.collectionName));
                let found = false;

                for (const docSnap of shardsSnap.docs) {
                    const data = docSnap.data();
                    const index = data.items.findIndex(i => i.id === id);
                    if (index !== -1) {
                        shardId = docSnap.id;
                        found = true;
                        break;
                    }
                }
                if (!found) throw new Error('Lead not found in any shard');
            }

            const shardRef = doc(this.db, this.collectionName, shardId);
            const shardSnap = await getDoc(shardRef);

            if (!shardSnap.exists()) throw new Error(`Shard ${shardId} not found`);

            const items = shardSnap.data().items || [];
            const itemIndex = items.findIndex(i => i.id === id);

            if (itemIndex === -1) throw new Error('Lead not found in specified shard');

            // Update item
            items[itemIndex] = {
                ...items[itemIndex],
                ...updates,
                updatedAt: new Date().toISOString()
            };

            await updateDoc(shardRef, { items });
            console.log('[B2BLeadsService] Lead updated in', shardId);

        } catch (error) {
            console.error('[B2BLeadsService] Error updating lead:', error);
            throw error;
        }
    }

    /**
     * Delete a lead
     * @param {string} id 
     * @param {string} shardId - Optional
     */
    async deleteLead(id, shardId = null) {
        try {
            if (!shardId) {
                console.warn('[B2BLeadsService] No shardId provided for delete. Scanning all shards...');
                const shardsSnap = await getDocs(collection(this.db, this.collectionName));
                let found = false;
                for (const docSnap of shardsSnap.docs) {
                    const data = docSnap.data();
                    if (data.items.some(i => i.id === id)) {
                        shardId = docSnap.id;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    console.warn('Lead not found, maybe already deleted');
                    return;
                }
            }

            const shardRef = doc(this.db, this.collectionName, shardId);
            const shardSnap = await getDoc(shardRef);
            const items = shardSnap.data().items || [];

            const newItems = items.filter(i => i.id !== id);

            await updateDoc(shardRef, { items: newItems });
            console.log('[B2BLeadsService] Lead deleted from', shardId);

        } catch (error) {
            console.error('[B2BLeadsService] Error deleting lead:', error);
            throw error;
        }
    }

    /**
     * MIGRATION TOOL: Convert legacy docs to Sharded Structure
     * Warning: DELETES legacy docs after verification.
     */
    async migrateData() {
        console.log('[[ MIGRATION STARTED ]] Fetching legacy leads...');
        const legacyRef = collection(this.db, this.legacyCollection);
        const snapshot = await getDocs(legacyRef);

        if (snapshot.empty) {
            console.log('No legacy leads found to migrate.');
            return;
        }

        const totalDocs = snapshot.size;
        console.log(`Found ${totalDocs} legacy documents.`);

        const allLeads = [];
        snapshot.forEach(doc => {
            allLeads.push({ id: doc.id, ...doc.data() });
        });

        // Create shards
        const chunks = [];
        for (let i = 0; i < allLeads.length; i += this.shardSize) {
            chunks.push(allLeads.slice(i, i + this.shardSize));
        }

        console.log(`Split into ${chunks.length} shards (Size: ${this.shardSize})`);

        // Write shards
        for (let i = 0; i < chunks.length; i++) {
            const shardId = `shard_${String(i).padStart(3, '0')}`;
            const shardRef = doc(this.db, this.collectionName, shardId);
            await setDoc(shardRef, { items: chunks[i] });
            console.log(`Saved ${shardId} with ${chunks[i].length} items.`);
        }

        // Verification
        console.log('Verifying migration...');
        const newSnap = await getDocs(collection(this.db, this.collectionName));
        let newCount = 0;
        newSnap.forEach(d => newCount += (d.data().items || []).length);

        if (newCount === totalDocs) {
            console.log(`VERIFICATION SUCCESS: Migrated ${newCount} / ${totalDocs} items.`);
            console.log('DELETING LEGACY DOCUMENTS...');

            const batchSize = 500; // Limit for batch ops
            const chunks = [];
            const docsToDelete = snapshot.docs;

            for (let i = 0; i < docsToDelete.length; i += batchSize) {
                chunks.push(docsToDelete.slice(i, i + batchSize));
            }

            for (const chunk of chunks) {
                const batch = writeBatch(this.db);
                chunk.forEach(d => batch.delete(d.ref));
                await batch.commit();
                console.log(`Deleted batch of ${chunk.length} legacy docs.`);
            }
            console.log('[[ MIGRATION COMPLETE ]] All legacy data cleaned up.');
            return true;
        } else {
            console.error(`VERIFICATION FAILED: New count ${newCount} != Old count ${totalDocs}. ABORTING DELETE.`);
            return false;
        }
    }

    /**
     * Batch import leads (Updated for Shards)
     */
    async importLeads(leadsArray) {
        // Reuse addLead logic or optimized batch write?
        // For 500 import, we can just calculate shards.
        // For simplicity in this tool, let's use addLead loop or smarter chunking?
        // Let's use smarter chunking for bulk import.

        // Actually, importLeads is likely used for CSV upload.
        // We should just append to last shard, spilling over if needed.
        // For now, simpler implementation:

        console.log(`[B2BLeadsService] Importing ${leadsArray.length} leads...`);
        // Use migrate-like logic: read last shard, append, or new shard.
        // Since we might be importing > shardSize, we need loop.

        // This is complex to implement perfectly atomically without locking.
        // For now, we assume sequential imports or low concurrency.

        let remaining = [...leadsArray];

        while (remaining.length > 0) {
            // Find last shard
            const shardsSnap = await getDocs(collection(this.db, this.collectionName));
            // simple sort
            const shards = [];
            shardsSnap.forEach(doc => shards.push({ id: doc.id, ...doc.data() }));
            shards.sort((a, b) => a.id.localeCompare(b.id));

            let targetShardId = 'shard_000';
            let currentItems = [];

            if (shards.length > 0) {
                const last = shards[shards.length - 1];
                if (last.items.length < this.shardSize) {
                    targetShardId = last.id;
                    currentItems = last.items;
                } else {
                    const nextIndex = parseInt(last.id.split('_')[1]) + 1;
                    targetShardId = `shard_${String(nextIndex).padStart(3, '0')}`;
                    currentItems = [];
                }
            }

            const capacity = this.shardSize - currentItems.length;
            const toAdd = remaining.slice(0, capacity).map(l => ({
                ...l,
                id: l.id || doc(collection(this.db, this.legacyCollection)).id,
                createdAt: new Date().toISOString()
            }));

            const newItems = [...currentItems, ...toAdd];
            const shardRef = doc(this.db, this.collectionName, targetShardId);
            await setDoc(shardRef, { items: newItems }); // Overwrite safe since we read it

            console.log(`Imported ${toAdd.length} items to ${targetShardId}`);
            remaining = remaining.slice(capacity);
        }
    }
}
