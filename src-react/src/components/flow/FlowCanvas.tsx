"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    ReactFlow,
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    addEdge,
    ReactFlowProvider,
    useReactFlow
} from '@xyflow/react';
import type { Connection, Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { TriggerNode, ActionNode, ConditionNode, DelayNode, AINode, IntegrationNode, HandoffNode } from './CustomNodes';
import { NodePropertiesPanel } from './NodePropertiesPanel';
import { ExecutionLogsPanel } from './ExecutionLogsPanel';
import { AIFlowGenerator } from '../AIFlowGenerator';
import { Sidebar } from './Sidebar';
import { Save, AlertCircle, Loader2, Play, Activity, Sparkles, Clock, X } from 'lucide-react';



// Helper to forcefully strip undefined values from nested objects/arrays before Firebase save
const cleanDeep = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
        return obj.map(item => cleanDeep(item)).filter(item => item !== undefined);
    }
    const cleanObj: Record<string, any> = {};
    for (const key in obj) {
        const val = cleanDeep(obj[key]);
        if (val !== undefined) {
            cleanObj[key] = val;
        }
    }
    return cleanObj;
};

const nodeTypes = {
    trigger: TriggerNode,
    action: ActionNode,
    condition: ConditionNode,
    delay: DelayNode,
    ai: AINode,
    integration: IntegrationNode,
    handoff: HandoffNode
};

const initialNodes: Node[] = [
    {
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 250, y: 100 },
        data: { triggerType: 'CONTACT_CREATED', label: 'When contact is created' },
        deletable: false,
    }
];

const initialEdges: Edge[] = [];

let id = 1;
const getId = () => `node_${id++}`;

interface FlowCanvasProps {
    initialNodes?: Node[];
    initialEdges?: Edge[];
    initialName?: string;
    initialRuleId?: string;
    openAI?: boolean;
    replayExecutionId?: string;
}

