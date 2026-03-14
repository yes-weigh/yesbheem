import React from 'react';
import { Play, Clock, Split, Bot, Globe, UserPlus, Tag, MessageSquare, UserCheck, Megaphone, Zap, Briefcase, TrendingUp } from 'lucide-react';

export function Sidebar() {
    const onDragStart = (event: React.DragEvent, nodeType: string, actionType: string, label: string) => {
        event.dataTransfer.setData('application/reactflow/type', nodeType);
        event.dataTransfer.setData('application/reactflow/actionType', actionType);
        event.dataTransfer.setData('application/reactflow/label', label);
        event.dataTransfer.effectAllowed = 'move';
    };

    const triggerTypes = [
        { type: 'trigger', actionType: 'MESSAGE_RECEIVED', label: 'Message Received', icon: <MessageSquare size={16} className="text-blue-400 group-hover:text-blue-300 transition-colors" /> },
        { type: 'trigger', actionType: 'CONTACT_CREATED', label: 'Contact Created', icon: <UserCheck size={16} className="text-emerald-400 group-hover:text-emerald-300 transition-colors" /> },
        { type: 'trigger', actionType: 'CONTACT_UPDATED', label: 'Contact Updated', icon: <UserCheck size={16} className="text-amber-400 group-hover:text-amber-300 transition-colors" /> },
        { type: 'trigger', actionType: 'LEAD_STAGE_CHANGED', label: 'Lead Stage Changed', icon: <TrendingUp size={16} className="text-orange-400 group-hover:text-orange-300 transition-colors" /> },
        { type: 'trigger', actionType: 'B2B_INQUIRY', label: 'New B2B Inquiry', icon: <Briefcase size={16} className="text-indigo-400 group-hover:text-indigo-300 transition-colors" /> },
        { type: 'trigger', actionType: 'CAMPAIGN_SENT', label: 'Campaign Sent', icon: <Megaphone size={16} className="text-pink-400 group-hover:text-pink-300 transition-colors" /> },
    ];

    const nodeTypes = [
        { type: 'action', actionType: 'SEND_WHATSAPP', label: 'Send WhatsApp', icon: <Play size={16} className="text-emerald-400 group-hover:text-emerald-300 transition-colors" /> },
        { type: 'action', actionType: 'ADD_TAG', label: 'Add Tag', icon: <Tag size={16} className="text-purple-400 group-hover:text-purple-300 transition-colors" /> },
        { type: 'action', actionType: 'UPDATE_LEAD_STAGE', label: 'Update Lead Stage', icon: <TrendingUp size={16} className="text-orange-400 group-hover:text-orange-300 transition-colors" /> },
        { type: 'action', actionType: 'ASSIGN_AGENT', label: 'Assign Agent/KAM', icon: <UserPlus size={16} className="text-blue-400 group-hover:text-blue-300 transition-colors" /> },
        { type: 'condition', actionType: 'CONDITION', label: 'Condition', icon: <Split size={16} className="text-pink-400 group-hover:text-pink-300 transition-colors" /> },
        { type: 'delay', actionType: 'DELAY', label: 'Delay', icon: <Clock size={16} className="text-orange-400 group-hover:text-orange-300 transition-colors" /> },
        { type: 'ai', actionType: 'AI_REPLY', label: 'AI Reply', icon: <Bot size={16} className="text-teal-400 group-hover:text-teal-300 transition-colors" /> },
        { type: 'integration', actionType: 'HTTP_REQUEST', label: 'HTTP Request', icon: <Globe size={16} className="text-cyan-400 group-hover:text-cyan-300 transition-colors" /> },
        { type: 'handoff', actionType: 'HUMAN_HANDOFF', label: 'Human Handoff', icon: <UserPlus size={16} className="text-indigo-400 group-hover:text-indigo-300 transition-colors" /> },
    ];

    const nodeItem = (node: typeof nodeTypes[0], i: number, gradientFrom: string, gradientTo: string) => (
        <div
            key={i}
            className={`group relative overflow-hidden bg-[#151923] border border-white/5 rounded-2xl p-3 flex items-center gap-4 cursor-grab transition-all duration-300 hover:border-${gradientFrom}/30 hover:shadow-[0_0_25px_rgba(0,0,0,0.3)] hover:-translate-y-1`}
            onDragStart={(event) => onDragStart(event, node.type, node.actionType, node.label)}
            draggable
        >
            <div className={`absolute inset-0 bg-gradient-to-r ${gradientFrom} ${gradientTo} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />
            <div className="relative p-2.5 rounded-xl bg-black/40 border border-white/10 shadow-inner group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300">
                {node.icon}
            </div>
            <span className="relative text-slate-300 text-sm font-semibold tracking-wide group-hover:text-white transition-colors duration-300">
                {node.label}
            </span>
        </div>
    );

    return (
        <aside className="w-[320px] bg-[#0A0D14]/95 backdrop-blur-3xl border-r border-white/5 flex flex-col h-full overflow-y-auto z-10 p-6 shrink-0 shadow-[20px_0_50px_rgba(0,0,0,0.2)] relative">
            <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-blue-500/10 via-purple-500/5 to-transparent pointer-events-none opacity-50 mix-blend-screen" />
            
            <div className="flex flex-col gap-8 relative z-10 mt-2">
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-yellow-500/20 rounded-md border border-yellow-500/30">
                                <Zap size={14} className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" />
                            </div>
                            <h3 className="text-white font-black uppercase text-xs tracking-[0.2em]">Triggers</h3>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-800/50 px-2 py-1 rounded-full border border-slate-700/50">START</span>
                    </div>
                    <p className="text-slate-400 text-xs mb-5 font-medium leading-relaxed">Drag a trigger onto the canvas to replace the existing starting point.</p>
                    <div className="flex flex-col gap-3">
                        {triggerTypes.map((node, i) => nodeItem(node, i, 'from-blue-500', 'to-indigo-500'))}
                    </div>
                </div>

                <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent my-2" />

                <div>
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-emerald-500/20 rounded-md border border-emerald-500/30">
                                <Play size={14} className="text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                            </div>
                            <h3 className="text-white font-black uppercase text-xs tracking-[0.2em]">Actions & Logic</h3>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3">
                        {nodeTypes.map((node, i) => nodeItem(node, i, 'from-purple-500', 'to-pink-500'))}
                    </div>
                </div>
            </div>
        </aside>
    );
}
