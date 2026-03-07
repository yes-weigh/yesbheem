import { db } from './services/firebase_config.js';
import { collection, getDocs, setDoc, doc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { Toast } from './utils/toast.js';

if (!window.FlowBuilderManager) {
    window.FlowBuilderManager = class FlowBuilderManager {
        constructor() {
            this.editor = null;
            this.flows = [];
            this.currentFlowId = null;
            this.selectedNodeId = null;
            this.mobile_item_selec = '';
            this.mobile_last_move = null;
        }

        async init() {
            console.log('FlowBuilderManager initializing...');
            this.initDrawflow();
            this.setupEventListeners();
            await this.loadFlows();
        }

        // ─── Node HTML Templates ───────────────────────────────────────────────

        _buildNodeHTML(type, config = {}) {
            const configs = {
                trigger: {
                    icon: '⚡',
                    label: 'Trigger',
                    color: '--color-trigger',
                    body: `<p class="fb-node-desc">${config.type === 'keyword' ? `Keyword: "${config.value || 'hi'}"` : config.type === 'field_change' ? `Field: ${config.field || 'stage'}` : 'Inbound Message'}</p>`
                },
                condition: {
                    icon: '🛤️',
                    label: 'Condition',
                    color: '--color-condition',
                    body: `<p class="fb-node-desc">${config.value || 'Set condition...'}</p>
                           <div class="fb-node-branches"><span class="fb-branch true">✓ True</span><span class="fb-branch false">✗ False</span></div>`
                },
                action: {
                    icon: '⚙️',
                    label: 'Action',
                    color: '--color-action',
                    body: `<p class="fb-node-desc">${this._getActionDesc(config)}</p>`
                },
                ai: {
                    icon: '🤖',
                    label: 'AI Agent',
                    color: '--color-ai',
                    body: `<p class="fb-node-desc">${config.prompt ? config.prompt.substring(0, 40) + '...' : 'Configure AI prompt...'}</p>`
                },
                wait: {
                    icon: '⏳',
                    label: 'Wait',
                    color: '--color-wait',
                    body: `<p class="fb-node-desc">${config.duration ? `${config.duration} ${config.unit || 'seconds'}` : 'Set delay...'}</p>`
                }
            };

            const c = configs[type] || configs.action;
            return `<div class="fb-node fb-node-${type}">
                <div class="fb-node-header">
                    <span class="fb-node-icon">${c.icon}</span>
                    <span class="fb-node-label">${c.label}</span>
                    <button class="fb-node-edit-btn" onclick="event.stopPropagation(); window.flowBuilderManager.openPropertyPanel()" title="Configure">⚙</button>
                </div>
                <div class="fb-node-body">${c.body}</div>
            </div>`;
        }

        _getActionDesc(config) {
            switch (config.type) {
                case 'send_message': return `💬 ${config.value ? config.value.substring(0, 35) + '...' : 'Send message'}`;
                case 'update_crm': return `📝 Update: ${config.field || 'field'} → ${config.value || '...'}`;
                case 'assign_kam': return `👤 Assign KAM: ${config.value || '...'}`;
                case 'trigger_campaign': return `📢 Campaign: ${config.value || '...'}`;
                case 'webhook': return `🔗 Webhook: ${config.value || '...'}`;
                default: return 'Configure action...';
            }
        }

        // ─── Drawflow Init ─────────────────────────────────────────────────────

        initDrawflow() {
            const container = document.getElementById("drawflow");
            if (!container) return;

            this.editor = new Drawflow(container);
            this.editor.reroute = true;
            this.editor.reroute_fix_curvature = true;
            this.editor.zoom_max = 2.0;
            this.editor.zoom_min = 0.4;
            this.editor.start();

            this.editor.on('nodeSelected', (id) => {
                this.selectedNodeId = id;
                this.refreshPropertyPanel();
            });
            this.editor.on('nodeUnselected', () => {
                this.selectedNodeId = null;
                this.closePropertyPanel();
            });
            this.editor.on('nodeDataChanged', (id) => {
                this._refreshNodeHTML(id);
            });
            this.editor.on('nodeMoved', () => { });
        }

        // ─── Drag & Drop ───────────────────────────────────────────────────────

        drag(ev) {
            const el = ev.target.closest ? (ev.target.closest(".fb-drag-node") || ev.target) : ev.target;
            const nodeType = el.getAttribute('data-node');

            if (ev.type === "touchstart") {
                this.mobile_item_selec = nodeType;
            } else {
                ev.dataTransfer.setData("node", nodeType);
            }
        }

        allowDrop(ev) { ev.preventDefault(); }

        drop(ev) {
            if (ev.type === "touchend") {
                const el = document.elementFromPoint(this.mobile_last_move.touches[0].clientX, this.mobile_last_move.touches[0].clientY).closest("#drawflow");
                if (el) this.addNodeToDrawFlow(this.mobile_item_selec, this.mobile_last_move.touches[0].clientX, this.mobile_last_move.touches[0].clientY);
                this.mobile_item_selec = '';
            } else {
                ev.preventDefault();
                this.addNodeToDrawFlow(ev.dataTransfer.getData("node"), ev.clientX, ev.clientY);
            }
        }

        addNodeToDrawFlow(name, pos_x, pos_y) {
            if (!name || this.editor.editor_mode === 'fixed') return;

            const canvas = this.editor.precanvas;
            pos_x = pos_x * (canvas.clientWidth / (canvas.clientWidth * this.editor.zoom)) - (canvas.getBoundingClientRect().x * (canvas.clientWidth / (canvas.clientWidth * this.editor.zoom)));
            pos_y = pos_y * (canvas.clientHeight / (canvas.clientHeight * this.editor.zoom)) - (canvas.getBoundingClientRect().y * (canvas.clientHeight / (canvas.clientHeight * this.editor.zoom)));

            const nodeData = { config: {}, nodeType: name };
            const html = this._buildNodeHTML(name, {});

            const inputsMap = { trigger: 0, condition: 1, action: 1, ai: 1, wait: 1 };
            const outputsMap = { trigger: 1, condition: 2, action: 1, ai: 1, wait: 1 };

            const id = this.editor.addNode(name, inputsMap[name] ?? 1, outputsMap[name] ?? 1, pos_x, pos_y, `fb-drawflow-${name}`, nodeData, html);
            return id;
        }

        // ─── Flow CRUD Operations ──────────────────────────────────────────────

        async loadFlows() {
            try {
                const snapshot = await getDocs(collection(db, "flows"));
                this.flows = [];
                snapshot.forEach(d => this.flows.push({ id: d.id, ...d.data() }));

                this._renderFlowList();

                if (!this.currentFlowId) {
                    this._showEmptyState();
                }
            } catch (error) {
                console.error("Error loading flows:", error);
                Toast.error("Failed to load flows");
            }
        }

        _renderFlowList() {
            const container = document.getElementById('flow-list-container');
            if (!container) return;

            if (this.flows.length === 0) {
                container.innerHTML = '<p class="fb-no-flows-hint">No flows yet. Click <strong>+ New Flow</strong> to create one.</p>';
                return;
            }

            container.innerHTML = this.flows.map(flow => `
                <div class="fb-flow-item ${flow.id === this.currentFlowId ? 'active' : ''}" onclick="window.flowBuilderManager.loadFlowToCanvas('${flow.id}')">
                    <div class="fb-flow-item-info">
                        <span class="fb-flow-item-name">${flow.name || 'Untitled'}</span>
                        <span class="fb-flow-status-badge ${flow.enabled ? 'enabled' : 'disabled'}">${flow.enabled ? 'Active' : 'Paused'}</span>
                    </div>
                    <div class="fb-flow-item-actions">
                        <button class="fb-icon-btn" onclick="event.stopPropagation(); window.flowBuilderManager.toggleFlowEnabled('${flow.id}')" title="${flow.enabled ? 'Pause' : 'Activate'}">
                            ${flow.enabled ? '⏸' : '▶'}
                        </button>
                        <button class="fb-icon-btn danger" onclick="event.stopPropagation(); window.flowBuilderManager.deleteFlow('${flow.id}')" title="Delete">🗑</button>
                    </div>
                </div>
            `).join('');
        }

        createNewFlow() {
            this.currentFlowId = null;
            this._showCanvas();
            if (this.editor) this.editor.clearModuleSelected();
            document.getElementById('flow-name-input').value = 'New Flow';
            document.getElementById('flow-enabled-input').checked = true;
            // Highlight active in list
            this._renderFlowList();
        }

        loadFlowToCanvas(flowId) {
            if (!flowId) {
                this.currentFlowId = null;
                this._showEmptyState();
                return;
            }

            const flow = this.flows.find(f => f.id === flowId);
            if (!flow) return;

            this.currentFlowId = flow.id;
            this._showCanvas();

            document.getElementById('flow-name-input').value = flow.name || '';
            document.getElementById('flow-enabled-input').checked = flow.enabled !== false;

            if (flow.drawflowData) {
                this.editor.import(flow.drawflowData);
            } else {
                this.editor.clearModuleSelected();
            }

            this._renderFlowList();
        }

        async saveCurrentFlow() {
            if (!this.editor) return;

            const flowName = document.getElementById('flow-name-input')?.value || 'Untitled Flow';
            const enabled = document.getElementById('flow-enabled-input')?.checked ?? true;
            const drawflowData = this.editor.export();

            const flowData = { name: flowName, enabled, drawflowData, updatedAt: serverTimestamp() };

            try {
                if (this.currentFlowId) {
                    await setDoc(doc(db, "flows", this.currentFlowId), flowData, { merge: true });
                    Toast.success("Flow saved!");
                } else {
                    flowData.createdAt = serverTimestamp();
                    const newRef = doc(collection(db, "flows"));
                    await setDoc(newRef, flowData);
                    this.currentFlowId = newRef.id;
                    Toast.success("Flow created!");
                }
                await this.loadFlows();
            } catch (error) {
                console.error("Error saving flow:", error);
                Toast.error("Error saving flow");
            }
        }

        async toggleFlowEnabled(flowId) {
            const flow = this.flows.find(f => f.id === flowId);
            if (!flow) return;
            try {
                await setDoc(doc(db, "flows", flowId), { enabled: !flow.enabled }, { merge: true });
                Toast.success(`Flow ${!flow.enabled ? 'activated' : 'paused'}`);
                await this.loadFlows();
            } catch (e) {
                Toast.error("Failed to update flow");
            }
        }

        async deleteFlow(flowId) {
            if (!confirm('Delete this flow? This cannot be undone.')) return;
            try {
                await deleteDoc(doc(db, "flows", flowId));
                if (this.currentFlowId === flowId) {
                    this.currentFlowId = null;
                    this._showEmptyState();
                }
                Toast.success("Flow deleted");
                await this.loadFlows();
            } catch (e) {
                Toast.error("Failed to delete flow");
            }
        }

        // ─── Property Panel ────────────────────────────────────────────────────

        openPropertyPanel() {
            if (!this.selectedNodeId) return;
            this.refreshPropertyPanel();
        }

        refreshPropertyPanel() {
            if (!this.selectedNodeId || !this.editor) return;

            const node = this.editor.getNodeFromId(this.selectedNodeId);
            if (!node) return;

            const panel = document.getElementById('fb-property-panel');
            const title = document.getElementById('fb-panel-title');
            const body = document.getElementById('fb-panel-body');

            if (!panel) return;

            const nodeType = node.name;
            const config = node.data?.config || {};

            const typeLabels = { trigger: '⚡ Trigger', condition: '🛤️ Condition', action: '⚙️ Action', ai: '🤖 AI Agent', wait: '⏳ Wait' };
            title.textContent = typeLabels[nodeType] || 'Node';

            body.innerHTML = this._buildPanelForm(nodeType, config);
            panel.classList.add('open');
        }

        _buildPanelForm(nodeType, config) {
            switch (nodeType) {
                case 'trigger':
                    return `
                        <div class="fb-form-group">
                            <label>Trigger Type</label>
                            <select id="cfg-trigger-type" class="form-select" onchange="window.flowBuilderManager._onPanelChange()">
                                <option value="keyword" ${config.type === 'keyword' ? 'selected' : ''}>Keyword / Phrase</option>
                                <option value="field_change" ${config.type === 'field_change' ? 'selected' : ''}>Lead Field Change</option>
                                <option value="ai_intent" ${config.type === 'ai_intent' ? 'selected' : ''}>AI Intent Detection</option>
                            </select>
                        </div>
                        <div class="fb-form-group" id="cfg-keyword-group" style="${config.type === 'field_change' ? 'display:none' : ''}">
                            <label>Keyword / Phrase</label>
                            <input type="text" id="cfg-trigger-value" class="form-input" value="${config.value || ''}" placeholder="e.g. hello, hi, price" oninput="window.flowBuilderManager._onPanelChange()">
                            <small>Comma-separate multiple keywords.</small>
                        </div>
                        <div class="fb-form-group" id="cfg-field-group" style="${config.type !== 'field_change' ? 'display:none' : ''}">
                            <label>Field Name</label>
                            <input type="text" id="cfg-trigger-field" class="form-input" value="${config.field || ''}" placeholder="e.g. stage" oninput="window.flowBuilderManager._onPanelChange()">
                            <label>New Value</label>
                            <input type="text" id="cfg-trigger-field-val" class="form-input" value="${config.fieldValue || ''}" placeholder="e.g. contacted" oninput="window.flowBuilderManager._onPanelChange()">
                        </div>
                    `;

                case 'condition':
                    return `
                        <div class="fb-form-group">
                            <label>Check Field</label>
                            <select id="cfg-cond-field" class="form-select" oninput="window.flowBuilderManager._onPanelChange()">
                                <option value="message" ${config.field === 'message' ? 'selected' : ''}>Message Content</option>
                                <option value="lead.state" ${config.field === 'lead.state' ? 'selected' : ''}>Lead State</option>
                                <option value="lead.stage" ${config.field === 'lead.stage' ? 'selected' : ''}>Lead Stage</option>
                                <option value="lead.category" ${config.field === 'lead.category' ? 'selected' : ''}>Lead Category</option>
                                <option value="custom" ${config.field === 'custom' ? 'selected' : ''}>Custom Field</option>
                            </select>
                        </div>
                        <div class="fb-form-group">
                            <label>Operator</label>
                            <select id="cfg-cond-op" class="form-select" oninput="window.flowBuilderManager._onPanelChange()">
                                <option value="equals" ${config.operator === 'equals' ? 'selected' : ''}>equals</option>
                                <option value="contains" ${config.operator === 'contains' ? 'selected' : ''}>contains</option>
                                <option value="starts_with" ${config.operator === 'starts_with' ? 'selected' : ''}>starts with</option>
                                <option value="not_equals" ${config.operator === 'not_equals' ? 'selected' : ''}>not equals</option>
                            </select>
                        </div>
                        <div class="fb-form-group">
                            <label>Value</label>
                            <input type="text" id="cfg-cond-value" class="form-input" value="${config.value || ''}" placeholder="e.g. Kerala" oninput="window.flowBuilderManager._onPanelChange()">
                        </div>
                        <p class="fb-panel-hint">Output 1 = True branch &nbsp;·&nbsp; Output 2 = False branch</p>
                    `;

                case 'action':
                    return `
                        <div class="fb-form-group">
                            <label>Action Type</label>
                            <select id="cfg-action-type" class="form-select" onchange="window.flowBuilderManager._onPanelChange(); window.flowBuilderManager._toggleActionFields()">
                                <option value="send_message" ${config.type === 'send_message' ? 'selected' : ''}>💬 Send WhatsApp Message</option>
                                <option value="update_crm" ${config.type === 'update_crm' ? 'selected' : ''}>📝 Update CRM Field</option>
                                <option value="assign_kam" ${config.type === 'assign_kam' ? 'selected' : ''}>👤 Assign KAM</option>
                                <option value="trigger_campaign" ${config.type === 'trigger_campaign' ? 'selected' : ''}>📢 Trigger Campaign</option>
                                <option value="webhook" ${config.type === 'webhook' ? 'selected' : ''}>🔗 Call Webhook (POST)</option>
                            </select>
                        </div>
                        <div id="cfg-action-msg-group" class="fb-form-group" style="${config.type && config.type !== 'send_message' ? 'display:none' : ''}">
                            <label>Message</label>
                            <textarea id="cfg-action-value" class="form-input" rows="4" placeholder="Use {{lead.name}}, {{lead.phone}} as variables" oninput="window.flowBuilderManager._onPanelChange()">${config.value || ''}</textarea>
                            <small>Variables: {{lead.name}} {{lead.phone}} {{lead.state}}</small>
                        </div>
                        <div id="cfg-action-field-group" class="fb-form-group" style="${config.type !== 'update_crm' ? 'display:none' : ''}">
                            <label>Field Name</label>
                            <input type="text" id="cfg-action-field" class="form-input" value="${config.field || ''}" placeholder="e.g. stage" oninput="window.flowBuilderManager._onPanelChange()">
                            <label>New Value</label>
                            <input type="text" id="cfg-action-field-val" class="form-input" value="${config.fieldValue || ''}" placeholder="e.g. contacted" oninput="window.flowBuilderManager._onPanelChange()">
                        </div>
                        <div id="cfg-action-generic-group" class="fb-form-group" style="${!config.type || config.type === 'send_message' || config.type === 'update_crm' ? 'display:none' : ''}">
                            <label>Value / ID / URL</label>
                            <input type="text" id="cfg-action-generic" class="form-input" value="${config.value || ''}" placeholder="Enter value" oninput="window.flowBuilderManager._onPanelChange()">
                        </div>
                    `;

                case 'ai':
                    return `
                        <div class="fb-form-group">
                            <label>AI Prompt</label>
                            <textarea id="cfg-ai-prompt" class="form-input" rows="5" placeholder="e.g. Based on the lead data below, generate a personalized follow-up message.\n\nLead: {{lead.name}}\nContext: {{messages}}" oninput="window.flowBuilderManager._onPanelChange()">${config.prompt || ''}</textarea>
                            <small>Variables: {{lead.name}} {{messages}} {{ai.response}}</small>
                        </div>
                        <div class="fb-form-group">
                            <label>Store response as</label>
                            <input type="text" id="cfg-ai-var" class="form-input" value="${config.outputVar || 'ai_reply'}" placeholder="ai_reply" oninput="window.flowBuilderManager._onPanelChange()">
                            <small>Use {{ai_reply}} in subsequent Action nodes.</small>
                        </div>
                    `;

                case 'wait':
                    return `
                        <div class="fb-form-group">
                            <label>Duration</label>
                            <div style="display:flex; gap: 8px;">
                                <input type="number" id="cfg-wait-duration" class="form-input" value="${config.duration || 5}" min="1" style="width:80px" oninput="window.flowBuilderManager._onPanelChange()">
                                <select id="cfg-wait-unit" class="form-select" onchange="window.flowBuilderManager._onPanelChange()">
                                    <option value="seconds" ${config.unit === 'seconds' ? 'selected' : ''}>Seconds</option>
                                    <option value="minutes" ${config.unit === 'minutes' ? 'selected' : ''}>Minutes</option>
                                    <option value="hours" ${config.unit === 'hours' ? 'selected' : ''}>Hours</option>
                                </select>
                            </div>
                        </div>
                    `;

                default:
                    return '<p>Select a node to configure it.</p>';
            }
        }

        _onPanelChange() {
            if (!this.selectedNodeId) return;
            const config = this._gatherPanelConfig();
            if (!config) return;

            this.editor.updateNodeDataFromId(this.selectedNodeId, { config, nodeType: this.editor.getNodeFromId(this.selectedNodeId)?.name });
            this._refreshNodeHTML(this.selectedNodeId);
        }

        _toggleActionFields() {
            const type = document.getElementById('cfg-action-type')?.value;
            const msgGrp = document.getElementById('cfg-action-msg-group');
            const fieldGrp = document.getElementById('cfg-action-field-group');
            const genericGrp = document.getElementById('cfg-action-generic-group');
            if (!msgGrp) return;
            msgGrp.style.display = type === 'send_message' ? '' : 'none';
            fieldGrp.style.display = type === 'update_crm' ? '' : 'none';
            genericGrp.style.display = (!type || type === 'send_message' || type === 'update_crm') ? 'none' : '';
        }

        _gatherPanelConfig() {
            const node = this.editor?.getNodeFromId(this.selectedNodeId);
            if (!node) return null;
            const t = node.name;

            if (t === 'trigger') {
                const type = document.getElementById('cfg-trigger-type')?.value;
                const cfg = { type, value: document.getElementById('cfg-trigger-value')?.value || '' };
                if (type === 'field_change') {
                    cfg.field = document.getElementById('cfg-trigger-field')?.value;
                    cfg.fieldValue = document.getElementById('cfg-trigger-field-val')?.value;
                }
                return cfg;
            }
            if (t === 'condition') return {
                field: document.getElementById('cfg-cond-field')?.value,
                operator: document.getElementById('cfg-cond-op')?.value,
                value: document.getElementById('cfg-cond-value')?.value
            };
            if (t === 'action') {
                const type = document.getElementById('cfg-action-type')?.value;
                const cfg = { type };
                if (type === 'send_message') cfg.value = document.getElementById('cfg-action-value')?.value;
                else if (type === 'update_crm') { cfg.field = document.getElementById('cfg-action-field')?.value; cfg.fieldValue = document.getElementById('cfg-action-field-val')?.value; }
                else cfg.value = document.getElementById('cfg-action-generic')?.value;
                return cfg;
            }
            if (t === 'ai') return {
                prompt: document.getElementById('cfg-ai-prompt')?.value,
                outputVar: document.getElementById('cfg-ai-var')?.value
            };
            if (t === 'wait') return {
                duration: parseInt(document.getElementById('cfg-wait-duration')?.value) || 5,
                unit: document.getElementById('cfg-wait-unit')?.value
            };
            return {};
        }

        _refreshNodeHTML(nodeId) {
            const node = this.editor?.getNodeFromId(nodeId);
            if (!node) return;
            const el = document.querySelector(`#node-${nodeId} .drawflow_content_node`);
            if (el) el.innerHTML = this._buildNodeHTML(node.name, node.data?.config || {});
        }

        closePropertyPanel() {
            document.getElementById('fb-property-panel')?.classList.remove('open');
        }

        // ─── UI Show/Hide Helpers ──────────────────────────────────────────────

        _showEmptyState() {
            const empty = document.getElementById('no-flow-selected');
            const canvas = document.getElementById('drawflow');
            const panel = document.getElementById('fb-property-panel');
            const topbar = document.getElementById('fb-topbar');

            if (empty) empty.classList.remove('fb-hidden');
            if (canvas) canvas.classList.add('fb-hidden');
            if (panel) panel.classList.remove('open');
            if (topbar) topbar.classList.add('fb-hidden');
        }

        _showCanvas() {
            const empty = document.getElementById('no-flow-selected');
            const canvas = document.getElementById('drawflow');
            const topbar = document.getElementById('fb-topbar');

            if (empty) empty.classList.add('fb-hidden');
            if (canvas) canvas.classList.remove('fb-hidden');
            if (topbar) topbar.classList.remove('fb-hidden');
        }

        // ─── Event Listeners ───────────────────────────────────────────────────

        setupEventListeners() {
            document.getElementById('cfg-trigger-type')?.addEventListener('change', () => {
                const type = document.getElementById('cfg-trigger-type').value;
                document.getElementById('cfg-keyword-group').style.display = type !== 'field_change' ? '' : 'none';
                document.getElementById('cfg-field-group').style.display = type === 'field_change' ? '' : 'none';
            });
        }
    };
}