function FlowCanvasInner({ initialNodes: propsNodes, initialEdges: propsEdges, initialName, initialRuleId, openAI, ...props }: FlowCanvasProps) {

    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { screenToFlowPosition } = useReactFlow();
    const [nodes, setNodes, onNodesChange] = useNodesState(propsNodes || initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(propsEdges || initialEdges);
    
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [ruleName, setRuleName] = useState(initialName || 'Untitled Rule');
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [savedRuleId, setSavedRuleId] = useState<string | null>(initialRuleId || null);
    const [showLogs, setShowLogs] = useState(false);
    const [isSimulating, setIsSimulating] = useState(false);
    const [showAIGenerator, setShowAIGenerator] = useState(openAI || false);
    const [replayExecutionId, setReplayExecutionId] = useState<string | null>(props.replayExecutionId || null);
    const [waSessions, setWaSessions] = useState<any[]>([]);

    // Fetch WhatsApp sessions once for NodePropertiesPanel session selectors
    useEffect(() => {
        if (typeof window !== 'undefined' && (window as any).getWhatsAppSessions) {
            (window as any).getWhatsAppSessions().then((sessions: any[]) => {
                setWaSessions(sessions || []);
            }).catch(() => {});
        }
    }, []);

    // Fetch execution logs if replay mode is triggered
    useEffect(() => {
        if (!initialRuleId || !replayExecutionId) return;

        const loadReplayTrace = async () => {
            try {
                if (typeof window !== 'undefined' && (window as any).getFlowSimulationLogs) {
                    const logs = await (window as any).getFlowSimulationLogs(initialRuleId, replayExecutionId);
                    
                    setNodes(currentNodes => currentNodes.map(node => {
                        const logForNode = logs.find((l: any) => l.nodeId === node.id);
                        if (logForNode) {
                            return {
                                ...node,
                                data: { ...node.data, executionStatus: logForNode.status, executionError: logForNode.error }
                            };
                        }
                        return node;
                    }));
                }
            } catch (err) {
                console.error("Failed to load replay trace logs", err);
            }
        };

        loadReplayTrace();
    }, [initialRuleId, replayExecutionId, setNodes]);

    const onConnect = useCallback(
        (params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
        [setEdges]
    );

    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        setSelectedNode(node);
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
    }, []);

    const updateNodeData = useCallback((nodeId: string, partialData: any) => {
        setNodes((nds) => 
            nds.map((n) => {
                if (n.id === nodeId) {
                    const merged = { ...n.data, ...partialData };
                    n.data = merged;
                    if (selectedNode?.id === nodeId) {
                        setSelectedNode({ ...n, data: merged });
                    }
                }
                return n;
            })
        );
    }, [setNodes, selectedNode]);

    const deleteNode = useCallback((nodeId: string) => {
        setNodes((nds) => nds.filter((n) => n.id !== nodeId));
        setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
        setSelectedNode(null);
    }, [setNodes, setEdges]);

    const duplicateNode = useCallback((nodeId: string) => {
        setNodes((nds) => {
            const nodeToDuplicate = nds.find(n => n.id === nodeId);
            if (!nodeToDuplicate) return nds;
            
            const newNode: Node = {
                ...nodeToDuplicate,
                id: getId(),
                position: { 
                    x: nodeToDuplicate.position.x + 50, 
                    y: nodeToDuplicate.position.y + 50 
                },
                selected: false
            };
            return nds.concat(newNode);
        });
    }, [setNodes]);

    const clearAllNodes = () => {
        setNodes(nds => nds.filter(n => n.type === 'trigger'));
        setEdges([]);
        setSelectedNode(null);
    };

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow/type');
            const actionType = event.dataTransfer.getData('application/reactflow/actionType');
            const label = event.dataTransfer.getData('application/reactflow/label');

            if (typeof type === 'undefined' || !type) {
                return;
            }

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            // If dropping a trigger, replace the existing trigger node instead of adding a new one
            if (type === 'trigger') {
                setNodes((nds) => {
                    const existingTrigger = nds.find(n => n.type === 'trigger');
                    if (existingTrigger) {
                        return nds.map(n =>
                            n.type === 'trigger'
                                ? { ...n, position, data: { triggerType: actionType, label } }
                                : n
                        );
                    }
                    // No existing trigger, add one
                    return nds.concat({
                        id: 'trigger-1',
                        type: 'trigger',
                        position,
                        data: { triggerType: actionType, label },
                        deletable: false,
                    });
                });
                return;
            }

            const newNode: Node = {
                id: getId(),
                type,
                position,
                data: { actionType, label },
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [screenToFlowPosition, setNodes]
    );

    const handleSave = async () => {
        setErrorMsg('');
        
        // Validation: Linear check
        const triggerNode = nodes.find(n => n.type === 'trigger');
        if (!triggerNode) {
            setErrorMsg('Flow must start with a Trigger');
            return;
        }

        const actionableNodes = nodes.filter(n => n.type !== 'trigger');
        if (actionableNodes.length === 0) {
            setErrorMsg('Flow must contain at least one step after the Trigger');
            return;
        }

        // Reachability check via BFS
        const visited = new Set<string>();
        const queue = [triggerNode.id];
        
        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (!visited.has(currentId)) {
                visited.add(currentId);
                const outEdges = edges.filter(e => e.source === currentId);
                for (const edge of outEdges) {
                    queue.push(edge.target);
                }
            }
        }

        if (visited.size !== nodes.length) {
            setErrorMsg('All actions must be connected to the trigger path.');
            return;
        }

        // Strip undefined properties which Firebase rejects aggressively
        const payload = cleanDeep({
            id: savedRuleId || undefined,
            name: ruleName,
            description: `Visual graph automation flow`,
            trigger: { 
                type: triggerNode.data.triggerType || 'CONTACT_CREATED',
                ...triggerNode.data 
            },
            eventType: (triggerNode.data.triggerType as string || 'CONTACT_CREATED').toLowerCase(),
            actions: [], // Explicitly use graph engine exclusively on new saves
            flowDefinition: {
                nodes: nodes,
                edges: edges
            }
        });

        try {
            setIsSaving(true);
            if (typeof window !== 'undefined' && (window as any).saveFlowData) {
                const result = await (window as any).saveFlowData(payload);
                if (result && result.id) {
                    setSavedRuleId(result.id);
                }
            } else {
                console.warn("[React Flow] window.saveFlowData is undefined. Logging payload:", payload);
                setTimeout(() => setIsSaving(false), 2000); // mock
            }
            setIsSaving(false);
        } catch (err: any) {
            setErrorMsg(err.message || 'Failed to save automation rule');
            setIsSaving(false);
        }
    };

    const handleSimulate = async () => {
        setErrorMsg('');
        
        const triggerNode = nodes.find(n => n.type === 'trigger');
        if (!triggerNode) return setErrorMsg('Flow must start with a Trigger');

        if (!savedRuleId) {
            setErrorMsg('Please save the flow first before simulating.');
            setIsSimulating(false);
            return;
        }

        const payload = {
            flowId: savedRuleId,
            messageData: { text: 'test' }, // Mock message for now
            crmPhone: 'simulation_crm',
            leadPhone: 'simulation_lead'
        };

        try {
            setIsSimulating(true);
            
            if (typeof window !== 'undefined' && (window as any).simulateFlowData) {
                const logs = await (window as any).simulateFlowData(payload);
                if (logs) {
                    setShowLogs(true);
                    (window as any).__lastSimulationTrace = logs;
                }
            } else {
                console.warn("[React Flow] window.simulateFlowData missing. Cannot fetch simulation trace.");
                setTimeout(() => setIsSimulating(false), 1500); // mock wait
            }

        } catch (err: any) {
            setErrorMsg(err.message || 'Simulation dispatch failed');
        } finally {
            setIsSimulating(false);
        }
    };

    return (
        <div className="flex flex-col h-screen w-full bg-base">
            {/* Topbar */}
            <div className="h-20 border-b border-theme/50 bg-[#0A0D14]/80 backdrop-blur-2xl flex items-center justify-between px-8 z-10 shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
                <div className="flex items-center gap-6">
                    <button onClick={() => { if (typeof window !== 'undefined' && (window as any).flowBuilderManager) { (window as any).flowBuilderManager.resetCanvas(); } }} title="Close Canvas" className="text-secondary hover:text-white transition-all font-medium flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5">
                        <X size={18} /> <span className="text-sm tracking-wide">Close</span>
                    </button>
                    <div className="h-8 w-px bg-gradient-to-b from-transparent via-theme to-transparent opacity-50" />
                    <div className="relative group">
                        <input 
                            type="text" 
                            value={ruleName} 
                            onChange={(e) => setRuleName(e.target.value)}
                            className="bg-transparent border-none text-xl font-extrabold text-white focus:outline-none focus:ring-0 w-80 p-0 placeholder-slate-600 transition-all"
                            placeholder="Name your flow..."
                        />
                        <div className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 group-hover:w-full transition-all duration-500" />
                    </div>
                    {replayExecutionId && (
                        <div className="flex items-center gap-1.5 ml-4 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-md text-amber-500 font-medium text-xs">
                            <Clock size={14} />
                            Viewing Replay (Read-Only Status)
                            <button 
                                title="Exit replay mode"
                                onClick={() => {
                                    setReplayExecutionId(null);
                                    // Strip the execution statuses from the nodes
                                    setNodes(currentNodes => currentNodes.map(node => {
                                        const { executionStatus, executionError, ...cleanData } = node.data;
                                        return { ...node, data: cleanData };
                                    }));
                                }}
                                className="ml-2 hover:bg-amber-500/20 p-0.5 rounded"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    )}
                </div>
                
                <div className="flex items-center gap-3">
                    {errorMsg && (
                        <div className="flex items-center gap-2 text-rose-400 bg-rose-500/10 px-4 py-2 rounded-xl border border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.1)] animate-in fade-in zoom-in duration-300">
                            <AlertCircle size={16} className="animate-pulse" />
                            <span className="text-sm font-medium">{errorMsg}</span>
                        </div>
                    )}
                    <button onClick={clearAllNodes} className="px-4 py-2 text-sm font-semibold rounded-xl text-rose-400 border border-rose-500/20 hover:bg-rose-500/10 hover:border-rose-500/40 transition-all duration-300">
                        Clear Canvas
                    </button>
                    {savedRuleId && (
                        <button onClick={() => setShowLogs(true)} className="px-4 py-2 text-sm font-semibold rounded-xl text-slate-300 border border-slate-700 bg-slate-800/50 hover:bg-slate-700/50 hover:text-white transition-all flex items-center gap-2">
                            <Activity size={16} />
                            Logs
                        </button>
                    )}
                    <button onClick={handleSimulate} disabled={isSimulating} className="px-4 py-2 text-sm font-semibold rounded-xl text-emerald-400 border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.05)] hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] disabled:opacity-50">
                        {isSimulating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                        Test Flow
                    </button>
                    <button onClick={() => setShowAIGenerator(true)} className="px-4 py-2 text-sm font-semibold rounded-xl text-indigo-400 border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(99,102,241,0.05)] hover:shadow-[0_0_20px_rgba(99,102,241,0.15)]">
                        <Sparkles size={16} />
                        AI Generate
                    </button>
                    <button onClick={handleSave} disabled={isSaving} className="relative group px-6 py-2 text-sm font-bold text-white rounded-xl overflow-hidden shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-all disabled:opacity-50">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 group-hover:bg-[length:200%_auto] animate-gradient" />
                        <div className="relative flex items-center gap-2">
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Save & Activate
                        </div>
                    </button>
                </div>
            </div>

            {/* Canvas Area */}
            <div className="flex-1 flex overflow-hidden">
                <Sidebar />
                <div className="flex-1 relative" ref={reactFlowWrapper}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        nodeTypes={nodeTypes}
                    fitView
                    className="bg-[#0b0d14]"
                    proOptions={{ hideAttribution: true }}
                >
                    <Background color="#1e293b" gap={24} size={2} variant={BackgroundVariant.Dots} />
                    <Controls className="!bg-[#151b2b] !border-[#2a3040] !text-slate-400 !rounded-xl !shadow-2xl overflow-hidden [&>button]:!border-b-[#2a3040] hover:[&>button]:!bg-[#1e2538] transition-all" />
                    <MiniMap 
                        className="!bg-[#151b2b] !border-[#2a3040] !rounded-xl !shadow-2xl" 
                        maskColor="rgba(11, 13, 20, 0.7)" 
                        nodeColor={(n) => {
                            if (n.type === 'trigger') return '#3b82f6';
                            if (n.type === 'action') return '#a855f7';
                            if (n.type === 'condition') return '#ec4899';
                            if (n.type === 'delay') return '#f97316';
                            if (n.type === 'ai') return '#10b981';
                            if (n.type === 'integration') return '#06b6d4';
                            if (n.type === 'handoff') return '#6366f1';
                            return '#475569';
                        }}
                    />
                </ReactFlow>

                <NodePropertiesPanel 
                    selectedNode={selectedNode} 
                    onClose={() => setSelectedNode(null)}
                    onUpdateNodeData={updateNodeData}
                    onDelete={deleteNode}
                    onDuplicate={duplicateNode}
                    sessions={waSessions}
                />

                {showLogs && savedRuleId && (
                    <ExecutionLogsPanel 
                        ruleId={savedRuleId}
                        onClose={() => setShowLogs(false)}
                    />
                )}

                {showAIGenerator && (
                    <AIFlowGenerator
                        onClose={() => setShowAIGenerator(false)}
                        onFlowGenerated={(name, genNodes, genEdges) => {
                            setRuleName(name);
                            setNodes(genNodes as Node[]);
                            setEdges(genEdges as Edge[]);
                        }}
                    />
                )}
            </div>
        </div>
    </div>
    );
}

export function FlowCanvas(props: FlowCanvasProps) {
    return (
        <ReactFlowProvider>
            <FlowCanvasInner {...props} />
        </ReactFlowProvider>
    );
}
