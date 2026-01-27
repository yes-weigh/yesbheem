/**
 * Utility functions for Campaign Processing
 * Usage: Import when processing campaign messages to resolve dynamic variables.
 */

import { db } from '../services/firebase_config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const CampaignUtils = {

    /**
     * Resolves key account manager phone number for a dealer
     * @param {Object} dealer - Dealer object (must contain key_account_manager)
     * @returns {Promise<string>} - Phone number or default fallback
     */
    async resolveKamPhone(dealer) {
        if (!dealer || !dealer.key_account_manager) {
            console.warn('Dealer has no KAM assigned:', dealer?.customer_name);
            return null;
        }

        const kamName = dealer.key_account_manager;

        // Fetch Settings to find KAM phone
        // ideally this should be cached or passed in contexts
        try {
            const settingsRef = doc(db, 'settings', 'general');
            const settingsSnap = await getDoc(settingsRef);

            if (settingsSnap.exists()) {
                const data = settingsSnap.data();
                const keyAccounts = data.key_accounts || []; // Array of {name, phone} or strings

                const kamObj = keyAccounts.find(k => {
                    if (typeof k === 'string') return k === kamName;
                    return k.name === kamName;
                });

                if (kamObj && typeof kamObj === 'object' && kamObj.phone) {
                    return kamObj.phone;
                }
            }
        } catch (e) {
            console.error('Error resolving KAM phone:', e);
        }

        return null;
    },

    /**
     * Prepares a template for sending by resolving dynamic content
     * @param {Object} template - The original template object
     * @param {Object} dealer - The target dealer
     * @returns {Promise<Object>} - Processed template copy ready for sending
     */
    async prepareTemplateForSending(template, dealer) {
        // Deep copy to avoid mutating original
        const processed = JSON.parse(JSON.stringify(template));

        // 1. Resolve Buttons
        if (processed.buttons && Array.isArray(processed.buttons)) {
            for (let i = 0; i < processed.buttons.length; i++) {
                const btn = processed.buttons[i];

                // Check if Dynamic KAM
                if (btn.type === 'call' && (btn.dynamicKam === true || btn.value === '{{KAM_PHONE}}')) {
                    const kamPhone = await this.resolveKamPhone(dealer);
                    if (kamPhone) {
                        btn.value = kamPhone;
                        // Clean up flag so downstream providers don't get confused (optional)
                        delete btn.dynamicKam;
                    } else {
                        console.warn(`Could not resolve KAM phone for dealer ${dealer.customer_name}. Using fallback or leaving empty.`);
                        // Fallback logic could go here (e.g. general support number)
                    }
                }
            }
        }

        // 2. Future: Resolve {{name}} etc. in body text
        // ...

        return processed;
    }
};
