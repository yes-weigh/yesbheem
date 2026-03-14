import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Zap, Play, Clock, Tag, Globe, MessageSquare, Split, Bot, UserPlus, FileJson, AlertCircle, TrendingUp, Briefcase } from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
    'CONTACT_CREATED': <Zap size={18} className="text-yellow-400 drop-shadow-sm" />,
    'CONTACT_UPDATED': <Zap size={18} className="text-yellow-400 drop-shadow-sm" />,
    'MESSAGE_RECEIVED': <MessageSquare size={18} className="text-blue-400 drop-shadow-sm" />,
    'TAG_ADDED': <Tag size={18} className="text-purple-400 drop-shadow-sm" />,
    'LEAD_STAGE_CHANGED': <TrendingUp size={18} className="text-orange-400 drop-shadow-sm" />,
    'B2B_INQUIRY': <Briefcase size={18} className="text-indigo-400 drop-shadow-sm" />,
    'SEND_WHATSAPP': <MessageSquare size={18} className="text-green-400 drop-shadow-sm" />,
    'DELAY': <Clock size={18} className="text-orange-400 drop-shadow-sm" />,
    'ADD_TAG': <Tag size={18} className="text-purple-400 drop-shadow-sm" />,
    'UPDATE_LEAD_STAGE': <TrendingUp size={18} className="text-orange-400 drop-shadow-sm" />,
    'ASSIGN_AGENT': <UserPlus size={18} className="text-blue-400 drop-shadow-sm" />,
    'WEBHOOK': <Globe size={18} className="text-blue-500 drop-shadow-sm" />,
    'CONDITION': <Split size={18} className="text-pink-400 drop-shadow-sm" />,
    'AI_REPLY': <Bot size={18} className="text-emerald-400 drop-shadow-sm" />,
    'AI_INTENT': <Bot size={18} className="text-emerald-400 drop-shadow-sm" />,
    'HUMAN_HANDOFF': <UserPlus size={18} className="text-indigo-400 drop-shadow-sm" />,
    'HTTP_REQUEST': <FileJson size={18} className="text-cyan-400 drop-shadow-sm" />
};

export function NodeStatusBadge({ status, error }: { status?: string, error?: string }) {
    if (!status) return null;
    
    const statusMap: Record<string, string> = {
        'PENDING': 'bg-slate-800/80 text-slate-300 border-slate-600/50 shadow-[0_0_15px_rgba(148,163,184,0.15)]',
        'RUNNING': 'bg-blue-900/80 text-blue-300 border-blue-500/50 animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.25)]',
        'COMPLETED': 'bg-emerald-900/80 text-emerald-300 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]',
        'FAILED': 'bg-rose-900/80 text-rose-300 border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.3)]',
        'PAUSED': 'bg-amber-900/80 text-amber-300 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]',
    };
    
    const colorClass = statusMap[status.toUpperCase()] || 'bg-slate-800/80 text-slate-300 border-slate-600';
    
    return (
        <div className="absolute -top-3 -right-3 flex items-center gap-1 z-50">
            {error && (
                <div className="group relative">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 cursor-help shadow-[0_0_20px_rgba(244,63,94,0.4)] backdrop-blur-xl animate-bounce">
                        <AlertCircle size={16} />
                    </div>
                    <div className="absolute bottom-full right-0 mb-3 w-64 p-3 bg-gradient-to-br from-rose-950/90 to-rose-900/90 backdrop-blur-xl text-white text-xs font-medium leading-relaxed rounded-xl border border-rose-500/50 opacity-0 group-hover:opacity-100 transition-all pointer-events-none break-words shadow-[0_10px_40px_rgba(244,63,94,0.3)] translate-y-2 group-hover:translate-y-0">
                        {error}
                        <div className="absolute top-full right-3 w-3 h-3 bg-rose-900 border-r border-b border-rose-500/50 transform rotate-45 -mt-1.5" />
                    </div>
                </div>
            )}
            <div className={`px-3 py-1 rounded-full border text-[10px] font-black tracking-widest backdrop-blur-xl ${colorClass}`}>
                {status.toUpperCase()}
            </div>
        </div>
    );
}

