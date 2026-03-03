/**
 * AI Chatbot Tools API Wrapper
 * 
 * Provides a clean, standardized, and promise-based interface for an AI Chatbot
 * to interact with the web application's frontend managers and backend logic.
 * 
 * Dependencies: Relies on global manager instances (window.dealerManager, 
 * window.b2bLeadsManager, window.mediaManager, window.templateManager) being initialized.
 */

export class AIChatbotTools {
    constructor() {
        console.log("AIChatbotTools initialized. Ready for AI Agent integration.");
    }

    // ==========================================
    // 1. DEALER TOOLS
    // ==========================================

    /**
     * Search for dealers based on a query and optional filters.
     * @param {string} query - Text to search (name, phone, etc.)
     * @param {Object} filters - Optional filters: { kam, stage, state, district }
     * @returns {Promise<Array>} List of matching dealer objects.
     */
    async searchDealers(query = '', filters = {}) {
        try {
            if (!window.dealerManager) throw new Error("DealerManager not available.");

            // For a true search without disrupting the user's UI, we filter the raw data array
            let data = window.dataManager?.dealerData || [];

            if (query) {
                const q = query.toLowerCase();
                data = data.filter(d =>
                    (d.customer_name || '').toLowerCase().includes(q) ||
                    (d.first_name || '').toLowerCase().includes(q) ||
                    (d.mobile_phone || '').includes(q)
                );
            }

            if (filters.kam) {
                data = data.filter(d => d.key_account_manager === filters.kam);
            }
            if (filters.stage) {
                data = data.filter(d => d.dealer_stage === filters.stage);
            }
            if (filters.state) {
                data = data.filter(d => (d.state || '').toLowerCase() === filters.state.toLowerCase());
            }

            return data;
        } catch (error) {
            console.error("error in searchDealers:", error);
            throw error;
        }
    }

    /**
     * Get detailed information for a specific dealer.
     * @param {string} dealerId - The unique ID or name of the dealer.
     * @returns {Promise<Object>} Dealer object.
     */
    async getDealerDetails(dealerId) {
        try {
            if (!window.dataManager) throw new Error("DataManager not available.");
            const dealer = window.dataManager.dealerData.find(d => d.customer_name === dealerId || d.id === dealerId);
            if (!dealer) throw new Error(`Dealer not found: ${dealerId}`);

            // Optionally, we could also fetch CRM logs here if needed by the AI
            // const logs = await window.dealerManager.service.getLogs(dealerId);
            // dealer._logs = logs;

            return dealer;
        } catch (error) {
            console.error("error in getDealerDetails:", error);
            throw error;
        }
    }

    /**
     * Update a dealer's properties (Stage, KAM, Email, Phone, etc.)
     * @param {string} dealerId - The dealer to update.
     * @param {Object} updates - Property updates.
     * @returns {Promise<boolean>} Success status.
     */
    async updateDealer(dealerId, updates) {
        try {
            if (!window.dealerManager) throw new Error("DealerManager not available.");
            const dealer = await this.getDealerDetails(dealerId);

            // Merge updates
            const updatedDealer = { ...dealer, ...updates };

            // Call the existing service method directly bypassing UI prompts
            await window.dealerManager.service.updateDealer(dealer.customer_name, updatedDealer);

            // Try to refresh UI if we are on the dealer page
            if (typeof window.dealerManager.loadData === 'function') {
                window.dealerManager.loadData(true);
            }

            return true;
        } catch (error) {
            console.error("error in updateDealer:", error);
            throw error;
        }
    }

    /**
     * Perform a bulk action on a set of dealers.
     * @param {string} action - Action type: 'assign_kam', 'deactivate'
     * @param {Array<string>} dealerIds - List of dealer IDs/names
     * @param {Object} payload - Additional data (e.g., { kamName: "John Doe" })
     * @returns {Promise<boolean>} Success status.
     */
    async performBulkDealerAction(action, dealerIds, payload = {}) {
        try {
            if (!window.dealerManager) throw new Error("DealerManager not available.");

            if (action === 'assign_kam' && payload.kamName) {
                await window.dealerManager.service.bulkAssignKAM(dealerIds, payload.kamName);
            } else if (action === 'deactivate') {
                await window.dealerManager.service.bulkDeactivate(dealerIds);
            } else {
                throw new Error(`Unsupported bulk action or missing payload: ${action}`);
            }

            if (typeof window.dealerManager.loadData === 'function') {
                window.dealerManager.loadData(true);
            }
            return true;
        } catch (error) {
            console.error("error in performBulkDealerAction:", error);
            throw error;
        }
    }

