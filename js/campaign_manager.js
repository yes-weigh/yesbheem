
import { AudienceService } from './services/audience_service.js';
import { db } from './services/firebase_config.js';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
    }

    switchTab(tabName) {
        this.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
        this.views.forEach(v => v.classList.toggle('active', v.id === `view-${tabName}`));
        this.activeTab = tabName;
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

        if (template && window.TemplateRenderer) {
            this.templatePreview.style.display = 'block';
            this.templatePreview.innerHTML = ''; // Request renderer
            // We need a lightweight renderer or use the existing one but disconnected from editor logic
            // Simple Render:
            const renderer = new window.TemplateRenderer({ readOnly: true });

            // Mock container
            const mockContainer = document.createElement('div');
            // We need to inject the HTML structure the renderer expects or just manually render
            // TemplateRenderer is tightly coupled to DOM IDs. 
            // Fallback: Simple HTML string construction for preview
            this.templatePreview.innerHTML = `
                <div style="color:white;">
                    <p>${template.components.find(c => c.type === 'BODY').text}</p>
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
        this.statusBody.innerHTML = this.campaigns.map(c => `
            <tr>
                <td style="font-weight:600;">${c.name}</td>
                <td>${c.audienceName || 'Unknown'}</td>
                <td><span class="status-badge status-${c.status}">${c.status.toUpperCase()}</span></td>
                <td>
                    <div style="background:#333; height:6px; border-radius:3px; branding:hidden; width:100px;">
                       <div style="background:var(--accent-color); width:${(c.stats?.sent / (c.stats?.total || 1)) * 100 || 0}%; height:100%; border-radius:3px;"></div>
                    </div>
                </td>
                <td>${c.stats?.sent || 0} / ${c.stats?.total || '?'}</td>
                <td>${c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString() : 'Just now'}</td>
                <td>
                    <button class="btn-secondary" style="font-size:0.7rem;">View</button>
                    ${c.status === 'active' ? '<button class="btn-secondary" style="font-size:0.7rem; color:orange;">Pause</button>' : ''}
                </td>
            </tr>
        `).join('');
    }
}

// Auto-start
const campaignManager = new CampaignManager();
window.campaignManager = campaignManager;
