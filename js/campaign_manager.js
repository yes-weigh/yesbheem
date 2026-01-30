
import { AudienceService } from './services/audience_service.js';
import { db } from './services/firebase_config.js';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, getDocs, doc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

class CampaignManager {
    constructor() {
        this.audienceService = new AudienceService();
        this.activeTab = 'dashboard';

        // Data State
        this.audiences = [];
        this.instances = [];
        this.templates = [];
        this.campaigns = []; // Dashboard data

        this.init();
    }

    async init() {
        console.log('CampaignManager: Initializing...');
        this.cacheDOM();
        this.bindEvents();

        // Load initial data
        await this.loadAudiences();
        await this.loadInstances();
        await this.loadTemplates();
        await this.loadKAMs();

        // Load Dashboard
        this.loadCampaigns();
    }

    cacheDOM() {
        // Tabs
        this.tabs = document.querySelectorAll('.tab-btn');
        this.views = document.querySelectorAll('.view-section');

        // Inputs
        this.nameInput = document.getElementById('new-campaign-name');
        this.audienceSelect = document.getElementById('campaign-audience-select');
        this.audienceInfo = document.getElementById('selected-audience-info');

        this.senderRadios = document.querySelectorAll('input[name="senderType"]');
        this.senderSelect = document.getElementById('campaign-sender-select');

        this.templateSelect = document.getElementById('campaign-template-select');
        this.templatePreview = document.getElementById('campaign-template-preview');

        // New Inputs
        this.scheduleInput = document.getElementById('campaign-schedule-time');
        this.speedSelect = document.getElementById('campaign-speed-select');
        this.kamSelect = document.getElementById('campaign-kam-select');

        this.startBtn = document.getElementById('btn-start-campaign');
        this.statusBody = document.getElementById('campaign-list-body');
    }

    bindEvents() {
        // Tab Switching
        this.tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Audience Logic
        this.audienceSelect.addEventListener('change', () => this.handleAudienceChange());

        // Sender Type Toggle
        this.senderRadios.forEach(radio => {
            radio.addEventListener('change', () => this.populateSenderSelect());
        });

        // Template Preview
        this.templateSelect.addEventListener('change', () => this.handleTemplateChange());

        // Start Campaign
        this.startBtn.addEventListener('click', () => this.startCampaign());

        // Refresh
        document.getElementById('btn-refresh-campaigns').addEventListener('click', () => this.loadCampaigns());

        // Create Audience Button
        const createAudienceBtn = document.getElementById('btn-create-audience');
        if (createAudienceBtn) {
            createAudienceBtn.addEventListener('click', () => this.openCreateAudienceModal());
        }
    }

    switchTab(tabName) {
        this.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
        this.views.forEach(v => v.classList.toggle('active', v.id === `view-${tabName}`));
        this.activeTab = tabName;

        // Render audiences when tab is activated
        if (tabName === 'audiences') {
            this.renderAudiencesTab();
        }
    }

    async loadAudiences() {
        try {
            this.audiences = await this.audienceService.getAudiences();

            this.audienceSelect.innerHTML = '<option value="">Select Audience...</option>';
            this.audiences.forEach(aud => {
                const opt = document.createElement('option');
                opt.value = aud.id;
                opt.textContent = `${aud.name} (${aud.count} contacts)`;
                this.audienceSelect.appendChild(opt);
            });
        } catch (e) {
            console.error('Error loading audiences:', e);
        }
    }

    handleAudienceChange() {
        const id = this.audienceSelect.value;
        const audience = this.audiences.find(a => a.id === id);

        if (audience) {
            this.audienceInfo.style.display = 'block';
            const type = audience.source === 'static_list' ? 'Static List' : 'Dynamic Filter';
            this.audienceInfo.innerHTML = `<strong>Type:</strong> ${type} | <strong>Count:</strong> ${audience.count}`;
        } else {
            this.audienceInfo.style.display = 'none';
        }
    }