    // ==========================================
    // 2. B2B LEADS TOOLS
    // ==========================================

    /**
     * Search for B2B Leads.
     * @param {string} query - Text search query.
     * @param {Object} filters - Optional filters: { status, district }
     * @returns {Promise<Array>} Matching leads.
     */
    async searchLeads(query = '', filters = {}) {
        try {
            if (!window.b2bLeadsManager) throw new Error("B2BLeadsManager not available.");

            let data = window.b2bLeadsManager.leads || [];

            if (query) {
                const q = query.toLowerCase();
                data = data.filter(l =>
                    (l.Company_Name || '').toLowerCase().includes(q) ||
                    (l.Contact_Person || '').toLowerCase().includes(q) ||
                    (l.Phone_Number || '').includes(q)
                );
            }

            if (filters.status) {
                data = data.filter(l => l.Status === filters.status);
            }
            if (filters.district) {
                data = data.filter(l => (l.District || '').toLowerCase() === filters.district.toLowerCase());
            }

            return data;
        } catch (error) {
            console.error("error in searchLeads:", error);
            throw error;
        }
    }

    /**
     * Get detailed information for a specific lead.
     * @param {string} leadId - Document ID in Firestore.
     * @returns {Promise<Object>} Lead object.
     */
    async getLeadDetails(leadId) {
        try {
            if (!window.b2bLeadsManager) throw new Error("B2BLeadsManager not available.");
            const lead = window.b2bLeadsManager.leads.find(l => l.id === leadId);
            if (!lead) throw new Error(`Lead not found: ${leadId}`);
            return lead;
        } catch (error) {
            console.error("error in getLeadDetails:", error);
            throw error;
        }
    }

    /**
     * Create or update a B2B Lead.
     * @param {Object} payload - Lead data object.
     * @param {string} [leadId] - Provided if updating an existing lead.
     * @returns {Promise<string>} The new or updated lead ID.
     */
    async createOrUpdateLead(payload, leadId = null) {
        try {
            if (!window.b2bLeadsManager) throw new Error("B2BLeadsManager not available.");

            if (leadId) {
                await window.b2bLeadsManager.service.updateLead(leadId, payload);
                return leadId;
            } else {
                const newId = await window.b2bLeadsManager.service.addLead(payload);
                return newId;
            }
        } catch (error) {
            console.error("error in createOrUpdateLead:", error);
            throw error;
        }
    }

    /**
     * Add a CRM log to a specific lead.
     * @param {string} leadId - The lead ID.
     * @param {string} content - Log description/message.
     * @param {string} logType - e.g., 'Info', 'Warning', 'Action'
     * @returns {Promise<boolean>} Success status.
     */
    async addLeadLog(leadId, content, logType = 'Info') {
        try {
            if (!window.b2bLeadsManager) throw new Error("B2BLeadsManager not available.");
            // Utilizes the built-in automated logging feature
            await window.b2bLeadsManager.createAutomatedLog(leadId, content);
            return true;
        } catch (error) {
            console.error("error in addLeadLog:", error);
            throw error;
        }
    }

    // ==========================================
    // 3. MEDIA TOOLS
    // ==========================================

