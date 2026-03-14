import { db } from './services/firebase_config.js';
import { collection, getDocs, getDoc, setDoc, doc, deleteDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { Toast } from './utils/toast.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import { app } from './services/firebase_config.js';

class FlowBuilderManager {
    constructor() {
        this.flows = [];
        this.currentFlowId = null;
        this._setupReactBindings();
    }

    async init() {
        console.log('FlowBuilderManager init: setting up new React integration');
        await this.loadFlowList();
        this.resetCanvas();
    }

    resetCanvas() {
        this.currentFlowId = null;
        if (typeof window.unmountReactFlowBuilder === 'function') {
            window.unmountReactFlowBuilder();
        }
        document.getElementById('react-flow-builder-root')?.classList.add('fb-hidden');
        document.getElementById('no-flow-selected')?.classList.remove('fb-hidden');
        this.updateActiveFlowStyle();
    }

    async loadFlowList() {
        const container = document.getElementById('flow-list-container');
        if (!container) return;

        try {
            // Sort by updated descending if field exists, otherwise just get them
            const flowsRef = collection(db, "flows");
            const q = query(flowsRef, orderBy("updatedAt", "desc"));
            let querySnapshot;
            try {
                querySnapshot = await getDocs(q);
            } catch (e) {
                // Ignore missing index and just fetch
                querySnapshot = await getDocs(flowsRef);
            }

            this.flows = [];
            container.innerHTML = '';

            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                this.flows.push({ id: docSnap.id, ...data });
            });

            if (this.flows.length === 0) {
                container.innerHTML = '<div style="padding: 15px; color: var(--text-muted); text-align: center;">No flows created yet.</div>';
                return;
            }

            this.flows.forEach(flow => {
                const flowEl = document.createElement('div');
                flowEl.className = 'fb-flow-item';
                flowEl.dataset.id = flow.id;
                flowEl.innerHTML = `
                    <div class="fb-flow-item-icon">🔀</div>
                    <div class="fb-flow-item-details">
                        <div class="fb-flow-item-name">${this.escapeHTML(flow.name || 'Untitled Flow')}</div>
                        <div class="fb-flow-item-meta">${this.formatDate(flow.updatedAt)}</div>
                    </div>
                    <div class="fb-flow-item-actions">
                        <button class="btn btn-icon btn-sm fb-delete-flow-btn" title="Delete Flow">🗑️</button>
                    </div>
                `;
                
                flowEl.addEventListener('click', (e) => {
                    if (e.target.closest('.fb-delete-flow-btn')) {
                        e.stopPropagation();
                        this.deleteFlow(flow.id, flow.name);
                    } else {
                        this.loadFlowIntoCanvas(flow.id);
                    }
                });
                
                container.appendChild(flowEl);
            });
            this.updateActiveFlowStyle();

        } catch (error) {
            console.error("Error loading flows:", error);
            container.innerHTML = '<div style="padding: 15px; color: var(--danger); text-align: center;">Failed to load flows.<br><button class="btn btn-sm mt-2" onclick="window.flowBuilderManager.loadFlowList()">Retry</button></div>';
        }
    }

    async loadFlowIntoCanvas(id) {
        document.getElementById('react-flow-builder-root')?.classList.remove('fb-hidden');
        document.getElementById('no-flow-selected')?.classList.add('fb-hidden');

        try {
            const flowDoc = await getDoc(doc(db, "flows", id));
            if (!flowDoc.exists()) {
                Toast.error("Flow not found");
                return;
            }
            
            const flowData = flowDoc.data();
            this.currentFlowId = id;

            // Mount React with existing flow data
            if (typeof window.mountReactFlowBuilder === 'function') {
                window.mountReactFlowBuilder({
                    initialRuleId: id,
                    initialName: flowData.name || 'Untitled Flow',
                    initialNodes: flowData.nodes || [],
                    initialEdges: flowData.edges || [],
                    initialViewport: flowData.viewport || null
                });
            } else {
                Toast.error("React flow builder not initialized.");
            }

            this.updateActiveFlowStyle();
        } catch (error) {
            console.error("Error loading specific flow:", error);
            Toast.error("Failed to load flow");
        }
    }

    createNewFlow() {
        this.currentFlowId = null;
        document.getElementById('react-flow-builder-root')?.classList.remove('fb-hidden');
        document.getElementById('no-flow-selected')?.classList.add('fb-hidden');
        
        if (typeof window.mountReactFlowBuilder === 'function') {
            window.mountReactFlowBuilder({
                initialRuleId: null,
                initialName: 'Untitled Flow',
                initialNodes: [],
                initialEdges: [],
                initialViewport: null
            });
        }
        this.updateActiveFlowStyle();
    }

    async deleteFlow(id, name) {
        if (!confirm(`Are you sure you want to delete the flow "${name || 'Untitled Flow'}"? This cannot be undone.`)) {
            return;
        }

        try {
            await deleteDoc(doc(db, "flows", id));
            Toast.success("Flow deleted");
            
            if (this.currentFlowId === id) {
                this.resetCanvas();
            }
            this.loadFlowList();
        } catch (error) {
            console.error("Error deleting flow:", error);
            Toast.error("Failed to delete flow");
        }
    }

    updateActiveFlowStyle() {
        document.querySelectorAll('.fb-flow-item').forEach(el => {
            if (el.dataset.id === this.currentFlowId) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
    }

    _setupReactBindings() {
        window.saveFlowData = async (payload) => {
            const { id, name, nodes, edges, viewport, flowDefinition, ...meta } = payload;
            try {
                const flowRef = id ? doc(db, "flows", id) : doc(collection(db, "flows"));
                
                // Unpack from flowDefinition if provided, otherwise root, otherwise empty array
                const safeNodes = nodes || (flowDefinition && flowDefinition.nodes) || [];
                const safeEdges = edges || (flowDefinition && flowDefinition.edges) || [];
                
                const flowData = {
                    name: name || 'Untitled Flow',
                    nodes: safeNodes,
                    edges: safeEdges,
                    ...meta,
                    updatedAt: serverTimestamp()
                };
                
                // Add valid viewport if it exists
                if (viewport !== undefined) flowData.viewport = viewport;
                if (flowDefinition) flowData.flowDefinition = flowDefinition;

                if (!id) {
                    flowData.createdAt = serverTimestamp();
                }

                // Strip any accidental top-level undefined fields to prevent Firebase crashes
                Object.keys(flowData).forEach(key => {
                    if (flowData[key] === undefined) {
                        delete flowData[key];
                    }
                });

                await setDoc(flowRef, flowData, { merge: true });
                Toast.success("Flow saved successfully");
                
                // If it was a new flow, update ID and reload list
                if (this.currentFlowId !== flowRef.id) {
                    this.currentFlowId = flowRef.id;
                    await this.loadFlowList();
                }
                
                return { id: flowRef.id, ...flowData };
            } catch (e) {
                console.error("saveFlowData Error:", e);
                Toast.error("Failed to save flow");
                throw e;
            }
        };

        window.simulateFlowData = async (payload) => {
            try {
                const functions = getFunctions(app);
                const simulateFlow = httpsCallable(functions, 'simulateFlow');
                const result = await simulateFlow(payload);
                return result.data;
            } catch (e) {
                console.error("simulateFlowData Error:", e);
                Toast.error("Simulation failed");
                throw e; // Let React component catch it
            }
        };

        window.getWhatsAppSessions = async () => {
            try {
                const instancesSnap = await getDocs(collection(db, "whatsapp_instances"));
                const instances = [];
                instancesSnap.forEach(doc => {
                    instances.push({ id: doc.id, ...doc.data() });
                });
                return instances;
            } catch(e) {
                console.error("getWhatsAppSessions error", e);
                return [];
            }
        };

        window.getFlowExecutions = async (ruleId) => {
            try {
                const logsRef = collection(db, "flow_executions");
                // Fetch basic executions for this flow
                const q = query(logsRef, orderBy("startedAt", "desc")); 
                const snapshots = await getDocs(q);
                const executions = [];
                snapshots.forEach(doc => {
                    const data = doc.data();
                    if (data.flowId === ruleId) {
                        executions.push({ id: doc.id, ...data });
                    }
                });
                return executions;
            } catch (e) {
                console.error("getFlowExecutions error", e);
                return [];
            }
        };

        window.getFlowSimulationLogs = async (ruleId, executionId) => {
            try {
                const logsRef = collection(db, "flow_executions", executionId, "logs");
                const snapshots = await getDocs(logsRef);
                const logs = [];
                snapshots.forEach(doc => {
                    logs.push({ id: doc.id, ...doc.data() });
                });
                return logs;
            } catch (e) {
                console.error("getFlowSimulationLogs error", e);
                return [];
            }
        };

        window.generateAIFlow = async (prompt) => {
            try {
                const functions = getFunctions(app);
                const aiGen = httpsCallable(functions, 'generateAIFlow');
                const result = await aiGen({ prompt });
                
                if (!result.data || !result.data.flowData || !result.data.flowData.drawflow) {
                    throw new Error("Invalid format returned by AI generation.");
                }

                const drawflowData = result.data.flowData.drawflow.Home.data;
                const nodes = [];
                const edges = [];

                // Convert drawflow JSON to React Flow format
                Object.values(drawflowData).forEach((node) => {
                    const id = node.id.toString();
                    
                    let reactFlowType = 'action';
                    let actionType = undefined;
                    let triggerType = undefined;
                    const cleanData = { ...node.data };

                    if (node.name === 'trigger') {
                        reactFlowType = 'trigger';
                        triggerType = cleanData.triggerType || cleanData.keyword || 'CONTACT_CREATED';
                        cleanData.label = node.html || node.name;
                    } else if (node.name === 'message') {
                        reactFlowType = 'action';
                        actionType = 'SEND_WHATSAPP';
                        cleanData.messageContent = cleanData.text || "Hello";
                        cleanData.label = 'Send WhatsApp';
                        delete cleanData.text;
                    } else if (node.name === 'condition') {
                        reactFlowType = 'condition';
                        cleanData.label = 'Condition';
                    } else if (node.name === 'delay') {
                        reactFlowType = 'delay';
                        actionType = 'DELAY';
                        cleanData.label = `Wait ${cleanData.duration || 1} ${cleanData.unit || 'minutes'}`;
                    } else {
                        reactFlowType = 'action';
                        cleanData.label = node.html || node.name;
                    }

                    // Create Node
                    nodes.push({
                        id: `node_${id}`,
                        type: reactFlowType,
                        position: { x: typeof node.pos_x === 'number' ? node.pos_x : 100, y: typeof node.pos_y === 'number' ? node.pos_y : 100 },
                        data: {
                            label: cleanData.label,
                            actionType,
                            triggerType,
                            ...cleanData
                        }
                    });

                    // Create Edges
                    if (node.outputs) {
                        Object.keys(node.outputs).forEach(outputKey => {
                            const connections = node.outputs[outputKey].connections;
                            connections.forEach(conn => {
                                edges.push({
                                    id: `edge_${id}_${conn.node}`,
                                    source: `node_${id}`,
                                    target: `node_${conn.node}`,
                                    sourceHandle: reactFlowType === 'condition' 
                                        ? (outputKey === 'output_2' ? 'false' : 'true') 
                                        : undefined,
                                    animated: true,
                                    style: { stroke: '#3b82f6', strokeWidth: 2 }
                                });
                            });
                        });
                    }
                });

                return { name: `AI Generated ${new Date().toLocaleTimeString()}`, nodes, edges };
            } catch(e) {
                console.error("generateAIFlow error", e);
                throw e;
            }
        };
    }

    escapeHTML(str) {
        if (!str) return '';
        const element = document.createElement('div');
        if (str) {
            element.innerText = element.textContent = str;
            str = element.innerHTML;
        }
        return str;
    }

    formatDate(timestamp) {
        if (!timestamp) return 'Just now';
        
        // Handle Firestore timestamp
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// Expose globally
window.FlowBuilderManager = FlowBuilderManager;
if (!window.flowBuilderManager) {
    window.flowBuilderManager = new FlowBuilderManager();
}