const BaseNode = ({ selected, children, borderColorClass, gradientClass }: any) => (
    <div className={`relative rounded-2xl border transition-all duration-300 bg-[#1A1F2E]/90 backdrop-blur-3xl overflow-hidden ${selected ? `border-white/20 ring-4 ring-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.3)] scale-[1.02]` : `${borderColorClass || 'border-white/5'} shadow-[0_8px_30px_rgba(0,0,0,0.4)] hover:border-white/10 hover:shadow-[0_15px_40px_rgba(0,0,0,0.5)] hover:-translate-y-0.5`}`}>
        {/* Intense top gradient bar */}
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradientClass}`} />
        
        {/* Soft background glow */}
        <div className={`absolute -top-20 -left-20 w-40 h-40 rounded-full opacity-20 blur-3xl bg-gradient-to-br ${gradientClass} pointer-events-none`} />
        
        <div className="relative z-10 w-full h-full">
            {children}
        </div>
    </div>
);

const HandleStyles = "w-3.5 h-3.5 rounded-full bg-body border-2 transition-transform hover:scale-125 z-10 hover:bg-white";

export function TriggerNode({ data, selected }: NodeProps) {
    const type = (data.triggerType as string) || 'CONTACT_CREATED';
    const label = (data.label as string) || 'When contact is created';
    
    return (
        <BaseNode selected={selected} gradientClass="from-blue-400 to-transparent" borderColorClass="border-blue-500">
            <NodeStatusBadge status={data.executionStatus as string} error={data.executionError as string} />
            <div className="px-6 py-5 flex items-center gap-4 min-w-[280px]">
                <div className="w-12 h-12 rounded-xl bg-black/40 flex items-center justify-center border border-white/10 shadow-[inset_0_2px_10px_rgba(255,255,255,0.05)] ring-1 ring-black/50 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    {iconMap[type] || <Zap size={18} className="text-yellow-400" />}
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase font-bold tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">Trigger</span>
                    <span className="text-sm font-semibold text-slate-200">{label}</span>
                </div>
            </div>
            
            <Handle 
                type="source" 
                position={Position.Bottom} 
                className={`${HandleStyles} border-blue-500`} 
            />
        </BaseNode>
    );
}

export function ActionNode({ data, selected }: NodeProps) {
    const type = (data.actionType as string) || 'ADD_TAG';
    const label = (data.label as string) || 'Add Tag';

    return (
        <BaseNode selected={selected} gradientClass="from-purple-400 to-transparent" borderColorClass="border-purple-500">
            <NodeStatusBadge status={data.executionStatus as string} error={data.executionError as string} />
            <Handle type="target" position={Position.Top} className={`${HandleStyles} border-purple-500`} />
            
            <div className="px-6 py-5 flex items-center gap-4 min-w-[280px]">
                <div className="w-12 h-12 rounded-xl bg-black/40 flex items-center justify-center border border-white/10 shadow-[inset_0_2px_10px_rgba(255,255,255,0.05)] ring-1 ring-black/50 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    {iconMap[type] || <Play size={18} className="text-purple-400" />}
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-purple-400">Action</span>
                    <span className="text-sm font-semibold text-slate-200">{label}</span>
                </div>
            </div>
            
            <Handle type="source" position={Position.Bottom} className={`${HandleStyles} border-purple-500`} />
        </BaseNode>
    );
}

export function ConditionNode({ data, selected }: NodeProps) {
    const label = (data.label as string) || 'Condition';
    
    return (
        <BaseNode selected={selected} gradientClass="from-pink-400 to-transparent" borderColorClass="border-pink-500">
            <NodeStatusBadge status={data.executionStatus as string} error={data.executionError as string} />
            <Handle type="target" position={Position.Top} className={`${HandleStyles} border-pink-500`} />
            
            <div className="px-5 py-4 flex items-center gap-4 min-w-[260px] pb-2 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-body to-surface flex items-center justify-center border border-theme shadow-inner ring-1 ring-black/20">
                    <Split size={18} className="text-pink-400" />
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-pink-400">Condition</span>
                    <span className="text-sm font-semibold text-slate-200">{label}</span>
                </div>
            </div>
            
            <div className="flex justify-between px-5 pb-3">
                <span className="text-[11px] uppercase tracking-widest text-emerald-400 font-bold bg-emerald-400/10 px-2 rounded">True</span>
                <span className="text-[11px] uppercase tracking-widest text-rose-400 font-bold bg-rose-400/10 px-2 rounded">False</span>
            </div>

            <Handle type="source" id="true" position={Position.Bottom} style={{ left: '25%' }} className={`${HandleStyles} border-emerald-500`} />
            <Handle type="source" id="false" position={Position.Bottom} style={{ left: '75%' }} className={`${HandleStyles} border-rose-500`} />
        </BaseNode>
    );
}

export function DelayNode({ data, selected }: NodeProps) {
    const label = (data.label as string) || 'Delay';
    
    return (
        <BaseNode selected={selected} gradientClass="from-orange-400 to-transparent" borderColorClass="border-orange-500">
            <NodeStatusBadge status={data.executionStatus as string} error={data.executionError as string} />
            <Handle type="target" position={Position.Top} className={`${HandleStyles} border-orange-500`} />
            <div className="px-6 py-5 flex items-center gap-4 min-w-[280px]">
                <div className="w-12 h-12 rounded-xl bg-black/40 flex items-center justify-center border border-white/10 shadow-[inset_0_2px_10px_rgba(255,255,255,0.05)] ring-1 ring-black/50 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Clock size={18} className="text-orange-400" />
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-orange-400">Wait</span>
                    <span className="text-sm font-semibold text-slate-200">{label}</span>
                </div>
            </div>
            <Handle type="source" position={Position.Bottom} className={`${HandleStyles} border-orange-500`} />
        </BaseNode>
    );
}

export function AINode({ data, selected }: NodeProps) {
    const label = (data.label as string) || 'AI Action';
    const type = (data.actionType as string) || 'AI_REPLY';
    
    return (
        <BaseNode selected={selected} gradientClass="from-emerald-400 to-transparent" borderColorClass="border-emerald-500">
            <NodeStatusBadge status={data.executionStatus as string} error={data.executionError as string} />
            <Handle type="target" position={Position.Top} className={`${HandleStyles} border-emerald-500`} />
            <div className="px-6 py-5 flex items-center gap-4 min-w-[280px]">
                <div className="w-12 h-12 rounded-xl bg-black/40 flex items-center justify-center border border-white/10 shadow-[inset_0_2px_10px_rgba(255,255,255,0.05)] ring-1 ring-black/50 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    {iconMap[type] || <Bot size={18} className="text-emerald-400" />}
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">AI Engine</span>
                    <span className="text-sm font-semibold text-slate-200">{label}</span>
                </div>
            </div>
            <Handle type="source" position={Position.Bottom} className={`${HandleStyles} border-emerald-500`} />
        </BaseNode>
    );
}

export function HandoffNode({ data, selected }: NodeProps) {
    const label = (data.label as string) || 'Human Handoff';
    
    return (
        <BaseNode selected={selected} gradientClass="from-indigo-400 to-transparent" borderColorClass="border-indigo-500">
            <NodeStatusBadge status={data.executionStatus as string} error={data.executionError as string} />
            <Handle type="target" position={Position.Top} className={`${HandleStyles} border-indigo-500`} />
            <div className="px-6 py-5 flex items-center gap-4 min-w-[280px]">
                <div className="w-12 h-12 rounded-xl bg-black/40 flex items-center justify-center border border-white/10 shadow-[inset_0_2px_10px_rgba(255,255,255,0.05)] ring-1 ring-black/50 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <UserPlus size={18} className="text-indigo-400" />
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400">Agent Routing</span>
                    <span className="text-sm font-semibold text-slate-200">{label}</span>
                </div>
            </div>
            <Handle type="source" position={Position.Bottom} className={`${HandleStyles} border-indigo-500`} />
        </BaseNode>
    );
}

export function IntegrationNode({ data, selected }: NodeProps) {
    const label = (data.label as string) || 'API Request';
    const type = (data.actionType as string) || 'HTTP_REQUEST';
    
    return (
        <BaseNode selected={selected} gradientClass="from-cyan-400 to-transparent" borderColorClass="border-cyan-500">
            <NodeStatusBadge status={data.executionStatus as string} error={data.executionError as string} />
            <Handle type="target" position={Position.Top} className={`${HandleStyles} border-cyan-500`} />
            <div className="px-6 py-5 flex items-center gap-4 min-w-[280px]">
                <div className="w-12 h-12 rounded-xl bg-black/40 flex items-center justify-center border border-white/10 shadow-[inset_0_2px_10px_rgba(255,255,255,0.05)] ring-1 ring-black/50 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    {iconMap[type] || <FileJson size={18} className="text-cyan-400" />}
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400">Integration</span>
                    <span className="text-sm font-semibold text-slate-200">{label}</span>
                </div>
            </div>
            <Handle type="source" position={Position.Bottom} className={`${HandleStyles} border-cyan-500`} />
        </BaseNode>
    );
}
