/**
 * Zip Code Resolver Utilities
 * Handles zip code to district/state resolution using external API and caching
 */

import { db } from '../services/firebase_config.js';
import { doc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Zip Code Resolver Class
 * Manages zip code resolution with caching and API integration
 */
export class ZipCodeResolver {
    constructor(zipCache = {}, invalidZips = new Set()) {
        this.zipApiUrl = 'https://api.postalpincode.in/pincode/';
        this.zipCache = zipCache;
        this.invalidZips = invalidZips;
    }

    /**
     * Resolves a Zip code to a District using the external API
     * Implements caching to avoid rate limits
     */
    async getDistrictFromZip(zipCode) {
        if (!zipCode) return null;

        // Check cache first
        if (this.zipCache[zipCode]) {
            return this.zipCache[zipCode];
        }

        const location = await this.getLocationFromZip(zipCode);
        return location ? location.district : null;
    }

    /**
     * Resolves a Zip code to both District and State using the external API
     * Returns { district, state } or null
     */
    async getLocationFromZip(zipCode) {
        if (!zipCode) return null;

        // Note: We don't check simple zipCache here because it only stores District.
        // If we want State, we prefer to hit the API if not cached in a richer cache.
        // For now, we always hit API for the full location details (Edit Form use case).

        try {
            // Add a small delay to be nice to the API if we are making many requests
            const response = await fetch(`${this.zipApiUrl}${zipCode}`);
            const data = await response.json();

            if (data && data[0].Status === "Success" && data[0].PostOffice && data[0].PostOffice.length > 0) {
                const district = data[0].PostOffice[0].District;
                const state = data[0].PostOffice[0].State;

                // Update local district cache (legacy support)
                this.zipCache[zipCode] = district;

                // Write back to Firestore (legacy support)
                await this.writeZipToFirebase(zipCode, district);

                return { district, state };
            }
        } catch (error) {
            console.warn(`Failed to resolve zip location ${zipCode}:`, error);
        }
        return null;
    }

    /**
     * Writes a resolved zip code to Firestore
     */
    async writeZipToFirebase(zip, district) {
        try {
            console.log(`[Debug] Writing zip to Firestore: ${zip}, ${district}`);
            const docRef = doc(db, "settings", "zip_codes");

            // Use updateDoc to add/merge a specific field
            await updateDoc(docRef, {
                [zip]: district
            });
            console.log(`[Debug] Saved zip ${zip} to Firestore.`);
        } catch (e) {
            console.warn('[Debug] Failed to write zip to Firestore:', e);
            // If document doesn't exist (edge case if creation failed), try setDoc with merge
            if (e.code === 'not-found') {
                await setDoc(doc(db, "settings", "zip_codes"), { [zip]: district }, { merge: true });
            }
        }
    }

    /**
     * Normalizes district names to match our internal keys
     */
    normalizeDistrictName(districtName, validList = []) {
        if (!districtName) return null;
        const lower = districtName.toLowerCase().trim();
        const cleanId = lower.replace(/\s+/g, '-');

        // Check against valid list first
        if (validList.includes(cleanId)) return cleanId;
        if (validList.includes(lower)) return lower;

        // Fallback for complex matches (Kerala legacy)
        const map = {
            'trivandrum': 'thiruvananthapuram',
            'calicut': 'kozhikode',
            'alleppey': 'alappuzha',
            'cochin': 'ernakulam',
            'kochi': 'ernakulam',
            'trichur': 'thrissur',
            'palghat': 'palakkad',
            'cannanore': 'kannur',
            'kasargod': 'kasaragod'
        };

        const mapped = map[lower];
        if (mapped && validList.includes(mapped)) return mapped;

        return null;
    }

    /**
     * Resolves districts for ALL dealers in the raw data.
     * Checks against cache, fetches missing ones, updates Firebase.
     */
    async resolveMissingDistricts(allData, saveCacheCallback) {
        if (!allData || allData.length === 0) return;

        console.log(`[District Check] Scanning ${allData.length} dealers for missing district usage...`);
        const missingZips = new Set();
        let checkedCount = 0;

        allData.forEach(row => {
            let zip = row['billing_zipcode'] || row['shipping_zipcode'];
            if (!zip) return;
            zip = zip.replace(/\s/g, '');

            // Skip known invalid zip codes
            if (this.invalidZips.has(zip)) {
                return;
            }

            // Check if we have a mapping
            if (!this.zipCache[zip]) {
                missingZips.add(zip);
            }
            checkedCount++;
        });

        if (missingZips.size === 0) {
            console.log(`[District Check] All ${checkedCount} valid zips are mapped! Good to go.`);
            return;
        }

        console.log(`[District Check] Found ${missingZips.size} unique zip codes missing district info.`);
        console.log(`[District Check] Starting auto-fetch sequence...`);

        let fetched = 0;
        const total = missingZips.size;

        for (const zip of missingZips) {
            fetched++;
            // Fetch logic handles caching and Firebase write
            const district = await this.getDistrictFromZip(zip);

            if (district) {
                console.log(`[District Fetch] (${fetched}/${total}) Resolved ${zip} -> ${district}`);
            } else {
                console.log(`[District Fetch] (${fetched}/${total}) Failed to resolve ${zip}`);
            }

            // Small delay to be polite to API
            await new Promise(r => setTimeout(r, 200));
        }

        console.log(`[District Check] Update complete. New mappings saved to Firebase.`);
        if (saveCacheCallback) {
            saveCacheCallback();
        }
    }
}
