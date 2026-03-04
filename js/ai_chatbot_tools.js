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
    // PRIVATE HELPERS
    // ==========================================

    /**
     * Wait up to 3 s for a named window manager to become available.
     * Managers are lazily initialised when the user navigates to their page.
     * @param {string} name - e.g. 'dealerManager'
     * @param {boolean} optional - if true, returns null instead of throwing on timeout
     * @returns {Promise<any>} the manager instance or null
     */
    async _getManager(name, optional = false) {
        const TIMEOUT = 3000;
        const INTERVAL = 150;
        let waited = 0;
        while (!window[name]) {
            if (waited >= TIMEOUT) {
                if (optional) return null;
                throw new Error(`${name} is not available. Please navigate to the relevant page first.`);
            }
            await new Promise(r => setTimeout(r, INTERVAL));
            waited += INTERVAL;
        }
        return window[name];
    }

    /**
     * Get the best available dealer list — with overrides AND all-reports aggregation applied.
     * Priority:
     *   1. window.dealerManager.dealers (if Dealer page was visited this session)
     *   2. localStorage mergedDealersCache (persisted from last Dealer page visit)
     *   3. Live fetch via window.dataManager.dataLayer.getDealerManagementData()
     */
    async _getDealerData() {
        // 1. In-memory — freshest, already merged
        if (window.dealerManager && Array.isArray(window.dealerManager.dealers) && window.dealerManager.dealers.length > 0) {
            return window.dealerManager.dealers;
        }

        // 2. localStorage cache — same merged data, persisted across navigations
        try {
            const cached = localStorage.getItem('mergedDealersCache');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (_) { }

        // 3. Live fetch via DataLayer (reports + overrides merged server-side)
        if (window.dataManager && window.dataManager.dataLayer) {
            const merged = await window.dataManager.dataLayer.getDealerManagementData(false);
            return merged || [];
        }

        return [];
    }

    // ==========================================
    // 1. DEALER TOOLS
    // ==========================================

    /**
     * Search and filter the dealer list with advanced sorting and period selection.
     * @param {string} query - Text to search (name, phone, etc.)
     * @param {Object} filters - Optional filters: { kam, stage, state, district }
     * @param {string} sortBy - Field to sort by (e.g. 'sales', 'customer_name')
     * @param {string} sortOrder - 'asc' or 'desc' (default 'desc')
     * @param {number} limit - Max number of results (default 50)
     * @param {string} period - Optional historical period (e.g. '21-22') to search within.
     * @returns {Promise<Array>} List of matching dealer objects.
     */
    async searchDealers({ query = '', filters = {}, sortBy = '', sortOrder = 'desc', limit = 50, period = null } = {}) {
        try {
            let data = [];

            // 1. Determine data source (Aggregated vs Specific Period)
            if (period && window.dataManager) {
                const reports = await window.dataManager.listReports();
                const periodKeyword = String(period).replace(/20/g, '').trim();
                const matchingReport = reports.find(r => r.name.toLowerCase().includes(periodKeyword.toLowerCase()));

                if (matchingReport) {
                    data = await window.dataManager.loadReportDataFromFirestore(matchingReport.id);
                } else {
                    throw new Error(`Report not found for period: ${period}`);
                }
            } else {
                data = await this._getDealerData();
            }

            if (data.length === 0) {
                return [];
            }

            // 2. Apply text search
            if (query) {
                const q = String(query).toLowerCase();
                data = data.filter(d =>
                    (d.customer_name || d.name || '').toLowerCase().includes(q) ||
                    (d.first_name || '').toLowerCase().includes(q) ||
                    (d.mobile_phone || d.phone || '').includes(q)
                );
            }

            // 3. Apply filters
            if (filters) {
                if (filters.kam) {
                    const k = filters.kam.toLowerCase();
                    data = data.filter(d => (d.key_account_manager || d.kam || '').toLowerCase().includes(k));
                }
                if (filters.stage) {
                    data = data.filter(d => (d.dealer_stage || d.stage) === filters.stage);
                }
                if (filters.state) {
                    const s = filters.state.toLowerCase();
                    data = data.filter(d =>
                        (d.state || d.billing_state || d.shipping_state || '').toLowerCase().includes(s)
                    );
                }
                if (filters.district) {
                    data = data.filter(d => (d.district || '').toLowerCase() === filters.district.toLowerCase());
                }
            }

            // 4. Apply sorting
            if (sortBy) {
                data.sort((a, b) => {
                    let valA = a[sortBy] || 0;
                    let valB = b[sortBy] || 0;

                    // Specialized handling for sales fields
                    if (sortBy === 'sales' || sortBy === 'total_sales') {
                        valA = parseFloat(a.sales || a.total_sales || 0);
                        valB = parseFloat(b.sales || b.total_sales || 0);
                    }

                    if (typeof valA === 'string') valA = valA.toLowerCase();
                    if (typeof valB === 'string') valB = valB.toLowerCase();

                    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
                    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
                    return 0;
                });
            }

            // 5. Apply limit
            return data.slice(0, limit);
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
    async getDealerDetails({ dealerId } = {}) {
        try {
            const data = await this._getDealerData();
            const dealer = data.find(d => d.customer_name === dealerId || d.id === dealerId);
            if (!dealer) throw new Error(`Dealer not found: ${dealerId}`);
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
    async updateDealer({ dealerId, updates } = {}) {
        try {
            const dealer = await this.getDealerDetails({ dealerId });
            const updatedDealer = { ...dealer, ...updates };

            if (window.dealerManager && window.dealerManager.service) {
                await window.dealerManager.service.updateDealer(dealer.customer_name, updatedDealer);

                if (typeof window.dealerManager.loadData === 'function') {
                    window.dealerManager.loadData(true);
                }
            } else if (window.dataManager && window.dataManager.dataLayer) {
                console.log("[AIChatbotTools] updateDealer: Using dataLayer headlessly");
                await window.dataManager.dataLayer.updateDealer(dealer.customer_name, updates);
            } else {
                throw new Error("Unable to update dealer. DealerManager and DataManager not available.");
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
    async performBulkDealerAction({ action, dealerIds, payload = {} } = {}) {
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

    /**
     * Get aggregated sales and period-specific sales for a dealer.
     * @param {string} dealerId - The unique ID or name of the dealer.
     * @param {Array<string>} periods - Optional list of periods (e.g. ["20-21", "21-22"]) to fetch specific historical sales.
     * @returns {Promise<Object>} Object containing total sales and period breakdown.
     */
    async getDealerSales({ dealerId, periods = [] } = {}) {
        try {
            const dealer = await this.getDealerDetails({ dealerId });
            const result = {
                name: dealer.customer_name,
                aggregatedTotalSales: dealer.sales || dealer.total_sales || 0,
                periodSales: {}
            };

            if (periods.length > 0 && window.dataManager) {
                const reports = await window.dataManager.listReports();
                for (const period of periods) {
                    // Match period to report name (e.g. "21-22" matches "Sales 21-22")
                    const periodKeyword = String(period).replace(/20/g, '').trim();
                    const matchingReport = reports.find(r => r.name.toLowerCase().includes(periodKeyword.toLowerCase()));

                    if (matchingReport) {
                        const reportData = await window.dataManager.loadReportDataFromFirestore(matchingReport.id);
                        const dealerInReport = reportData.find(d =>
                            (d.customer_name || '').toLowerCase().trim() === dealer.customer_name.toLowerCase().trim()
                        );
                        if (dealerInReport) {
                            result.periodSales[period] = parseFloat(dealerInReport.sales || 0);
                        } else {
                            result.periodSales[period] = 0;
                        }
                    } else {
                        result.periodSales[period] = "Report not found for this period";
                    }
                }
            }

            return result;
        } catch (error) {
            console.error("error in getDealerSales:", error);
            throw error;
        }
    }

    // getTopDealersBySales is now integrated into searchDealers

    // ==========================================
    // 2. B2B LEADS TOOLS
    // ==========================================

    /**
     * Search and filter B2B leads with sorting and limiting.
     * @param {string} query - Text to search (name, business name, phone, etc.)
     * @param {Object} filters - Optional filters: { status, state, district }
     * @param {string} sortBy - Field to sort by (e.g. 'name', 'business_name', 'created_at')
     * @param {string} sortOrder - 'asc' or 'desc' (default 'desc')
     * @param {number} limit - Max number of results (default 50)
     * @returns {Promise<Array>} List of matching lead objects.
     */
    async searchLeads({ query = '', filters = {}, sortBy = '', sortOrder = 'desc', limit = 50 } = {}) {
        try {
            let data = [];
            let mgr = await this._getManager('b2bLeadsManager', true);
            if (mgr && mgr.leads) {
                data = mgr.leads;
            } else {
                console.log("[AIChatbotTools] searchLeads: Fetching leads headlessly");
                const { B2BLeadsService } = await import('./services/b2b_leads_service.js');
                const service = new B2BLeadsService();
                data = await service.getAllLeads();
            }

            if (data.length === 0) return [];

            // 1. Apply text search
            if (query) {
                const q = String(query).toLowerCase();
                data = data.filter(l =>
                    (l.name || l.Contact_Person || '').toLowerCase().includes(q) ||
                    (l.business_name || l.Company_Name || '').toLowerCase().includes(q) ||
                    (l.phone || l.Phone_Number || '').includes(q)
                );
            }

            // 2. Apply filters
            if (filters) {
                if (filters.status || filters.Status) {
                    const s = filters.status || filters.Status;
                    data = data.filter(l => (l.status || l.Status) === s);
                }
                if (filters.state) {
                    const st = filters.state.toLowerCase();
                    data = data.filter(l => (l.state || '').toLowerCase().includes(st));
                }
                if (filters.district) {
                    const d = filters.district.toLowerCase();
                    data = data.filter(l => (l.district || l.District || '').toLowerCase() === d);
                }
            }

            // 3. Apply sorting
            if (sortBy) {
                data.sort((a, b) => {
                    // Try both normalized and original field names
                    const fieldMap = {
                        'name': ['name', 'Contact_Person'],
                        'business_name': ['business_name', 'Company_Name'],
                        'status': ['status', 'Status'],
                        'created_at': ['created_at', 'timestamp']
                    };

                    const fields = fieldMap[sortBy] || [sortBy];
                    let valA = null, valB = null;

                    for (const f of fields) {
                        if (a[f] !== undefined) valA = a[f];
                        if (b[f] !== undefined) valB = b[f];
                    }

                    if (valA === null) valA = '';
                    if (valB === null) valB = '';

                    if (typeof valA === 'string') valA = valA.toLowerCase();
                    if (typeof valB === 'string') valB = valB.toLowerCase();

                    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
                    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
                    return 0;
                });
            }

            // 4. Apply limit
            return data.slice(0, limit);
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
    async getLeadDetails({ leadId } = {}) {
        try {
            let data = [];
            let mgr = await this._getManager('b2bLeadsManager', true);
            if (mgr && mgr.leads) {
                data = mgr.leads;
            } else {
                console.log("[AIChatbotTools] getLeadDetails: Fetching leads headlessly");
                const { B2BLeadsService } = await import('./services/b2b_leads_service.js');
                const service = new B2BLeadsService();
                data = await service.getAllLeads();
            }

            const lead = data.find(l => l.id === leadId);
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
    async createOrUpdateLead({ payload, leadId = null } = {}) {
        try {
            let mgr = await this._getManager('b2bLeadsManager', true);
            let service;
            if (mgr && mgr.service) {
                service = mgr.service;
            } else {
                console.log("[AIChatbotTools] createOrUpdateLead: Using service headlessly");
                const { B2BLeadsService } = await import('./services/b2b_leads_service.js');
                service = new B2BLeadsService();
            }

            if (leadId) {
                await service.updateLead(leadId, payload);
                if (mgr && typeof mgr.loadData === 'function') mgr.loadData(true);
                return leadId;
            } else {
                const newId = await service.addLead(payload);
                if (mgr && typeof mgr.loadData === 'function') mgr.loadData(true);
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
    async addLeadLog({ leadId, content, logType = 'Info' } = {}) {
        try {
            const mgr = await this._getManager('b2bLeadsManager');
            await mgr.createAutomatedLog(leadId, content);
            return true;
        } catch (error) {
            console.error("error in addLeadLog:", error);
            throw error;
        }
    }

    /**
     * Permanently delete a B2B lead.
     * @param {string} leadId - Firestore document ID of the lead.
     * @returns {Promise<boolean>} Success status.
     */
    async deleteLead({ leadId } = {}) {
        try {
            let mgr = await this._getManager('b2bLeadsManager', true);
            let service;
            if (mgr && mgr.service) {
                service = mgr.service;
            } else {
                console.log("[AIChatbotTools] deleteLead: Using service headlessly");
                const { B2BLeadsService } = await import('./services/b2b_leads_service.js');
                service = new B2BLeadsService();
            }

            await service.deleteLead(leadId);

            // Refresh UI if on the B2B leads page
            if (mgr && typeof mgr.loadData === 'function') mgr.loadData(true);
            return true;
        } catch (error) {
            console.error("error in deleteLead:", error);
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
    async searchMedia({ query = '', filters = {} } = {}) {
        try {
            let mgr = await this._getManager('mediaManager', true);
            let data = [];

            if (mgr && mgr.media) {
                data = mgr.media;
            } else {
                console.log("[AIChatbotTools] searchMedia: Fetching media headlessly");
                await import('./services/media_service.js');
                const service = new window.MediaService();
                data = await service.getMedia();
            }

            if (filters && filters.category && filters.category !== 'All') {
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
    async getMediaUrl({ mediaId } = {}) {
        try {
            let mgr = await this._getManager('mediaManager', true);
            let data = [];

            if (mgr && mgr.media) {
                data = mgr.media;
            } else {
                console.log("[AIChatbotTools] getMediaUrl: Fetching media headlessly");
                await import('./services/media_service.js');
                const service = new window.MediaService();
                data = await service.getMedia();
            }

            const media = data.find(m => m.id === mediaId);
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
    async searchTemplates({ query = '', filters = {} } = {}) {
        try {
            let data = [];
            if (window.templateManager && window.templateManager.templates) {
                // Use cached templates if available
                data = window.templateManager.templates;
            } else {
                // Fetch headless if manager is not loaded
                console.log("[AIChatbotTools] searchTemplates: Fetching templates from API (headless)");
                const apiBase = (window.appConfig ? window.appConfig.apiUrl : '') + '/api';
                const res = await fetch(`${apiBase}/templates`);

                if (!res.ok) {
                    throw new Error(`Failed to fetch templates. Status: ${res.status}`);
                }

                const json = await res.json();
                data = json.data || [];
            }

            if (filters && filters.status && filters.status !== 'All') {
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
    async createTemplate({ payload } = {}) {
        try {
            let result;
            if (window.templateManager && window.templateManager.service) {
                // Directly interact with the service logic instead of the UI handleSave
                result = await window.templateManager.service.saveTemplate(payload);

                // Refresh UI if on the Template page
                if (typeof window.templateManager.refreshTemplates === 'function') {
                    window.templateManager.refreshTemplates();
                }
            } else {
                // Headless template creation
                console.log("[AIChatbotTools] createTemplate: Creating template via API (headless)");
                const apiBase = (window.appConfig ? window.appConfig.apiUrl : '') + '/api';
                const payloadData = {
                    name: payload.name,
                    type: payload.type,
                    content: payload.content,
                    language: payload.language || null,
                    category: payload.category || null
                };

                const res = await fetch(`${apiBase}/templates`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payloadData)
                });

                if (!res.ok) {
                    throw new Error(`Failed to create template. Status: ${res.status}`);
                }

                result = await res.json();
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
     * Fetches the WhatsApp chat history for a given phone number across all CRM sessions.
     * Useful for giving the AI context before it replies.
     * @param {string} phone - Target phone number.
     * @returns {Promise<Array>} List of chat messages.
     */
    async getChatHistory({ phone } = {}) {
        try {
            const fb = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            const config = await import("./services/firebase_config.js");
            const db = config.db;

            // Normalize phone variations (with and without 91)
            const phoneStr = String(phone).replace(/\D/g, '');
            const phoneVariants = [
                phoneStr,
                phoneStr.length === 10 ? '91' + phoneStr : phoneStr.replace(/^91/, '')
            ];

            const chatDocs = [];
            // Query wa_chats where leadPhone matches the requested phone
            for (const p of [...new Set(phoneVariants)]) {
                const q = fb.query(fb.collection(db, 'wa_chats'), fb.where('leadPhone', '==', p));
                const snap = await fb.getDocs(q);
                snap.forEach(d => chatDocs.push(d));
            }

            if (chatDocs.length === 0) {
                return [{ note: `No chat history found for phone ${phone}.` }];
            }

            let allMessages = [];

            // Fetch recent messages for each matched chat document
            for (const chatDoc of chatDocs) {
                const crmPhone = chatDoc.data().crmPhone;
                // Fetch all messages for this session (avoiding ordering to prevent missing index errors)
                const msgsSnap = await fb.getDocs(fb.collection(db, `wa_chats/${chatDoc.id}/messages`));

                msgsSnap.forEach(msgDoc => {
                    const m = msgDoc.data();

                    // Universal extraction of text and timestamp across different WhatsApp webhook formats
                    const text = m.text || m.body || m.message?.conversation || m.message?.extendedTextMessage?.text || "[Media/Non-text message]";
                    const timestamp = m.timestamp || m.messageTimestamp || m.createdAt?.toMillis?.() || m.time || 0;
                    const fromMe = m.fromMe !== undefined ? m.fromMe : (m.direction === 'outbound' || m.type === 'sent');

                    allMessages.push({
                        crmSessionPhone: crmPhone,
                        text: text,
                        fromMe: fromMe,
                        timestamp: Number(timestamp)
                    });
                });
            }

            // Sort all collected messages chronologically
            allMessages.sort((a, b) => a.timestamp - b.timestamp);

            // Return the most recent 50 messages purely to save AI context tokens
            const recentMessages = allMessages.slice(-50);

            return recentMessages.length > 0 ? recentMessages : [{ note: "Chat exists but no recent messages found." }];
        } catch (error) {
            console.error("error in getChatHistory:", error);
            throw error;
        }
    }

    // ==========================================
    // 6. ENGAGEMENT TOOLS
    // ==========================================

    /**
     * Send a WhatsApp message to a dealer or B2B lead.
     * Functions "headlessly" — constructs the payload and calls the API directly without needing the UI modal.
     * @param {string} entityId   - dealer customer_name or lead Firestore ID
     * @param {string} entityType - 'dealer' | 'lead'
     * @param {string} [templateId] - WhatsApp template ID to use
     * @param {string} [text] - Plain text message
     * @param {string} [mediaId]  - Optional media asset ID to attach
     * @returns {Promise<boolean>} Success status.
     */
    async sendWhatsAppMessage({ entityId, entityType, templateId, text, mediaId = null } = {}) {
        try {
            if (!templateId && !text && !mediaId) {
                throw new Error("Must provide either 'templateId', 'text', or 'mediaId'.");
            }

            let phone, kamName, dealerName;
            let mgr;
            if (entityType === 'dealer') {
                mgr = await this._getManager('dealerManager', true); // optional
                const data = await this._getDealerData();
                const dealer = data.find(d => d.customer_name === entityId || d.id === entityId);
                if (!dealer) throw new Error(`Dealer not found: ${entityId}`);
                phone = dealer.mobile_phone?.replace(/\D/g, '');
                kamName = dealer.key_account_manager;
                dealerName = dealer.customer_name;
            } else if (entityType === 'lead') {
                mgr = await this._getManager('b2bLeadsManager', true); // optional
                const lead = (mgr ? mgr.leads : []).find(l => l.id === entityId);
                if (!lead) throw new Error(`Lead not found: ${entityId}. Please navigate to B2B Leads page.`);
                phone = lead.phone?.replace(/\D/g, '');
                kamName = lead.keyAccountManager || lead.key_account_manager || lead.kam;
                dealerName = lead.company_name || lead.name;
            } else {
                throw new Error(`Unknown entityType: ${entityType}. Must be 'dealer' or 'lead'.`);
            }

            if (!phone) throw new Error(`${entityType} has no valid phone number.`);
            if (!kamName) {
                console.warn(`[AI WhatsApp] ${entityType} is not assigned to a KAM. Falling back to default session.`);
            }

            // Get WhatsApp instances, gracefully fallback to API request if manager not loaded
            let waInstances = mgr ? (mgr.whatsappInstances || []) : [];
            if (waInstances.length === 0) {
                try {
                    const res = await fetch(`${window.appConfig.apiUrl}/api/auth/sessions`);
                    const data = await res.json();
                    if (data.success && Array.isArray(data.sessions)) waInstances = data.sessions;

                    const fb = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                    const config = await import("./services/firebase_config.js");
                    const snap = await fb.getDocs(fb.collection(config.db, "whatsapp_instances"));
                    const metaDocs = [];
                    snap.forEach(doc => metaDocs.push({ ...doc.data(), id: doc.id }));

                    waInstances = waInstances.map(session => {
                        const meta = metaDocs.find(m => m.sessionId === (session.id || session.sessionId));
                        return { ...session, kam: meta ? meta.kam : null };
                    });
                } catch (e) {
                    console.warn('[AI WhatsApp] Fallback instance fetch failed', e);
                }
            }

            let instance;

            if (kamName) {
                const cleanName = (name) => (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                const targetKam = cleanName(kamName);

                instance = waInstances.find(i => cleanName(i.kam) === targetKam);

                // Fallback: Partial match (e.g. "fazal v s" vs "fazal")
                if (!instance) {
                    instance = waInstances.find(i =>
                        cleanName(i.kam).includes(targetKam) ||
                        targetKam.includes(cleanName(i.kam))
                    );
                }
            }

            // If no KAM was assigned, or we couldn't find a matching session, pick the first connected session
            if (!instance && waInstances.length > 0) {
                console.warn(`[AI WhatsApp] Using default connected WhatsApp session because KAM session could not be determined.`);
                instance = waInstances[0]; // Or pick one that says "connected" if there's a status field, but getting ANY session is better than failing
            }

            if (!instance) {
                throw new Error(`No connected WhatsApp session found for KAM: ${kamName}`);
            }

            let payload = {
                sessionId: instance.id,
                to: phone.length === 10 ? '91' + phone : phone
            };
            let endpoint = '/messages/text';

            if (templateId) {
                endpoint = '/messages/template';
                // Try to populate KAM Phone for template variables if possible
                let kamPhone = '';
                try {
                    const fb = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                    const config = await import("./services/firebase_config.js");
                    const settingsDoc = await fb.getDoc(fb.doc(config.db, "settings", "general"));
                    if (settingsDoc.exists()) {
                        const kamList = settingsDoc.data().key_accounts || [];
                        const kamObj = kamList.find(k => (k.name || k) === kamName);
                        if (kamObj) kamPhone = kamObj.phone || '';
                    }
                } catch (e) {
                    console.warn('[AI WhatsApp] Could not fetch KAM phone for template variables.', e);
                }
                payload.templateId = templateId;
                payload.variables = { 'KAM_PHONE': kamPhone, 'name': dealerName || entityId };
            } else if (mediaId) {
                // If the AI somehow finds a mediaId to send, we'd need its mimetype/url.
                // For simplicity, we drop it back to the UI if media is explicitly requested.
                throw new Error("Sending media headlessly is currently unsupported. Please use text or templateId.");
            } else {
                payload.text = text;
            }

            // 1. Send the WhatsApp message via the unified backend API
            const response = await fetch(`${window.appConfig.apiUrl}/api${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || result.message || 'Failed to send WhatsApp message via API.');
            }

            // 2. Log activity if it's a dealer (lead logging is done differently, optional)
            if (entityType === 'dealer' && window.dataManager) {
                try {
                    const mergedDealer = window.dataManager.dealerOverrides[dealerName] || {};
                    const currentLogs = mergedDealer.logs || [];
                    currentLogs.push({
                        id: 'log_' + Date.now(),
                        activityType: 'WhatsApp',
                        content: templateId ? `Sent WhatsApp Template: ${templateId} via AI` : `Sent WhatsApp plain text via AI`,
                        textSent: text,
                        createdAt: new Date().toISOString()
                    });
                    await window.dataManager.saveDealerOverride(dealerName, { logs: currentLogs });

                    // Force UI refresh if the dealer page is active
                    if (mgr && typeof mgr.renderLogsList === 'function' && document.getElementById('dealer-modal')?.classList.contains('active')) {
                        mgr.renderLogsList(dealerName);
                    }
                } catch (logErr) {
                    console.warn('[AI WhatsApp] Message sent, but failed to log to timeline.', logErr);
                }
            }

            return true;
        } catch (error) {
            console.error("error in sendWhatsAppMessage:", error);
            throw error;
        }
    }

}

// Attach to window so it's globally available
window.aiChatbotTools = new AIChatbotTools();