    async loadInstances() {
        try {
            // 1. Fetch live sessions from Backend (Graceful fail for Mixed Content/Down)
            let liveSessions = [];
            try {
                const response = await fetch(`${window.appConfig.apiUrl}/api/auth/sessions`);
                const data = await response.json();
                if (data.success && Array.isArray(data.sessions)) {
                    liveSessions = data.sessions;
                }
            } catch (e) {
                console.warn('Backend fetch failed (likely Mixed Content or Offline):', e);
            }

            // 2. Fetch metadata from Firestore (Source of Truth for existence)
            const firestoreSnap = await getDocs(collection(db, "whatsapp_instances"));
            const metaDocs = [];
            firestoreSnap.forEach(doc => metaDocs.push({ ...doc.data(), id: doc.id }));

            // 3. Merge Strategies
            if (liveSessions.length > 0) {
                // If backend is live, map backend sessions to metadata
                this.instances = liveSessions.map(session => {
                    const meta = metaDocs.find(m => m.sessionId === (session.id || session.sessionId));
                    return {
                        ...session,
                        id: session.id || session.sessionId,
                        name: meta ? meta.name : (session.name || 'Unnamed'),
                        kam: meta ? meta.kam : null,
                        groups: meta ? meta.groups : []
                    };
                });
            } else {
                // Fallback: Use Firestore Metadata directly
                // (User can select instance, even if we don't know if it's connected right now. Backend will handle it)
                this.instances = metaDocs.map(meta => ({
                    id: meta.sessionId, // Critical: Backend needs sessionId
                    name: meta.name || 'Unnamed Instance',
                    kam: meta.kam,
                    groups: meta.groups || [],
                    connected: false // Unknown status
                }));
            }

            this.populateSenderSelect();

        } catch (e) {
            console.error('Error loading instances:', e);
        }
    }

    populateSenderSelect() {
        const type = document.querySelector('input[name="senderType"]:checked').value;
        this.senderSelect.innerHTML = '<option value="">Select...</option>';

        if (type === 'single') {
            this.instances.forEach(inst => {
                const opt = document.createElement('option');
                // Use id or sessionId consistent with what backend provides
                const id = inst.id || inst.sessionId;
                opt.value = id;
                // Display Name + Phone (or ID) for clarity
                opt.textContent = `${inst.name} (${id})`;
                this.senderSelect.appendChild(opt);
            });
        } else {
            // Groups - TODO: We need a way to get distinct groups. 
            // InstanceManager gets them from settings. We could do the same.
            // For MVP, letting user type group name or fetching unique groups from instances?
            // Let's grab groups from instances array if available
            const groups = new Set();
            // This assumes instances have 'groups' property populated, which might not be true if we only hit /sessions
            // Implementation Gaps: InstanceManager loads detailed metadata. 
            // Solution: We'll list "All Connected" as a group or similar for now.
            const opt = document.createElement('option');
            opt.value = 'all';
            opt.textContent = 'All Connected Instances (Round Robin)';
            this.senderSelect.appendChild(opt);
        }
    }