    /**
     * Search available media assets.
     * @param {string} query - Optional search term (looks in description/filename).
     * @param {Object} filters - Optional filters: { category, language }
     * @returns {Promise<Array>} Media objects.
     */
    async searchMedia(query = '', filters = {}) {
        try {
            if (!window.mediaManager) throw new Error("MediaManager not available.");
            let data = window.mediaManager.media || [];

            if (filters.category && filters.category !== 'All') {
                data = data.filter(m => (m.category || 'General') === filters.category);
            }
            if (filters.language && filters.language !== 'All') {
                data = data.filter(m => (m.language || 'English') === filters.language);
            }
            if (query) {
                const q = query.toLowerCase();
                data = data.filter(m =>
                    (m.name || '').toLowerCase().includes(q) ||
                    (m.description || '').toLowerCase().includes(q)
                );
            }

            return data;
        } catch (error) {
            console.error("error in searchMedia:", error);
            throw error;
        }
    }

    /**
     * Get a public URL for a media file (useful for including in WhatsApp messages).
     * @param {string} mediaId - The media ID.
     * @returns {Promise<string>} Downloadable URL.
     */
    async getMediaUrl(mediaId) {
        try {
            if (!window.mediaManager) throw new Error("MediaManager not available.");
            const media = window.mediaManager.media.find(m => m.id === mediaId);
            if (!media) throw new Error(`Media not found: ${mediaId}`);

            return media.url;
        } catch (error) {
            console.error("error in getMediaUrl:", error);
            throw error;
        }
    }

    // ==========================================
    // 4. TEMPLATE TOOLS
    // ==========================================

    /**
     * Search WhatsApp templates.
     * @param {string} query - Text search.
     * @param {Object} filters - { status, language, category }
     * @returns {Promise<Array>} Template objects.
     */
    async searchTemplates(query = '', filters = {}) {
        try {
            if (!window.templateManager) throw new Error("TemplateManager not available.");
            let data = window.templateManager.templates || [];

            if (filters.status && filters.status !== 'All') {
                data = data.filter(t => (t.status || 'DRAFT') === filters.status);
            }
            if (filters.language && filters.language !== 'All') {
                data = data.filter(t => (t.language || 'en') === filters.language);
            }
            if (filters.category && filters.category !== 'All') {
                data = data.filter(t => (t.category || 'MARKETING') === filters.category);
            }
            if (query) {
                const q = query.toLowerCase();
                data = data.filter(t => (t.name || '').toLowerCase().includes(q));
            }

            return data;
        } catch (error) {
            console.error("error in searchTemplates:", error);
            throw error;
        }
    }

    /**
     * Create a new message template (Saves as Draft).
     * @param {Object} payload - Complete template payload following WATI structure.
     * @returns {Promise<string>} Template ID.
     */
    async createTemplate(payload) {
        try {
            if (!window.templateManager) throw new Error("TemplateManager not available.");
            // Directly interact with the service logic instead of the UI handleSave
            const result = await window.templateManager.service.saveTemplate(payload);

            // Refresh UI if on the Template page
            if (typeof window.templateManager.refreshTemplates === 'function') {
                window.templateManager.refreshTemplates();
            }
            return result.id;
        } catch (error) {
            console.error("error in createTemplate:", error);
            throw error;
        }
    }

    // ==========================================
    // 5. ENGAGEMENT TOOLS (Cross-Cutting)
    // ==========================================

    /**
     * Fetches the WhatsApp chat history for a given phone number.
     * Useful for giving the AI context before it replies.
     * @param {string} phone - Target phone number.
     * @returns {Promise<Array>} List of chat messages.
     */
    async getChatHistory(phone) {
        try {
            if (!window.dealerManager && !window.b2bLeadsManager) {
                throw new Error("Cannot access chat history. Required managers missing.");
            }

            // If we have b2bl_service loaded, use its standard fetch logic to WATI API
            // For now, depending on which page we are on, we might rely on different globals.
            // Using b2bLeads logic which has a clear WATI fetch:
            const response = await fetch(`https://asia-south1-yesbheem-f3db3.cloudfunctions.net/api/wati/messages/${phone}`);
            if (!response.ok) throw new Error("Failed to fetch chat history");
            const data = await response.json();
            return data.items || [];
        } catch (error) {
            console.error("error in getChatHistory:", error);
            throw error;
        }
    }
}

// Attach to window so it's globally available
window.aiChatbotTools = new AIChatbotTools();