    async loadTemplates() {
        // Use TemplateService logic to fetch templates via API
        try {
            // Check if TemplateService is available globally or instantiate it
            const service = window.TemplateService ? new window.TemplateService() : null;

            if (!service) {
                console.error('TemplateService not found');
                return;
            }

            this.templates = await service.getTemplates();

            this.templateSelect.innerHTML = '<option value="">Select Template...</option>';
            this.templates.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = t.name;
                this.templateSelect.appendChild(opt);
            });

        } catch (e) {
            console.error('Templates fetch error', e);
        }
    }

    async loadKAMs() {
        try {
            const docRef = doc(db, "settings", "general");
            const snapshot = await getDoc(docRef);
            if (snapshot.exists()) {
                const data = snapshot.data();
                const keyAccounts = data.key_accounts || []; // Array of {name, phone} or strings

                this.kamSelect.innerHTML = '<option value="">Select Manager...</option>';
                keyAccounts.forEach(kam => {
                    const name = typeof kam === 'string' ? kam : kam.name;
                    const phone = typeof kam === 'string' ? '' : kam.phone;

                    const opt = document.createElement('option');
                    opt.value = name;
                    opt.textContent = name + (phone ? ` (${phone})` : '');
                    this.kamSelect.appendChild(opt);
                });
            }
        } catch (e) {
            console.error('Error loading KAMs', e);
        }
    }

    handleTemplateChange() {
        const id = this.templateSelect.value;
        const template = this.templates.find(t => t.id === id);

        if (template) {
            this.templatePreview.style.display = 'block';
            this.templatePreview.innerHTML = '';

            // Extract Preview Text based on detected structure
            let previewText = 'Preview unavailable';

            if (Array.isArray(template.components)) {
                // Standard WhatsApp Structure
                const body = template.components.find(c => c.type === 'BODY');
                previewText = body ? body.text : (template.components.find(c => c.type === 'HEADER')?.text || 'Media Template');
            } else if (template.content) {
                // Simplified Structure
                if (typeof template.content === 'string') {
                    previewText = template.content;
                } else if (typeof template.content === 'object') {
                    previewText = template.content.body || template.content.text || template.content.caption || JSON.stringify(template.content);
                }
            }

            // Simple HTML string construction for preview
            this.templatePreview.innerHTML = `
                <div style="color:white; white-space: pre-wrap;">
                    <p>${previewText}</p>
                </div>
            `;
        } else {
            this.templatePreview.style.display = 'none';
        }
    }

    async startCampaign() {
        const name = this.nameInput.value.trim();
        const audienceId = this.audienceSelect.value;
        const senderId = this.senderSelect.value;
        const templateId = this.templateSelect.value;

        if (!name || !audienceId || !senderId || !templateId) {
            alert('Please complete all fields.');
            return;
        }

        this.startBtn.disabled = true;
        this.startBtn.textContent = '🚀 Launching...';

        try {
            // Create Campaign Doc
            const payload = {
                name,
                audienceId,
                audienceName: this.audiences.find(a => a.id === audienceId)?.name,
                status: this.scheduleInput.value ? 'scheduled' : 'active',
                scheduledAt: this.scheduleInput.value ? new Date(this.scheduleInput.value).getTime() : Date.now(),
                speed: parseInt(this.speedSelect.value) || 60,
                campaignManager: this.kamSelect.value || null,
                senderConfig: {
                    type: document.querySelector('input[name="senderType"]:checked').value,
                    id: senderId
                },
                templateConfig: {
                    id: templateId,
                    name: this.templates.find(t => t.id === templateId)?.name
                },
                createdAt: serverTimestamp(),
                stats: { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 }
            };

            await addDoc(collection(db, "campaigns"), payload);

            alert('Campaign Created! (Backend execution pending implementation)');
            this.switchTab('dashboard');
            this.loadCampaigns(); // refresh

        } catch (e) {
            console.error("Campaign Start Error:", e);
            alert("Failed to start campaign");
        } finally {
            this.startBtn.disabled = false;
            this.startBtn.textContent = '🚀 Start Campaign';
        }
    }

    loadCampaigns() {
        const q = query(collection(db, "campaigns"), orderBy("createdAt", "desc"));
        this.statusBody.innerHTML = '<tr><td colspan="7">Loading...</td></tr>';

        // Real-time listener
        onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                this.statusBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#666;">No campaigns found. Create one!</td></tr>';
                return;
            }

            this.campaigns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.renderDashboard();
        });
    }

    renderDashboard() {
        if (!this.campaigns || this.campaigns.length === 0) {
            this.statusBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem;">No campaigns found.</td></tr>';
            return;
        }

        this.statusBody.innerHTML = this.campaigns.map(c => {
            const isEditable = ['scheduled', 'pending', 'active'].includes(c.status);
            const statusColors = {
                'active': '#10b981',
                'completed': '#3b82f6',
                'scheduled': '#f59e0b',
                'failed': '#ef4444',
                'processing': '#8b5cf6',
                'paused': '#f97316'
            };
            const statusColor = statusColors[c.status] || '#6b7280';

            return `
            <tr>
                <td style="font-weight:600;">${c.name}</td>
                <td>${c.audienceName || 'Unknown'}</td>
                <td><span class="status-badge" style="background:${statusColor}20; color:${statusColor}; padding:2px 8px; border-radius:12px; font-size:0.75rem;">${c.status.toUpperCase()}</span></td>
                <td>
                    <div style="background:#333; height:6px; border-radius:3px; overflow:hidden; width:100px;">
                       <div style="background:${statusColor}; width:${(c.stats?.sent / (c.stats?.total || 1)) * 100 || 0}%; height:100%; border-radius:3px;"></div>
                    </div>
                </td>
                <td>${c.stats?.sent || 0} / ${c.stats?.total || '?'}</td>
                <td>${c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString() : 'Just now'}</td>
                <td>
                    <div style="display:flex; gap:0.5rem;">
                        <button onclick="window.campaignManager.viewCampaign('${c.id}')" class="btn-secondary" style="font-size:0.7rem; padding: 4px 8px;">View</button>
                        ${isEditable ? `<button onclick="window.campaignManager.editCampaign('${c.id}')" class="btn-secondary" style="font-size:0.7rem; padding: 4px 8px; color:#f59e0b;">Edit</button>` : ''}
                        <button onclick="window.campaignManager.deleteCampaign('${c.id}')" class="btn-secondary" style="font-size:0.7rem; padding: 4px 8px; color:#ef4444;">Delete</button>
                    </div>
                </td>
            </tr>
        `}).join('');

        // Update dashboard stats
        this.updateDashboardStats();
    }

    async deleteCampaign(id) {
        if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) return;

        try {
            await deleteDoc(doc(db, 'campaigns', id));

            // Remove from local state
            this.campaigns = this.campaigns.filter(c => c.id !== id);

            // Re-render
            this.renderDashboard();

            // Optional: Show a toast instead of alert for even smoother experience, 
            // but for now keeping alert as it matches existing UX, just removing the reload.
            // alert('Campaign deleted successfully.'); 
            // Actually, let's effectively "Toast" it or just non-blocking console log + UI update is enough feedback usually if the row disappears.
            // But to be explicit:
            console.log('Campaign deleted:', id);

        } catch (error) {
            console.error('Error deleting campaign:', error);
            alert('Failed to delete campaign: ' + error.message);
        }
    }

    async editCampaign(id) {
        const campaign = this.campaigns.find(c => c.id === id);
        if (!campaign) return;

        // Pre-fill Form
        document.getElementById('campaign-name').value = campaign.name;

        // Select Audience (if exists in dropdown)
        const audSelect = document.getElementById('audience-select');
        if (audSelect) audSelect.value = campaign.audienceId;

        // Select Template (if exists)
        const tmplSelect = document.getElementById('template-select');
        if (tmplSelect) {
            tmplSelect.value = campaign.templateId || (campaign.templateConfig ? campaign.templateConfig.id : '');
            // Trigger change to load preview
            tmplSelect.dispatchEvent(new Event('change'));
        }

        // Set Schedule
        if (campaign.scheduledAt) {
            const date = new Date(campaign.scheduledAt);
            // Format to datetime-local: YYYY-MM-DDTHH:mm
            const iso = date.toISOString().slice(0, 16); // Simple truncation for local time adjustment might be needed
            // Actually ISO is UTC. datetime-local expects local.
            // Quick hack for local iso string
            const localIso = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
            document.getElementById('schedule-time').value = localIso;
        }

        // Set Speed
        if (campaign.speed) document.getElementById('speed-control').value = campaign.speed;

        // Set KAM
        if (campaign.campaignManager) document.getElementById('campaign-manager-select').value = campaign.campaignManager;

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Optional: Change "Start Campaign" button/mode to "Update"?
        // For now, let's keep it simple: User edits and creates a NEW campaign (effectively cloning).
        // To support "Update", we'd need to store the ID in a hidden field and update `startCampaign`.
        // Given complexity, "Duplicate & Edit" is safer logic for now, but UI says "Edit".
        // Let's alert them.
        alert('Campaign details loaded into the form. You can modify and create a new campaign, or update logic usage.');
    }


    updateDashboardStats() {
        const campaigns = this.campaigns || [];

        // Total campaigns
        const total = campaigns.length;

        // Count by status
        const completed = campaigns.filter(c => c.status === 'COMPLETED' || c.status === 'completed').length;
        const inProgress = campaigns.filter(c => c.status === 'IN_PROGRESS' || c.status === 'active' || c.status === 'processing').length;
        const scheduled = campaigns.filter(c => c.status === 'SCHEDULED' || c.status === 'scheduled' || c.status === 'pending').length;

        // Update DOM
        const totalEl = document.getElementById('stat-total-campaigns');
        const completedEl = document.getElementById('stat-completed');
        const inProgressEl = document.getElementById('stat-in-progress');
        const scheduledEl = document.getElementById('stat-scheduled');

        if (totalEl) totalEl.textContent = total;
        if (completedEl) completedEl.textContent = completed;
        if (inProgressEl) inProgressEl.textContent = inProgress;
        if (scheduledEl) scheduledEl.textContent = scheduled;
    }

    viewCampaign(id) {
        const campaign = this.campaigns.find(c => c.id === id);
        if (!campaign) return;

        // For now, just logging or a simple alert summary
        // Ideally, expand the row or show a modal
        console.log('Viewing Campaign:', campaign);
        alert(`Campaign: ${campaign.name}\nStatus: ${campaign.status}\nSent: ${campaign.stats?.sent || 0}/${campaign.stats?.total || '?'}`);
    }

    // ==================== AUDIENCE MANAGEMENT ====================

    async renderAudiencesTab() {
        const grid = document.getElementById('audience-grid');
        const emptyState = document.getElementById('audience-empty-state');

        if (!this.audiences || this.audiences.length === 0) {
            grid.style.display = 'none';
            emptyState.style.display = 'flex';
            return;
        }

        grid.style.display = 'grid';
        emptyState.style.display = 'none';
        grid.innerHTML = '';

        this.audiences.forEach(audience => {
            grid.appendChild(this.renderAudienceCard(audience));
        });
    }

    renderAudienceCard(audience) {
        const card = document.createElement('div');
        card.className = 'audience-card';
        card.dataset.audienceId = audience.id;

        const createdDate = audience.createdAt?.toDate ?
            audience.createdAt.toDate().toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) :
            'Unknown';

        card.innerHTML = `
            <div class="audience-card-header">
                <div class="audience-card-title">
                    <div class="audience-card-name">${audience.name}</div>
                    <span class="source-badge">${audience.source === 'static_list' ? 'Static' : 'Dynamic'}</span>
                </div>
                <div class="audience-card-actions">
                    <button class="icon-btn" onclick="window.campaignManager.editAudience('${audience.id}')" title="Edit">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4l-7 7-3 1 1-3 7-7m0 0l2-2 3 3-2 2m-3-3l3 3"/></svg>
                    </button>
                    <button class="icon-btn" onclick="window.campaignManager.deleteAudience('${audience.id}')" title="Delete">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6m4-6v6"/></svg>
                    </button>
                    <button class="icon-btn" onclick="window.campaignManager.toggleAudienceExpand('${audience.id}')" title="View Contacts">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                </div>
            </div>
            <div class="audience-card-stats">
                <div class="stat-item">
                    <div class="stat-value">${audience.count || 0}</div>
                    <div class="stat-label">Contacts</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${createdDate}</div>
                    <div class="stat-label">Created</div>
                </div>
            </div>
            <div class="audience-contacts" style="display: none;">
                <div class="contacts-header">
                    <input type="text" class="contact-search" placeholder="Search contacts..." onkeyup="window.campaignManager.filterContacts('${audience.id}', this.value)">
                </div>
                <div class="contact-list" id="contact-list-${audience.id}">
                    ${this.renderContactList(audience)}
                </div>
            </div>
        `;

        return card;
    }

    renderContactList(audience) {
        if (!audience.contacts || audience.contacts.length === 0) {
            return '<div class="empty-contacts">No contacts in this audience</div>';
        }

        return audience.contacts.map((contact, index) => `
            <div class="contact-row" data-contact-index="${index}">
                <div class="contact-avatar">${this.getInitials(contact.name)}</div>
                <div class="contact-info">
                    <div class="contact-name">${contact.name}</div>
                    <div class="contact-phone">${contact.phone}</div>
                </div>
                <div class="contact-actions">
                    <button class="icon-btn" onclick="window.campaignManager.deleteContact('${audience.id}', ${index})" title="Remove">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    toggleAudienceExpand(audienceId) {
        const card = document.querySelector(`[data-audience-id="${audienceId}"]`);
        if (!card) return;

        const contactsDiv = card.querySelector('.audience-contacts');
        const isExpanded = card.classList.contains('expanded');

        // Collapse all other cards
        document.querySelectorAll('.audience-card.expanded').forEach(c => {
            if (c !== card) {
                c.classList.remove('expanded');
                c.querySelector('.audience-contacts').style.display = 'none';
            }
        });

        // Toggle current card
        if (isExpanded) {
            card.classList.remove('expanded');
            contactsDiv.style.display = 'none';
        } else {
            card.classList.add('expanded');
            contactsDiv.style.display = 'block';
        }
    }

    filterContacts(audienceId, searchTerm) {
        const contactList = document.getElementById(`contact-list-${audienceId}`);
        const rows = contactList.querySelectorAll('.contact-row');

        rows.forEach(row => {
            const name = row.querySelector('.contact-name').textContent.toLowerCase();
            const phone = row.querySelector('.contact-phone').textContent.toLowerCase();
            const matches = name.includes(searchTerm.toLowerCase()) || phone.includes(searchTerm.toLowerCase());
            row.style.display = matches ? 'flex' : 'none';
        });
    }

    openCreateAudienceModal() {
        this.editingAudienceId = null;
        document.getElementById('modal-title').textContent = 'Create New Audience';
        document.getElementById('modal-audience-name').value = '';
        document.getElementById('btn-save-audience').textContent = 'Create Audience';

        const contactList = document.getElementById('modal-contact-list');
        contactList.innerHTML = '';

        // Add 3 empty rows by default
        for (let i = 0; i < 3; i++) {
            this.addContactRow();
        }

        document.getElementById('audience-modal').style.display = 'flex';
    }

    closeAudienceModal() {
        document.getElementById('audience-modal').style.display = 'none';
        this.editingAudienceId = null;
    }

    addContactRow(name = '', phone = '') {
        const contactList = document.getElementById('modal-contact-list');
        const row = document.createElement('div');
        row.className = 'contact-input-row';
        row.innerHTML = `
            <input type="text" class="modern-input contact-name-input" placeholder="Name" value="${name}">
            <input type="tel" class="modern-input contact-phone-input" placeholder="+91 98765 43210" value="${phone}">
            <button class="icon-btn" onclick="this.parentElement.remove(); window.campaignManager.updateContactCount()">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
        `;
        contactList.appendChild(row);
        this.updateContactCount();
    }

    updateContactCount() {
        const rows = document.querySelectorAll('.contact-input-row');
        const validRows = Array.from(rows).filter(row => {
            const name = row.querySelector('.contact-name-input').value.trim();
            const phone = row.querySelector('.contact-phone-input').value.trim();
            return name && phone;
        });
        document.getElementById('modal-contact-count').textContent = `${validRows.length} contacts added`;
    }

    validatePhone(phone) {
        // Remove all non-digit characters
        const cleaned = phone.replace(/\D/g, '');

        // Check if it's a valid Indian number (10 digits) or international (with country code)
        if (cleaned.length === 10) {
            return '+91' + cleaned;
        } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
            return '+' + cleaned;
        } else if (cleaned.length > 10) {
            return '+' + cleaned;
        }

        return null;
    }

    async saveAudience() {
        const name = document.getElementById('modal-audience-name').value.trim();
        if (!name) {
            alert('Please enter an audience name');
            return;
        }

        const rows = document.querySelectorAll('.contact-input-row');
        const contacts = [];

        for (const row of rows) {
            const nameInput = row.querySelector('.contact-name-input').value.trim();
            const phoneInput = row.querySelector('.contact-phone-input').value.trim();

            if (nameInput && phoneInput) {
                const validatedPhone = this.validatePhone(phoneInput);
                if (!validatedPhone) {
                    alert(`Invalid phone number: ${phoneInput}`);
                    return;
                }
                contacts.push({ name: nameInput, phone: validatedPhone });
            }
        }

        if (contacts.length === 0) {
            alert('Please add at least one contact');
            return;
        }

        try {
            const audienceData = {
                name,
                contacts,
                count: contacts.length,
                source: 'static_list'
            };

            if (this.editingAudienceId) {
                // Update existing audience
                await this.audienceService.updateAudience(this.editingAudienceId, audienceData);
                import('./utils/toast.js').then(module => {
                    module.Toast.success('Audience updated successfully');
                });
            } else {
                // Create new audience
                await this.audienceService.createAudience(audienceData);
                import('./utils/toast.js').then(module => {
                    module.Toast.success('Audience created successfully');
                });
            }

            this.closeAudienceModal();
            await this.loadAudiences();
            this.renderAudiencesTab();
        } catch (error) {
            console.error('Error saving audience:', error);
            alert('Failed to save audience: ' + error.message);
        }
    }

    async editAudience(audienceId) {
        const audience = this.audiences.find(a => a.id === audienceId);
        if (!audience) return;

        this.editingAudienceId = audienceId;
        document.getElementById('modal-title').textContent = 'Edit Audience';
        document.getElementById('modal-audience-name').value = audience.name;
        document.getElementById('btn-save-audience').textContent = 'Update Audience';

        const contactList = document.getElementById('modal-contact-list');
        contactList.innerHTML = '';

        if (audience.contacts && audience.contacts.length > 0) {
            audience.contacts.forEach(contact => {
                this.addContactRow(contact.name, contact.phone);
            });
        } else {
            this.addContactRow();
        }

        document.getElementById('audience-modal').style.display = 'flex';
    }

    async deleteAudience(audienceId) {
        const audience = this.audiences.find(a => a.id === audienceId);
        if (!audience) return;

        if (!confirm(`Are you sure you want to delete "${audience.name}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await this.audienceService.deleteAudience(audienceId);
            import('./utils/toast.js').then(module => {
                module.Toast.success('Audience deleted successfully');
            });
            await this.loadAudiences();
            this.renderAudiencesTab();
        } catch (error) {
            console.error('Error deleting audience:', error);
            alert('Failed to delete audience: ' + error.message);
        }
    }

    async deleteContact(audienceId, contactIndex) {
        const audience = this.audiences.find(a => a.id === audienceId);
        if (!audience) return;

        const contact = audience.contacts[contactIndex];
        if (!confirm(`Remove ${contact.name} from this audience?`)) {
            return;
        }

        try {
            const updatedContacts = audience.contacts.filter((_, i) => i !== contactIndex);
            await this.audienceService.updateAudience(audienceId, {
                contacts: updatedContacts,
                count: updatedContacts.length
            });

            import('./utils/toast.js').then(module => {
                module.Toast.success('Contact removed successfully');
            });

            await this.loadAudiences();
            this.renderAudiencesTab();
        } catch (error) {
            console.error('Error deleting contact:', error);
            alert('Failed to delete contact: ' + error.message);
        }
    }
}

// Auto-start
const campaignManager = new CampaignManager();
window.campaignManager = campaignManager;
