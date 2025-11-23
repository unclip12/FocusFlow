
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DayPlan, getAdjustedDate, Block, AppSettings, TimeLogEntry, TimeLogCategory, BlockTask, KnowledgeBaseEntry, RevisionSettings } from '../types';
import { getDayPlan, saveDayPlan, getRevisionSettings, saveKnowledgeBase } from '../services/firebase';
import { saveTimeLog, deleteTimeLog } from '../services/timeLogService';
import { startBlock, updateBlockInPlan, finishBlock, insertBlockAndShift, moveTasksToNextBlock, deleteBlock, startVirtualBlock, moveTasksToFuturePlan } from '../services/planService';
import { generateBlocks } from '../services/blockGenerator'; 
import { CalendarIcon, ClockIcon, VideoIcon, FireIcon, BookOpenIcon, PlayIcon, PauseIcon, ListCheckIcon, StopIcon, CheckCircleIcon, CoffeeIcon, ChevronLeftIcon, ChevronRightIcon, PencilSquareIcon, PlusIcon, XMarkIcon, TrashIcon, ArrowRightIcon, ChartBarIcon, ArrowPathIcon, ArrowUturnLeftIcon, ArrowUturnRightIcon, CursorArrowRaysIcon, SunIcon, MoonIcon, SunCloudIcon, SunsetIcon, ChevronDownIcon, SparklesIcon } from './Icons';
import { TaskCompletionModal } from './TaskCompletionModal'; 
import { ManualPlanModal } from './ManualPlanModal'; 
import { AddBlockModal } from './AddBlockModal';
import { AddBreakModal } from './AddBreakModal';
import { BlockDetailModal } from './BlockDetailModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { processLogEntries } from '../services/faLoggerService';
import { calculateNextRevisionDate } from '../services/srsService';

// --- HELPERS ---
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

const formatTime12 = (timeStr: string | undefined) => {
    if (!timeStr) return "--:--";
    if (timeStr.toLowerCase().includes('m')) return timeStr;
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr);
    const m = parseInt(mStr);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const d = new Date();
    d.setHours(h, m);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const parseTimeToMinutes = (timeStr: string): number => {
    try {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    } catch (e) {
        return 0;
    }
};

const formatDurationString = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const formatTime24 = (date: Date) => {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

// --- COMPONENTS ---

const TimelineSectionHeader: React.FC<{ 
    period: string, 
    totalBlocks: number, 
    completedBlocks: number,
    isCollapsed: boolean,
    onToggle: () => void,
    timeRange?: string
}> = ({ period, totalBlocks, completedBlocks, isCollapsed, onToggle, timeRange }) => {
    
    const progressPercent = totalBlocks > 0 ? (completedBlocks / totalBlocks) * 100 : 0;

    let config = {
        bgBase: 'bg-slate-100 dark:bg-slate-800',
        fillGradient: 'from-slate-500 to-slate-600',
        iconColor: 'text-slate-700 dark:text-slate-400',
        textColor: 'text-slate-900 dark:text-slate-100',
        borderColor: 'border-slate-300 dark:border-slate-700',
        shadowColor: 'rgba(100, 116, 139, 0.6)',
        Icon: ClockIcon
    };

    switch (period) {
        case 'Midnight': // 12AM - 5AM
            config = {
                bgBase: 'bg-slate-200 dark:bg-slate-900',
                fillGradient: 'from-slate-400 via-violet-500 to-slate-500',
                iconColor: 'text-slate-700 dark:text-slate-400',
                textColor: 'text-slate-900 dark:text-slate-200',
                borderColor: 'border-slate-300 dark:border-slate-700',
                shadowColor: 'rgba(71, 85, 105, 0.5)',
                Icon: SparklesIcon
            };
            break;
        case 'Early Morning': // 5AM - 8AM
            config = {
                bgBase: 'bg-rose-100 dark:bg-rose-900/30',
                fillGradient: 'from-rose-200 via-orange-200 to-rose-300',
                iconColor: 'text-rose-700 dark:text-rose-400',
                textColor: 'text-rose-950 dark:text-rose-100',
                borderColor: 'border-rose-200 dark:border-rose-700',
                shadowColor: 'rgba(244, 63, 94, 0.5)',
                Icon: SunIcon
            };
            break;
        case 'Morning': // 8AM - 1PM
            config = {
                bgBase: 'bg-amber-100 dark:bg-amber-900/30',
                fillGradient: 'from-amber-200 via-yellow-300 to-amber-300',
                iconColor: 'text-amber-700 dark:text-amber-400',
                textColor: 'text-amber-950 dark:text-amber-100',
                borderColor: 'border-amber-200 dark:border-amber-700',
                shadowColor: 'rgba(245, 158, 11, 0.5)',
                Icon: SunIcon
            };
            break;
        case 'Afternoon': // 1PM - 6PM
            config = {
                bgBase: 'bg-orange-100 dark:bg-orange-900/30',
                fillGradient: 'from-orange-200 via-red-300 to-orange-300',
                iconColor: 'text-orange-700 dark:text-orange-400',
                textColor: 'text-orange-950 dark:text-orange-100',
                borderColor: 'border-orange-200 dark:border-orange-700',
                shadowColor: 'rgba(249, 115, 22, 0.5)',
                Icon: SunCloudIcon
            };
            break;
        case 'Evening': // 6PM - 8PM
            config = {
                bgBase: 'bg-indigo-100 dark:bg-indigo-900/30',
                fillGradient: 'from-indigo-300 via-purple-400 to-indigo-300',
                iconColor: 'text-indigo-700 dark:text-indigo-400',
                textColor: 'text-indigo-950 dark:text-indigo-100',
                borderColor: 'border-indigo-200 dark:border-indigo-700',
                shadowColor: 'rgba(99, 102, 241, 0.5)',
                Icon: SunsetIcon
            };
            break;
        case 'Night': // 8PM - 12AM
            config = {
                bgBase: 'bg-blue-100 dark:bg-blue-900/30',
                fillGradient: 'from-blue-400 via-indigo-500 to-blue-500',
                iconColor: 'text-blue-700 dark:text-blue-400',
                textColor: 'text-blue-950 dark:text-blue-100',
                borderColor: 'border-blue-300 dark:border-blue-700',
                shadowColor: 'rgba(37, 99, 235, 0.5)',
                Icon: MoonIcon
            };
            break;
    }

    const { Icon } = config;

    return (
        <div 
            onClick={onToggle}
            className={`relative mt-8 mb-4 h-24 rounded-2xl overflow-hidden cursor-pointer select-none transform transition-all active:scale-[0.98] group card-3d ${config.bgBase} border-2 ${config.borderColor}`}
            style={{
                animation: `pulse-border-${period.replace(/\s+/g, '')} 3s infinite ease-in-out`
            }}
        >
            {/* Liquid Progress Fill Container */}
            <div 
                className="absolute top-0 left-0 bottom-0 transition-all duration-1000 ease-out overflow-hidden"
                style={{ width: `${progressPercent}%` }}
            >
                {/* The Liquid Gradient Background */}
                <div className={`absolute inset-0 bg-gradient-to-r ${config.fillGradient} opacity-90`}></div>
                
                {/* Animated Water Flow Effect (Overlay) */}
                <div 
                    className="absolute inset-0 opacity-30"
                    style={{
                        backgroundImage: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 45%, transparent 60%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 3s infinite linear'
                    }}
                ></div>

                {/* Inner Glow */}
                <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(255,255,255,0.3)]"></div>
            </div>

            {/* Content Layer (Z-Indexed above fill) */}
            <div className="relative z-10 flex items-center justify-between h-full px-6">
                
                {/* Left: Toggle & Title */}
                <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full bg-white/40 backdrop-blur-md shadow-sm transition-transform duration-300 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>
                        <ChevronDownIcon className={`w-6 h-6 ${config.textColor}`} />
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white/30 backdrop-blur-md rounded-xl shadow-inner">
                            <Icon className={`w-8 h-8 ${config.textColor} drop-shadow-sm`} />
                        </div>
                        <div className="flex flex-col">
                            <h3 className={`text-2xl sm:text-3xl font-black tracking-tight ${config.textColor} drop-shadow-md mix-blend-hard-light leading-none`}>
                                {period}
                            </h3>
                            {timeRange && (
                                <span className={`text-xs font-bold font-mono mt-1 opacity-80 ${config.textColor} mix-blend-hard-light`}>
                                    {timeRange}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Big Counter */}
                <div className="flex items-baseline gap-1">
                    <span className={`text-5xl font-black ${config.textColor} drop-shadow-md mix-blend-overlay`}>
                        {completedBlocks}
                    </span>
                    <span className={`text-xl font-bold ${config.textColor} opacity-60 mix-blend-overlay`}>
                        /{totalBlocks}
                    </span>
                </div>
            </div>

            {/* Wave Edge (Visual separator if partially filled) */}
            {progressPercent > 0 && progressPercent < 100 && (
                <div 
                    className="absolute top-0 bottom-0 w-2 bg-white/30 blur-sm z-20"
                    style={{ left: `${progressPercent}%`, transform: 'translateX(-50%)' }}
                ></div>
            )}

            <style>{`
                @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                @keyframes pulse-border-${period.replace(/\s+/g, '')} {
                    0% { box-shadow: 0 0 0 0px ${config.shadowColor}; border-color: opacity: 0.8; }
                    50% { box-shadow: 0 0 10px 1px ${config.shadowColor}; border-color: opacity: 1; }
                    100% { box-shadow: 0 0 0 0px ${config.shadowColor}; border-color: opacity: 0.8; }
                }
            `}</style>
        </div>
    );
};

const TimeSeal: React.FC<{ planned: number, actual: number }> = ({ planned, actual }) => {
    const diff = planned - actual; // Positive = Saved, Negative = Overtime
    const absDiff = Math.abs(diff);
    
    if (diff === 0) return null;

    const isSaved = diff > 0;
    let intensity = 1;
    if (absDiff > 10) intensity = 2;
    if (absDiff > 25) intensity = 3;

    const pulseDuration = Math.max(0.8, 2.5 - (intensity * 0.6)) + 's';

    return (
        <div className="relative flex items-center justify-center w-24 h-24 rotate-[-12deg] select-none ml-auto mr-2">
            <svg viewBox="0 0 200 200" className={`absolute inset-0 w-full h-full opacity-20 ${isSaved ? 'text-green-500' : 'text-red-500'} animate-scale-in`}>
                <path fill="currentColor" d="M42.7,-62.9C50.9,-52.8,50.1,-34.4,51.7,-19.2C53.4,-4,57.4,8,54.2,18.7C51,29.4,40.6,38.8,29.6,45.9C18.6,53,7,57.8,-5.9,59.8C-18.8,61.7,-32.9,60.8,-43.7,53.9C-54.5,47,-62,34.1,-66.3,20.1C-70.6,6.1,-71.7,-9,-66.1,-21.9C-60.5,-34.8,-48.1,-45.5,-35.6,-54.1C-23.1,-62.7,-10.4,-69.2,3.3,-74.3C17,-79.4,34.5,-83.1,42.7,-62.9Z" transform="translate(100 100) scale(1.1)" />
            </svg>
            <div className={`absolute inset-2 rounded-full opacity-40 blur-md`} style={{ animation: `pulse-glow-${isSaved ? 'green' : 'red'} ${pulseDuration} infinite alternate`, background: isSaved ? `radial-gradient(circle, rgba(34,197,94,0.8) 0%, rgba(16,185,129,0) 70%)` : `radial-gradient(circle, rgba(239,68,68,0.8) 0%, rgba(236,72,153,0) 70%)` }}></div>
            <div className={`relative z-10 w-full h-full rounded-full border-[3px] border-double flex flex-col items-center justify-center bg-white/10 backdrop-blur-[1px] shadow-sm ${isSaved ? 'border-green-600 text-green-700' : 'border-red-600 text-red-700'}`}>
                <div className={`absolute inset-1 rounded-full border border-dashed opacity-50 ${isSaved ? 'border-green-600' : 'border-red-600'}`}></div>
                <div className="font-black text-2xl leading-none tracking-tighter drop-shadow-sm flex items-center">{isSaved ? '+' : '-'}{absDiff}<span className="text-xs ml-0.5 align-top mt-1">m</span></div>
                <div className="text-[9px] font-bold uppercase tracking-widest opacity-90 mt-0.5">{isSaved ? 'SAVED' : 'OVER'}</div>
            </div>
            <style>{` @keyframes pulse-glow-green { 0% { transform: scale(0.95); opacity: 0.3; filter: hue-rotate(0deg); } 100% { transform: scale(1.15); opacity: 0.7; filter: hue-rotate(30deg); } } @keyframes pulse-glow-red { 0% { transform: scale(0.95); opacity: 0.3; filter: hue-rotate(0deg); } 100% { transform: scale(1.15); opacity: 0.6; filter: hue-rotate(-20deg); } } .animate-scale-in { animation: scaleIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; } @keyframes scaleIn { from { transform: scale(0) rotate(-45deg); opacity: 0; } to { transform: scale(1) rotate(0deg); opacity: 0.2; } } `}</style>
        </div>
    );
};

const InfoCard: React.FC<{ 
    title: string; 
    icon: React.ElementType; 
    children: React.ReactNode; 
    className?: string;
    colorClass?: string; 
}> = ({ title, icon: Icon, children, className = '', colorClass = 'text-indigo-600 bg-indigo-50' }) => (
    <div className={`bg-white dark:bg-slate-800 rounded-3xl border border-white/50 dark:border-slate-700/50 p-6 shadow-lg shadow-slate-200/50 dark:shadow-none card-3d ${className}`}>
        <div className="flex items-center gap-3 mb-5">
            <div className={`p-3 rounded-xl ${colorClass} shadow-sm border border-white/50 dark:border-white/5`}>
                <Icon className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg tracking-tight">{title}</h3>
        </div>
        {children}
    </div>
);

// ... (FullDayPlanLayout remains same) ...
const FullDayPlanLayout: React.FC<{ plan: DayPlan, onEdit: () => void }> = ({ plan, onEdit }) => {
    const totalStudyMinutes = plan.totalStudyMinutesPlanned || 0;
    const totalHours = Math.floor(totalStudyMinutes / 60);
    const remainingMinutes = totalStudyMinutes % 60;
    
    // Execution Stats
    const executedBlocks = plan.blocks?.filter(b => b.status === 'DONE') || [];
    const actualMinutes = executedBlocks.reduce((acc, b) => acc + (b.actualDurationMinutes || 0), 0);
    const actualHours = Math.floor(actualMinutes / 60);
    const actualRemMinutes = actualMinutes % 60;
    
    const completionPercent = totalStudyMinutes > 0 ? Math.min(100, Math.round((actualMinutes / totalStudyMinutes) * 100)) : 0;

    // Timeline Stats
    const lastBlock = executedBlocks.length > 0 ? executedBlocks[executedBlocks.length - 1] : null;
    const actualStartTime = plan.startTimeActual || executedBlocks[0]?.actualStartTime;
    const actualEndTime = lastBlock?.actualEndTime;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Daily Summary</h3>
                    <button onClick={onEdit} className="btn-3d bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                        <PencilSquareIcon className="w-4 h-4" /> Edit Plan
                    </button>
                </div>

                <InfoCard 
                    title="Planned Blocks" 
                    icon={CalendarIcon} 
                    colorClass="text-blue-600 bg-blue-50 dark:bg-blue-900/20"
                >
                    <div className="space-y-2">
                        {plan.blocks && plan.blocks.length > 0 ? plan.blocks.map((b, i) => (
                            <div key={i} className="flex justify-between text-sm py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 items-center">
                                <span className="font-mono text-slate-500 w-24 text-xs font-bold">{formatTime12(b.plannedStartTime)} - {formatTime12(b.plannedEndTime)}</span>
                                <span className="font-bold truncate flex-1 text-slate-700 dark:text-slate-200 flex items-center">
                                    <span className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded-md mr-2 shadow-sm">#{b.index + 1}</span>
                                    {b.title}
                                </span>
                                <span className="text-xs font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">{b.plannedDurationMinutes}m</span>
                            </div>
                        )) : <p className="text-sm text-slate-400 italic">No blocks scheduled.</p>}
                    </div>
                </InfoCard>

                <InfoCard 
                    title="Execution Overview" 
                    icon={FireIcon}
                    colorClass="text-orange-600 bg-orange-50 dark:bg-orange-900/20"
                >
                    <div className="space-y-3">
                        {executedBlocks.length > 0 ? executedBlocks.map((b, i) => (
                            <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between text-sm py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 gap-2">
                                <div className="flex items-center gap-3">
                                    <span className="font-mono font-bold text-slate-600 dark:text-slate-400 w-24 shrink-0 text-xs">
                                        {formatTime12(b.actualStartTime)} - {formatTime12(b.actualEndTime)}
                                    </span>
                                    <div>
                                        <span className="font-bold text-slate-800 dark:text-white block sm:inline">
                                            {b.title}
                                        </span>
                                        {b.rescheduledTo && (
                                            <span className="text-[9px] text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded ml-0 sm:ml-2 font-bold border border-indigo-100 dark:border-indigo-800">
                                                Rescheduled
                                            </span>
                                        )}
                                        {b.status === 'DONE' && !b.rescheduledTo && (
                                            <span className="text-[9px] text-green-600 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded ml-0 sm:ml-2 font-bold border border-green-100 dark:border-green-800">
                                                Done
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span className="text-xs font-mono font-bold text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
                                    {formatDurationString(b.actualDurationMinutes || 0)}
                                </span>
                            </div>
                        )) : (
                            <div className="text-center py-4 text-slate-400 italic text-sm">
                                No blocks completed yet. Start the timer to track execution!
                            </div>
                        )}
                    </div>
                </InfoCard>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
                 <InfoCard 
                    title="Study Performance" 
                    icon={BookOpenIcon} 
                    className="text-center"
                    colorClass="text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"
                >
                    <div className="mb-6">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Total Planned</p>
                        <div className="flex items-baseline justify-center gap-1 bg-slate-50 dark:bg-slate-800/50 py-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                            <span className="text-4xl font-black text-slate-800 dark:text-white drop-shadow-sm">{totalHours}</span><span className="text-sm font-bold text-slate-500">h</span>
                            {remainingMinutes > 0 && <><span className="text-4xl font-black text-slate-800 dark:text-white ml-2 drop-shadow-sm">{remainingMinutes}</span><span className="text-sm font-bold text-slate-500">m</span></>}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-inner-3d">
                        <div className="flex justify-between items-end mb-2">
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Actual Execution</p>
                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{completionPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 mb-2 overflow-hidden shadow-inner">
                            <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full rounded-full transition-all duration-1000 ease-out shadow-md" style={{ width: `${completionPercent}%` }}></div>
                        </div>
                        <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300 mt-2">
                            {actualHours}h {actualRemMinutes}m <span className="text-sm font-normal text-slate-400">done</span>
                        </p>
                    </div>
                </InfoCard>

                 <InfoCard 
                    title="Timeline" 
                    icon={ClockIcon}
                    colorClass="text-violet-600 bg-violet-50 dark:bg-violet-900/20"
                >
                    <div className="space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-700">
                            <span className="text-xs font-bold text-slate-400 uppercase">Start Time</span>
                            <div className="text-right">
                                <div className="text-base font-mono font-bold text-slate-800 dark:text-white">{actualStartTime ? formatTime12(actualStartTime) : '--:--'}</div>
                                <div className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md inline-block mt-1">Planned: {formatTime12(plan.startTimePlanned)}</div>
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400 uppercase">Finish Time</span>
                            <div className="text-right">
                                <div className="text-base font-mono font-bold text-slate-800 dark:text-white">{actualEndTime ? formatTime12(actualEndTime) : 'In Progress'}</div>
                                <div className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md inline-block mt-1">Planned: {formatTime12(plan.estimatedEndTime)}</div>
                            </div>
                        </div>
                    </div>
                </InfoCard>
            </div>
        </div>
    );
};

// Helper component for swipe
const SwipeableBlockWrapper: React.FC<{ 
    children: React.ReactNode, 
    onDelete: () => void, 
    onClick: () => void,
    isSelectMode: boolean,
    isSelected: boolean,
    onSelect: () => void
}> = ({ children, onDelete, onClick, isSelectMode, isSelected, onSelect }) => {
    const touchStartRef = useRef<{ x: number, y: number } | null>(null);
    const [offset, setOffset] = useState(0);

    const enableSwipe = !isSelectMode;

    const handleTouchStart = (e: React.TouchEvent) => {
        if (!enableSwipe) return;
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchStartRef.current || !enableSwipe) return;
        const deltaX = e.touches[0].clientX - touchStartRef.current.x;
        const deltaY = e.touches[0].clientY - touchStartRef.current.y;
        
        if (Math.abs(deltaX) > Math.abs(deltaY) + 5) {
            const newOffset = Math.min(0, Math.max(-100, deltaX));
            setOffset(newOffset);
        }
    };

    const handleTouchEnd = () => {
        if (!enableSwipe) return;
        if (offset < -50) {
            setOffset(-80);
        } else {
            setOffset(0);
        }
        touchStartRef.current = null;
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!enableSwipe) return;
        touchStartRef.current = { x: e.clientX, y: e.clientY };
    };
    
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!touchStartRef.current || e.buttons !== 1 || !enableSwipe) return;
        const deltaX = e.clientX - touchStartRef.current.x;
        if (deltaX < 0) {
             const newOffset = Math.min(0, Math.max(-100, deltaX)); 
             setOffset(newOffset);
        }
    };

    const handleMouseUp = () => {
        if (!enableSwipe) return;
        if (offset < -50) setOffset(-80);
        else setOffset(0);
        touchStartRef.current = null;
    };

    return (
        <div className="relative overflow-visible select-none mb-4">
            <div 
                className="absolute top-0 bottom-4 right-0 w-24 bg-red-500 flex items-center justify-center z-0 cursor-pointer rounded-2xl my-1 shadow-inner"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
                <TrashIcon className="w-6 h-6 text-white" />
            </div>
            <div 
                className="relative z-10 transition-transform duration-200 ease-out active:scale-[0.98]"
                style={{ transform: `translateX(${offset}px)` }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={() => {
                    if (isSelectMode) {
                        onSelect();
                    } else {
                        if (offset === 0) onClick();
                        else setOffset(0);
                    }
                }}
            >
                {isSelectMode && (
                    <div className={`absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center z-20 rounded-l-2xl ${isSelected ? 'bg-indigo-500/10' : 'bg-transparent'}`}>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shadow-sm ${isSelected ? 'bg-indigo-600 border-indigo-600 scale-110' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                            {isSelected && <CheckCircleIcon className="w-4 h-4 text-white" />}
                        </div>
                    </div>
                )}
                <div className={`${isSelectMode ? 'pl-12 pointer-events-none' : ''} transition-all`}>
                    {children}
                </div>
            </div>
        </div>
    );
};

// --- BLOCK RENDERER ---
const BlockCard: React.FC<{ block: Block, isCurrent: boolean, isNext: boolean, onStart: () => void, onPause: () => void, onFinish: () => void }> = ({ block, isCurrent, isNext, onStart, onPause, onFinish }) => {
    const isDone = block.status === 'DONE';
    const isBreak = block.type === 'BREAK';
    const isVirtual = block.isVirtual; 
    
    const [countdown, setCountdown] = useState<string>('--:--');
    const [progress, setProgress] = useState(0);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        if (isCurrent && block.status === 'IN_PROGRESS') {
            const updateTimer = () => {
                // 1. Calculate total duration from completed segments.
                let completedDurationMs = 0;
                if (block.segments) {
                    for (const segment of block.segments) {
                        if (segment.end) {
                            // Using block.date ensures we are on the correct day for parsing time
                            const segStart = new Date(`${block.date}T${segment.start}`);
                            const segEnd = new Date(`${block.date}T${segment.end}`);
                            if (segEnd < segStart) segEnd.setDate(segEnd.getDate() + 1); // Handle midnight crossing
                            completedDurationMs += segEnd.getTime() - segStart.getTime();
                        }
                    }
                }

                // 2. Calculate duration of the current active segment.
                let activeDurationMs = 0;
                const now = new Date();
                if (block.segments && block.segments.length > 0) {
                    const lastSegment = block.segments[block.segments.length - 1];
                    if (!lastSegment.end) { // It's active if it has no end time
                        const segStart = new Date(`${block.date}T${lastSegment.start}`);
                        activeDurationMs = now.getTime() - segStart.getTime();
                    }
                }

                const elapsedMs = completedDurationMs + activeDurationMs;

                const totalDurationMs = block.plannedDurationMinutes * 60 * 1000;
                const remainingMs = totalDurationMs - elapsedMs;
                
                const calculatedProgress = Math.min(100, (elapsedMs / totalDurationMs) * 100);
                setProgress(calculatedProgress);

                if (remainingMs <= 0) {
                    const m = Math.floor(Math.abs(remainingMs) / 60000);
                    const s = Math.floor((Math.abs(remainingMs) % 60000) / 1000);
                    setCountdown(`-${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
                } else {
                    const m = Math.floor(remainingMs / 60000);
                    const s = Math.floor((remainingMs % 60000) / 1000);
                    setCountdown(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
                }
            };
            
            timerRef.current = window.setInterval(updateTimer, 1000);
            updateTimer(); 
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            // Don't reset progress if just paused, only if not in progress AND not paused.
            if (block.status !== 'PAUSED') {
                setProgress(0);
            }
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isCurrent, block.status, block.segments, block.plannedDurationMinutes, block.date]);

    let cardStyle = 'bg-white dark:bg-slate-800 border-white/60 dark:border-slate-700';
    let shadowClass = 'card-3d';
    let accentColor = 'bg-slate-200 dark:bg-slate-700';

    if (isVirtual) {
        cardStyle = 'bg-amber-50 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-800';
        accentColor = 'bg-amber-400';
    } else if (block.rescheduledTo || block.completionStatus === 'NOT_DONE') {
        cardStyle = 'bg-red-50 dark:bg-red-900/10 border-red-200/50 dark:border-red-800';
        accentColor = 'bg-red-400';
    } else if (isDone) {
        cardStyle = 'bg-green-50 dark:bg-green-900/10 border-green-200/50 dark:border-green-800';
        accentColor = 'bg-green-500';
        shadowClass = 'card-3d'; 
    } else if (isCurrent) {
        cardStyle = 'bg-white dark:bg-slate-800 border-emerald-400 dark:border-emerald-600 z-20 relative overflow-hidden';
        shadowClass = 'shadow-[0_0_40px_-5px_rgba(16,185,129,0.5)] dark:shadow-[0_0_40px_-10px_rgba(16,185,129,0.4)] scale-[1.02]';
        accentColor = 'bg-emerald-500';
    } else if (isBreak) {
        cardStyle = 'bg-teal-50 dark:bg-teal-900/20 border-dashed border-teal-200 dark:border-teal-800';
        shadowClass = 'shadow-sm';
        accentColor = 'bg-teal-400';
    }

    const renderCardContent = () => {
        if (isDone) {
            const actualDuration = block.actualDurationMinutes || 0;
            const plannedDuration = block.plannedDurationMinutes || 0;
            
            return (
                <div className={`rounded-2xl border ${cardStyle} ${shadowClass} overflow-hidden flex flex-col md:flex-row w-full transition-all duration-300`}>
                    <div className="flex-1 p-4 border-b md:border-b-0 md:border-r border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50">
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">Original Plan</div>
                        <div className="font-mono font-bold text-sm text-slate-600 dark:text-slate-300 mb-1">{isVirtual ? formatTime12(block.plannedStartTime) : `${formatTime12(block.plannedStartTime)} - ${formatTime12(block.plannedEndTime)}`}</div>
                        <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-3">{block.title}</h4>
                        
                        <div className="space-y-1">
                            {block.tasks && block.tasks.length > 0 ? block.tasks.map((t, i) => (
                                <div key={i} className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                                    {t.detail}
                                </div>
                            )) : <span className="text-xs text-slate-400 italic">{block.description || "No specific subtasks."}</span>}
                        </div>
                    </div>

                    <div className="flex-1 p-4 bg-green-50/20 dark:bg-green-900/5 relative">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <div className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase mb-1 flex items-center gap-1 tracking-wider">
                                    <CheckCircleIcon className="w-3 h-3" /> Execution
                                </div>
                                <div className="font-mono font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                                    <span>{formatTime12(block.actualStartTime)} - {formatTime12(block.actualEndTime)}</span>
                                    {block.actualDurationMinutes && (
                                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                            ({formatDurationString(block.actualDurationMinutes)})
                                        </span>
                                    )}
                                </div>
                            </div>
                            {!block.rescheduledTo && block.completionStatus !== 'NOT_DONE' && (
                                <TimeSeal planned={plannedDuration} actual={actualDuration} />
                            )}
                        </div>

                        {block.rescheduledTo && (
                            <div className="mb-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-red-700 dark:text-red-300 font-bold shadow-sm">
                                <ArrowRightIcon className="w-3.5 h-3.5" />
                                <span>Rescheduled to {block.rescheduledTo.includes(':') ? formatTime12(block.rescheduledTo) : block.rescheduledTo}</span>
                            </div>
                        )}

                        <div className="space-y-2">
                            {block.tasks && block.tasks.length > 0 ? block.tasks.map((t, i) => (
                                <div key={i} className={`p-2 rounded-lg border flex items-center justify-between shadow-sm ${t.execution?.completed ? 'bg-white border-green-100 dark:border-green-900/30 dark:bg-slate-800' : 'bg-red-50 border-red-100 dark:border-red-900/30 dark:bg-slate-800'}`}>
                                    <div className="flex items-center gap-2 mb-1 min-w-0 flex-1">
                                        {t.execution?.completed ? <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" /> : <XMarkIcon className="w-4 h-4 text-red-500 flex-shrink-0" />}
                                        <span className={`text-xs font-bold truncate ${t.execution?.completed ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>{t.detail}</span>
                                    </div>
                                    {t.execution?.note && (
                                        <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded max-w-[40%] truncate text-right ml-2 shrink-0" title={t.execution.note}>
                                            {t.execution.note}
                                        </span>
                                    )}
                                </div>
                            )) : (
                                block.actualNotes && (
                                    <p className="text-xs text-slate-500 italic border-l-2 border-slate-200 pl-2">
                                        "{block.actualNotes}"
                                    </p>
                                )
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className={`rounded-3xl p-5 border flex flex-col gap-4 w-full transition-all duration-300 relative ${cardStyle} ${shadowClass}`}>
                
                {isCurrent && (
                    <div className="absolute inset-0 z-0 rounded-3xl overflow-hidden pointer-events-none">
                        <div 
                            style={{ width: `${progress}%` }}
                            className="h-full relative transition-all duration-1000 ease-linear"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-emerald-500/20 to-emerald-500/30"></div>
                            <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-emerald-400/40 to-transparent blur-sm"></div>
                            <div 
                                className="absolute inset-0 opacity-20 bg-gradient-to-r from-transparent via-white to-transparent"
                                style={{ 
                                    backgroundSize: '200% 100%',
                                    animation: 'shimmer 3s infinite linear'
                                }}
                            ></div>
                        </div>
                        <style>{`
                            @keyframes shimmer {
                                0% { background-position: 200% 0; }
                                100% { background-position: -200% 0; }
                            }
                        `}</style>
                    </div>
                )}

                <div className="relative z-10">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`font-mono font-bold text-sm ${isCurrent ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500'}`}>
                                    {isVirtual ? formatTime12(block.plannedStartTime) : `${formatTime12(block.plannedStartTime)} - ${formatTime12(block.plannedEndTime)}`}
                                </span>
                                {isBreak && <span className="text-[10px] font-bold bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 px-2 py-0.5 rounded shadow-sm border border-teal-200 dark:border-teal-800">BREAK</span>}
                                {isVirtual && <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shadow-sm">DUE</span>}
                            </div>
                            <h4 className="font-extrabold text-xl text-slate-800 dark:text-white tracking-tight drop-shadow-sm">{block.title}</h4>
                            {(isVirtual || isBreak) && block.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium bg-white/50 dark:bg-black/10 inline-block px-2 py-1 rounded">{block.description}</p>}
                        </div>
                        
                        <div className="flex items-center gap-2">
                            {isCurrent ? (
                                <>
                                    <div className="px-4 py-1.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl text-emerald-700 dark:text-emerald-300 font-mono font-black text-xl mr-2 animate-pulse shadow-inner border border-emerald-200 dark:border-emerald-800">
                                        {countdown}
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onFinish(); }} 
                                        className="btn-3d bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-50 px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1 shadow-sm"
                                    >
                                        <StopIcon className="w-4 h-4" /> Finish
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onPause(); }} 
                                        className="btn-3d p-2.5 bg-amber-100 text-amber-600 rounded-xl hover:bg-amber-200 transition-colors"
                                    >
                                        <PauseIcon className="w-5 h-5" />
                                    </button>
                                </>
                            ) : block.status === 'PAUSED' ? (
                                <button onClick={(e) => { e.stopPropagation(); onStart(); }} className="btn-3d px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-200 transition-colors flex items-center gap-1">
                                    <PlayIcon className="w-4 h-4" /> Resume
                                </button>
                            ) : (
                                !isBreak && (
                                    <button onClick={(e) => { e.stopPropagation(); onStart(); }} className={`btn-3d p-3 rounded-xl transition-all ${isNext ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-indigo-500'} ${isVirtual ? 'bg-amber-500 text-white hover:bg-amber-600' : ''}`}>
                                        <PlayIcon className="w-6 h-6" />
                                    </button>
                                )
                            )}
                            
                            {isBreak && !isCurrent && block.status !== 'DONE' && (
                                <button onClick={(e) => { e.stopPropagation(); onStart(); }} className={`btn-3d p-3 rounded-xl transition-all bg-teal-500 text-white hover:bg-teal-600`}>
                                    <PlayIcon className="w-6 h-6" />
                                </button>
                            )}
                        </div>
                    </div>

                    {block.tasks && block.tasks.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {block.tasks.map((task, i) => {
                                const metaTextParts: string[] = [];
                                if (task.meta) {
                                    if (task.meta.playbackSpeed && task.meta.playbackSpeed !== 1) {
                                        metaTextParts.push(`${task.meta.playbackSpeed}x`);
                                    }
                                    if (task.meta.videoStartTime !== undefined && task.meta.videoEndTime !== undefined) {
                                        metaTextParts.push(`${task.meta.videoStartTime}–${task.meta.videoEndTime}m`);
                                    }
                                }
                                const metaText = metaTextParts.join(', ');

                                const taskColorClasses = {
                                    FA: 'bg-indigo-50/80 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300',
                                    VIDEO: 'bg-blue-50/80 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-300',
                                    ANKI: 'bg-amber-50/80 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800 text-amber-700 dark:text-amber-300',
                                    QBANK: 'bg-emerald-50/80 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
                                    OTHER: 'bg-slate-50/80 dark:bg-slate-800/10 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300',
                                }[task.type] || 'bg-slate-50/80 dark:bg-slate-800/10 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300';
                                
                                return (
                                    <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold shadow-sm backdrop-blur-sm ${taskColorClasses}`}>
                                        {task.type === 'FA' && <BookOpenIcon className="w-3 h-3" />}
                                        {task.type === 'VIDEO' && <VideoIcon className="w-3 h-3" />}
                                        {task.type === 'ANKI' && <FireIcon className="w-3 h-3" />}
                                        {task.type === 'QBANK' && <CheckCircleIcon className="w-3 h-3" />}
                                        <span>{task.detail}</span>
                                        {metaText && (
                                            <span className="ml-1.5 opacity-80 font-medium">
                                                ({metaText})
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    
                    {isCurrent && (
                        <div className="mt-3 pt-3 border-t border-emerald-200/50 dark:border-emerald-800/50 flex justify-between items-center">
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-pulse">
                                <ClockIcon className="w-3 h-3" /> Focus Mode Active
                            </span>
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-black/20 px-2 py-1 rounded-lg backdrop-blur-md">started {formatTime12(block.actualStartTime)}</span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className={`flex gap-4 relative group ${isBreak ? 'opacity-95 scale-[0.98] origin-left' : ''} ${isVirtual ? 'hover:scale-[1.01]' : ''}`}>
            <div className="w-12 flex-shrink-0 relative flex flex-col items-center justify-center">
                <div className={`absolute top-0 bottom-0 w-1 rounded-full ${accentColor} opacity-30`}></div>
                {!isVirtual && block.index >= 0 && !isBreak && (
                    <div className={`relative z-10 border-2 text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full shadow-md transition-all ${isCurrent ? 'bg-emerald-500 border-emerald-400 text-white scale-110 ring-2 ring-emerald-200' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                        {block.index + 1}
                    </div>
                )}
                {isBreak && (
                    <div className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/50 border-2 border-teal-200 dark:border-teal-700 text-teal-600 dark:text-teal-400 shadow-sm">
                        <CoffeeIcon className="w-4 h-4" />
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0 pb-4">
                {renderCardContent()}
            </div>
        </div>
    );
};

// FIX: Define the missing BlocksLayout component.
// --- BLOCKS LAYOUT (Timeline View) ---
interface BlocksLayoutProps {
    blocks: Block[];
    onStartBlock: (blockId: string, block: Block) => void;
    onPauseBlock: (blockId: string) => void;
    onFinishBlock: (block: Block) => void;
    onDeleteBlock: (block: Block) => void;
    onSelectBlock: (block: Block) => void;
    isSelectMode: boolean;
    selectedBlockIds: Set<string>;
    onToggleSelection: (blockId: string) => void;
}

const BlocksLayout: React.FC<BlocksLayoutProps> = ({ blocks, onStartBlock, onPauseBlock, onFinishBlock, onDeleteBlock, onSelectBlock, isSelectMode, selectedBlockIds, onToggleSelection }) => {
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

    const getPeriod = (timeStr: string): string => {
        const hour = parseInt(timeStr.split(':')[0]);
        if (hour < 5) return 'Midnight';
        if (hour < 8) return 'Early Morning';
        if (hour < 13) return 'Morning';
        if (hour < 18) return 'Afternoon';
        if (hour < 20) return 'Evening';
        return 'Night';
    };

    const groupedBlocks = blocks.reduce((acc, block) => {
        const period = getPeriod(block.plannedStartTime);
        if (!acc[period]) {
            acc[period] = [];
        }
        acc[period].push(block);
        return acc;
    }, {} as Record<string, Block[]>);

    const currentBlock = blocks.find(b => b.status === 'IN_PROGRESS');
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    let nextBlockId: string | null = null;
    if (!currentBlock) {
        const upcomingBlocks = blocks
            .filter(b => b.status === 'NOT_STARTED' && b.type !== 'BREAK')
            .sort((a,b) => parseTimeToMinutes(a.plannedStartTime) - parseTimeToMinutes(b.plannedStartTime));
        
        const next = upcomingBlocks.find(b => parseTimeToMinutes(b.plannedStartTime) >= nowMinutes);
        if (next) {
            nextBlockId = next.id;
        }
    }

    const PERIODS_ORDER = ['Midnight', 'Early Morning', 'Morning', 'Afternoon', 'Evening', 'Night'];
    
    const PERIOD_TIME_RANGES: Record<string, string> = {
        'Midnight': '12am - 5am',
        'Early Morning': '5am - 8am',
        'Morning': '8am - 1pm',
        'Afternoon': '1pm - 6pm',
        'Evening': '6pm - 8pm',
        'Night': '8pm - 12am',
    };

    const toggleCollapse = (period: string) => {
        setCollapsedSections(prev => ({ ...prev, [period]: !prev[period] }));
    };
    
    return (
        <div className="space-y-4">
            {PERIODS_ORDER.map(period => {
                const periodBlocks = groupedBlocks[period];
                if (!periodBlocks || periodBlocks.length === 0) return null;

                const completedCount = periodBlocks.filter(b => b.status === 'DONE').length;
                const isCollapsed = collapsedSections[period] || false;

                return (
                    <div key={period}>
                        <TimelineSectionHeader
                            period={period}
                            totalBlocks={periodBlocks.length}
                            completedBlocks={completedCount}
                            isCollapsed={isCollapsed}
                            onToggle={() => toggleCollapse(period)}
                            timeRange={PERIOD_TIME_RANGES[period]}
                        />
                        {!isCollapsed && (
                            <div className="pl-4 border-l-2 border-slate-200 dark:border-slate-700 ml-6 space-y-4 animate-fade-in-up">
                                {periodBlocks.map(block => (
                                    <SwipeableBlockWrapper
                                        key={block.id}
                                        onDelete={() => onDeleteBlock(block)}
                                        onClick={() => onSelectBlock(block)}
                                        isSelectMode={isSelectMode}
                                        isSelected={selectedBlockIds.has(block.id)}
                                        onSelect={() => onToggleSelection(block.id)}
                                    >
                                        <BlockCard
                                            block={block}
                                            isCurrent={currentBlock?.id === block.id}
                                            isNext={!currentBlock && nextBlockId === block.id}
                                            onStart={() => onStartBlock(block.id, block)}
                                            onPause={() => onPauseBlock(block.id)}
                                            onFinish={() => onFinishBlock(block)}
                                        />
                                    </SwipeableBlockWrapper>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

interface TodaysPlanViewProps {
    targetDate?: string;
    settings: AppSettings;
    onUpdateSettings: (settings: AppSettings) => void;
    knowledgeBase: KnowledgeBaseEntry[];
    onUpdateKnowledgeBase?: (newKB: KnowledgeBaseEntry[]) => Promise<void>;
}

export const TodaysPlanView: React.FC<TodaysPlanViewProps> = ({ targetDate, settings, onUpdateSettings, knowledgeBase = [], onUpdateKnowledgeBase }) => {
    const [viewMode, setViewMode] = useState<'full' | 'blocks'>('blocks');
    const [currentDate, setCurrentDate] = useState(targetDate || getAdjustedDate(new Date()));
    const [plan, setPlan] = useState<DayPlan | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Undo/Redo State
    const [historyPast, setHistoryPast] = useState<DayPlan[]>([]);
    const [historyFuture, setHistoryFuture] = useState<DayPlan[]>([]);

    // Select & Delete State
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set());
    const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);

    // Block Logic State
    const [finishingBlock, setFinishingBlock] = useState<Block | null>(null);
    const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [isAddBlockModalOpen, setIsAddBlockModalOpen] = useState(false);
    const [isAddBreakModalOpen, setIsAddBreakModalOpen] = useState(false);
    const [addBlockStartTime, setAddBlockStartTime] = useState('08:00');
    
    const [defaultDuration, setDefaultDuration] = useState(30);

    // Block Detail & Edit
    const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [blockToDelete, setBlockToDelete] = useState<Block | null>(null);

    useEffect(() => {
        setCurrentDate(targetDate || getAdjustedDate(new Date()));
    }, [targetDate]);

    useEffect(() => {
        loadPlan();
    }, [currentDate]);

    const loadPlan = async () => {
        setLoading(true);
        try {
            const data = await getDayPlan(currentDate);
            setPlan(data);
            setHistoryPast([]);
            setHistoryFuture([]);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const handlePlanChange = async (newPlan: DayPlan | null, addToHistory = true) => {
        if (!newPlan) return;

        if (addToHistory && plan) {
            setHistoryPast(prev => [...prev, plan]);
            setHistoryFuture([]); // Clear future on new action
        }
        
        setPlan(newPlan);
        await saveDayPlan(newPlan);
    };

    const handleUndo = async () => {
        if (historyPast.length === 0 || !plan) return;
        const previousState = historyPast[historyPast.length - 1];
        const newPast = historyPast.slice(0, -1);
        setHistoryFuture(prev => [plan, ...prev]);
        setPlan(previousState);
        setHistoryPast(newPast);
        await saveDayPlan(previousState);
    };

    const handleRedo = async () => {
        if (historyFuture.length === 0 || !plan) return;
        const nextState = historyFuture[0];
        const newFuture = historyFuture.slice(1);
        setHistoryPast(prev => [...prev, plan]);
        setPlan(nextState);
        setHistoryFuture(newFuture);
        await saveDayPlan(nextState);
    };

    const toggleSelectMode = () => {
        setIsSelectMode(!isSelectMode);
        setSelectedBlockIds(new Set());
    };

    const handleToggleBlockSelection = (blockId: string) => {
        const newSet = new Set(selectedBlockIds);
        if (newSet.has(blockId)) {
            newSet.delete(blockId);
        } else {
            newSet.add(blockId);
        }
        setSelectedBlockIds(newSet);
    };

    const deleteBlocksAndSync = async (blocksToDelete: Block[]) => {
        const timeLogIds = blocksToDelete.flatMap(b => b.generatedTimeLogIds || []);
        const kbLogIds = blocksToDelete.flatMap(b => b.generatedLogIds || []);
        if (timeLogIds.length > 0) {
            await Promise.all(timeLogIds.map(id => deleteTimeLog(id)));
        }
        if (kbLogIds.length > 0 && onUpdateKnowledgeBase) {
            const updatedKB = knowledgeBase.map(entry => {
                const logsToDeleteForEntry = entry.logs.filter(l => kbLogIds.includes(l.id));
                if (logsToDeleteForEntry.length > 0) {
                    const newLogs = entry.logs.filter(l => !kbLogIds.includes(l.id));
                    const revCount = newLogs.filter(l => l.type === 'REVISION').length;
                    const sortedLogs = [...newLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                    const latestLog = sortedLogs.length > 0 ? sortedLogs[0] : null;
                    return { ...entry, logs: newLogs, revisionCount: revCount, lastStudiedAt: latestLog ? latestLog.timestamp : null };
                }
                return entry;
            });
            await onUpdateKnowledgeBase(updatedKB);
            await saveKnowledgeBase(updatedKB);
        }
    };

    const handleDeleteSelected = async () => {
        if (!plan || selectedBlockIds.size === 0) return;
        if (!confirm(`Permanently delete ${selectedBlockIds.size} blocks and their synced logs?`)) return;
        const blocksToDelete = (plan.blocks || []).filter(b => selectedBlockIds.has(b.id));
        await deleteBlocksAndSync(blocksToDelete);
        const updatedBlocks = (plan.blocks || []).filter(b => !selectedBlockIds.has(b.id));
        const updatedPlan = { ...plan, blocks: updatedBlocks };
        await handlePlanChange(updatedPlan);
        setIsSelectMode(false);
        setSelectedBlockIds(new Set());
    };

    const handleDeletePage = async () => {
        if (!plan) return;
        if (plan.blocks) {
            await deleteBlocksAndSync(plan.blocks);
        }
        const updatedPlan = { ...plan, blocks: [], totalStudyMinutesPlanned: 0, totalBreakMinutes: 0 };
        await handlePlanChange(updatedPlan);
        setIsDeleteAllModalOpen(false);
    };

    const handleDateChange = (offset: number) => {
        const d = new Date(currentDate + 'T12:00:00');
        d.setDate(d.getDate() + offset);
        setCurrentDate(getAdjustedDate(d));
    };

    const mergedBlocks = useMemo(() => {
        let actualBlocks = plan?.blocks || [];
        const dueRevisions = knowledgeBase.filter(kb => {
            if (!kb.nextRevisionAt) return false;
            const dueStr = getAdjustedDate(new Date(kb.nextRevisionAt));
            return dueStr === currentDate;
        });
        const virtualBlocks: Block[] = dueRevisions.map(kb => {
            const dueTime = new Date(kb.nextRevisionAt!);
            const timeStr = formatTime24(dueTime);
            const isAlreadyDone = actualBlocks.some(b => 
                b.status === 'DONE' && 
                b.tasks?.some(t => t.type === 'FA' && (t.detail.includes(kb.pageNumber) || t.meta?.pageNumber === parseInt(kb.pageNumber)))
            );
            if (isAlreadyDone) return null;
            return {
                id: `rev-${kb.pageNumber}`, index: -1, date: currentDate,
                plannedStartTime: timeStr, plannedEndTime: timeStr, type: 'REVISION_FA',
                title: `Revise: ${kb.title}`, description: `Revision Page: ${kb.pageNumber}`,
                plannedDurationMinutes: 15, status: 'NOT_STARTED', isVirtual: true,
                tasks: [{ id: `vt-${kb.pageNumber}`, type: 'FA', detail: `Page ${kb.pageNumber}`, completed: false, meta: { pageNumber: parseInt(kb.pageNumber), topic: kb.title } }]
            };
        }).filter(Boolean) as Block[];
        const all = [...actualBlocks, ...virtualBlocks];
        return all.sort((a, b) => parseTimeToMinutes(a.plannedStartTime) - parseTimeToMinutes(b.plannedStartTime));
    }, [plan, knowledgeBase, currentDate]);

    const handleStartBlock = async (blockId: string, blockObj: Block) => {
        try {
            if (blockObj.isVirtual) {
                const updatedPlan = await startVirtualBlock(currentDate, blockObj);
                if (updatedPlan) handlePlanChange(updatedPlan);
            } else {
                const updatedPlan = await startBlock(currentDate, blockId);
                if (updatedPlan) handlePlanChange(updatedPlan);
            }
        } catch (e) { console.error(e); }
    };
    
    const handlePauseBlock = async (blockId: string) => {
        try {
            const updatedPlan = await updateBlockInPlan(currentDate, blockId, { status: 'PAUSED' });
            if (updatedPlan) handlePlanChange(updatedPlan);
        } catch (e) { console.error(e); }
    };

    const initiateFinish = (block: Block) => {
        setFinishingBlock(block);
        setIsCompletionModalOpen(true);
    };

    const handleFinishConfirm = async (status: any, tasks: any, rescheduleAction: any) => {
        if (!finishingBlock) return;
        
        const finishDate = new Date();
        const finishTimeStr = finishDate.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit', second: '2-digit'});
    
        try {
            if (rescheduleAction) {
                if (rescheduleAction.type === 'NEW_BLOCK' && rescheduleAction.time) {
                    const newTitle = `${finishingBlock.title} (Rescheduled)`;
                    await insertBlockAndShift(currentDate, rescheduleAction.time, rescheduleAction.duration || 30, rescheduleAction.tasks, newTitle);
                } else if (rescheduleAction.type === 'NEXT_BLOCK') {
                    await moveTasksToNextBlock(currentDate, finishingBlock.id, rescheduleAction.tasks);
                } else if (rescheduleAction.type === 'FUTURE_DATE' && rescheduleAction.date) {
                    await moveTasksToFuturePlan(currentDate, rescheduleAction.date, rescheduleAction.tasks);
                }
            }
    
            let generatedKbLogIds: string[] = [];
            let generatedTimeLogIds: string[] = [];
    
            if ((status === 'COMPLETED' || status === 'PARTIAL') && onUpdateKnowledgeBase) {
                const completedFATasks = tasks.filter((t: any) => t.type === 'FA' && t.execution?.completed);
                if (completedFATasks.length > 0) {
                    const revSettings = await getRevisionSettings() || { mode: 'balanced', targetCount: 7 };
                    const entriesToLog = completedFATasks.map((t: any) => {
                        const pageMatch = t.detail.match(/\d+/);
                        const pageNum = pageMatch ? parseInt(pageMatch[0]) : (t.meta?.pageNumber || 0);
                        return {
                            pageNumber: pageNum,
                            isExplicitRevision: finishingBlock.title.toLowerCase().includes('revis') || t.detail.toLowerCase().includes('revis'),
                            topics: t.meta?.topic ? [t.meta.topic] : [],
                            date: currentDate
                        };
                    }).filter((e: any) => e.pageNumber > 0);
    
                    if (entriesToLog.length > 0) {
                        const { results, updatedKB } = processLogEntries(entriesToLog, knowledgeBase, revSettings);
                        await onUpdateKnowledgeBase(updatedKB);
                        results.forEach(res => {
                            const newLog = res.updatedEntry.logs[res.updatedEntry.logs.length - 1];
                            if (newLog) generatedKbLogIds.push(newLog.id);
                        });
    
                        const startOfBlock = new Date(`${currentDate}T${finishingBlock.actualStartTime || '00:00:00'}`);
                        const totalDurationMinutes = Math.round((finishDate.getTime() - startOfBlock.getTime()) / 60000);
                        const durationPerTask = Math.max(1, Math.round(totalDurationMinutes / entriesToLog.length));
                        let taskStartTime = new Date(startOfBlock.getTime());
    
                        for (const res of results) {
                            const start = taskStartTime;
                            const end = new Date(start.getTime() + durationPerTask * 60000);
                            const newTimeLogId = generateId();
                            const newKbLog = results.find(r => r.pageNumber === res.pageNumber)?.updatedEntry.logs.slice(-1)[0];
    
                            const timeLog: TimeLogEntry = {
                                id: newTimeLogId,
                                date: currentDate,
                                startTime: start.toISOString(),
                                endTime: end.toISOString(),
                                durationMinutes: durationPerTask,
                                category: res.eventType === 'REVISION' ? 'REVISION' : 'STUDY',
                                source: 'FA_LOGGER',
                                activity: `Block: ${finishingBlock.title} - FA Pg ${res.pageNumber}`,
                                pageNumber: String(res.pageNumber),
                                linkedEntityId: newKbLog ? newKbLog.id : undefined
                            };
                            await saveTimeLog(timeLog);
                            generatedTimeLogIds.push(newTimeLogId);
                            taskStartTime = end;
                        }
                    }
                }
            }
    
            const notesFromTasks = tasks.map((t: BlockTask) => t.execution?.note).filter(Boolean).join('\n');
            
            const updatedPlan = await finishBlock(currentDate, finishingBlock.id, { 
                status, 
                tasks,
                rescheduledTo: rescheduleAction?.type === 'NEW_BLOCK' ? rescheduleAction.time : (rescheduleAction?.type === 'FUTURE_DATE' ? rescheduleAction.date : undefined),
                // FIX: Pass the correct variable `generatedKbLogIds` to the `generatedLogIds` parameter.
                generatedLogIds: generatedKbLogIds,
                generatedTimeLogIds,
                pagesCovered: [],
                carryForwardPages: [],
                notes: notesFromTasks,
            }, finishTimeStr);
    
            if (updatedPlan) handlePlanChange(updatedPlan);
    
        } catch (e) { console.error(e); } finally { setIsCompletionModalOpen(false); setFinishingBlock(null); }
    };

    const handleOpenAddBlock = () => {
        const lastBlock = plan?.blocks && plan.blocks.length > 0 ? plan.blocks[plan.blocks.length - 1] : null;
        let startTime = '08:00';
        if (lastBlock) startTime = lastBlock.plannedEndTime;
        setAddBlockStartTime(startTime);
        setIsAddBlockModalOpen(true);
    };

    const handleOpenAddBreak = () => {
        const lastBlock = plan?.blocks && plan.blocks.length > 0 ? plan.blocks[plan.blocks.length - 1] : null;
        let startTime = '12:00';
        if (lastBlock) startTime = lastBlock.plannedEndTime;
        setAddBlockStartTime(startTime); // reuse state for break
        setIsAddBreakModalOpen(true);
    };

    const handleSaveNewBlock = async (title: string, startTime: string, endTime: string, tasks: BlockTask[]) => {
        const [sH, sM] = startTime.split(':').map(Number);
        const [eH, eM] = endTime.split(':').map(Number);
        let duration = (eH * 60 + eM) - (sH * 60 + sM);
        if (duration < 0) duration += 24 * 60;
        const updatedPlan = await insertBlockAndShift(currentDate, startTime, duration, tasks, title);
        if (updatedPlan) handlePlanChange(updatedPlan);
    };

    const handleSaveBreak = async (title: string, startTime: string, endTime: string, notes: string) => {
        const [sH, sM] = startTime.split(':').map(Number);
        const [eH, eM] = endTime.split(':').map(Number);
        let duration = (eH * 60 + eM) - (sH * 60 + sM);
        if (duration < 0) duration += 24 * 60;
        
        // Insert break and shift
        const updatedPlan = await insertBlockAndShift(currentDate, startTime, duration, [], title, 'BREAK', notes);
        if (updatedPlan) handlePlanChange(updatedPlan);
    };

    const handleSaveManualPlan = async (newPlan: DayPlan) => {
        handlePlanChange(newPlan);
    };

    const handleOpenBlockDetail = (block: Block) => {
        if (isSelectMode) {
            handleToggleBlockSelection(block.id);
        } else {
            setSelectedBlock(block);
            setIsDetailModalOpen(true);
        }
    };

    const handleUpdateBlock = async (updatedBlock: Block) => {
        if (updatedBlock.isVirtual) return;
        try {
            await updateBlockInPlan(currentDate, updatedBlock.id, updatedBlock);
            const updated = await getDayPlan(currentDate);
            if (updated) handlePlanChange(updated);
        } catch (e) { console.error(e); }
    };

    const handleRescheduleFromModal = async (action: { type: 'NEW_BLOCK' | 'NEXT_BLOCK', time?: string, duration?: number, tasks: BlockTask[] }) => {
        if (!selectedBlock || selectedBlock.isVirtual) return;
        try {
            if (action.type === 'NEW_BLOCK' && action.time) {
                const newTitle = `${selectedBlock.title} (Rescheduled)`;
                await insertBlockAndShift(currentDate, action.time, action.duration || 30, action.tasks, newTitle);
            } else if (action.type === 'NEXT_BLOCK') {
                await moveTasksToNextBlock(currentDate, selectedBlock.id, action.tasks);
            }
            const updated = await getDayPlan(currentDate);
            if (updated) handlePlanChange(updated);
        } catch (e) { console.error(e); }
    };

    const confirmDeleteBlock = async () => {
        if (blockToDelete) {
            if (blockToDelete.isVirtual) {
                setBlockToDelete(null);
                return;
            }
            await deleteBlocksAndSync([blockToDelete]);
            const updatedPlan = await deleteBlock(currentDate, blockToDelete.id);
            if (updatedPlan) handlePlanChange(updatedPlan);
            setBlockToDelete(null);
        }
    };

    const formattedDate = new Date(currentDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    return (
        <div className="animate-fade-in max-w-4xl mx-auto pb-20 space-y-6">
            {finishingBlock && (
                <TaskCompletionModal 
                    isOpen={isCompletionModalOpen}
                    block={finishingBlock}
                    onClose={() => setIsCompletionModalOpen(false)}
                    onSave={handleFinishConfirm}
                    defaultDuration={defaultDuration}
                />
            )}
            
            <ManualPlanModal 
                isOpen={isManualModalOpen} 
                onClose={() => setIsManualModalOpen(false)} 
                onSave={handleSaveManualPlan}
                initialDate={currentDate}
                existingPlan={plan}
            />

            <AddBlockModal 
                isOpen={isAddBlockModalOpen}
                onClose={() => setIsAddBlockModalOpen(false)}
                onSave={handleSaveNewBlock}
                initialStartTime={addBlockStartTime}
                knowledgeBase={knowledgeBase}
            />

            <AddBreakModal
                isOpen={isAddBreakModalOpen}
                onClose={() => setIsAddBreakModalOpen(false)}
                onSave={handleSaveBreak}
                initialStartTime={addBlockStartTime}
            />

            <BlockDetailModal 
                isOpen={isDetailModalOpen}
                block={selectedBlock}
                onClose={() => { setIsDetailModalOpen(false); setSelectedBlock(null); }}
                onUpdate={handleUpdateBlock}
                onReschedule={handleRescheduleFromModal}
            />

            <DeleteConfirmationModal 
                isOpen={!!blockToDelete}
                onClose={() => setBlockToDelete(null)}
                onConfirm={confirmDeleteBlock}
                title="Delete Block?"
                message={`Are you sure you want to delete "${blockToDelete?.title}"? This will also remove synced logs.`}
            />

            <DeleteConfirmationModal 
                isOpen={isDeleteAllModalOpen}
                onClose={() => setIsDeleteAllModalOpen(false)}
                onConfirm={handleDeletePage}
                title="Delete Today's Plan?"
                message="Are you sure you want to clear all blocks for today? This will permanently remove all associated study logs from Dashboard and History."
            />

            <div className="flex justify-between items-center relative bg-white/60 dark:bg-slate-800/60 backdrop-blur-md p-2 rounded-2xl border border-white/50 dark:border-slate-700/50 shadow-sm card-3d">
                <button onClick={() => handleDateChange(-1)} className="p-2 rounded-xl hover:bg-white dark:hover:bg-slate-700 shadow-sm active:scale-95 transition-all"><ChevronLeftIcon className="w-6 h-6 text-slate-500" /></button>
                
                <div className="relative group cursor-pointer px-4 py-2 rounded-lg hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors flex flex-col items-center">
                    <h2 className="text-xl font-black text-slate-800 dark:text-white text-center select-none tracking-tight">
                        {formattedDate}
                    </h2>
                    <input 
                        type="date"
                        value={currentDate}
                        onChange={(e) => e.target.value && setCurrentDate(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    />
                </div>

                <div className="flex gap-2 items-center">
                    <button 
                        onClick={() => onUpdateSettings({ ...settings, darkMode: !settings.darkMode })}
                        className="p-2 rounded-xl hover:bg-yellow-50 dark:hover:bg-yellow-900/20 text-slate-400 hover:text-yellow-500 transition-colors hover:shadow-sm" 
                        title="Toggle Dark Mode"
                    >
                        {settings.darkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                    </button>
                    {!isSelectMode ? (
                        <>
                            <button onClick={() => setIsDeleteAllModalOpen(true)} className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors hover:shadow-sm" title="Delete All Blocks">
                                <TrashIcon className="w-5 h-5" />
                            </button>
                            <button onClick={toggleSelectMode} className="p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-400 hover:text-indigo-500 transition-colors hover:shadow-sm" title="Select Blocks to Delete">
                                <CursorArrowRaysIcon className="w-5 h-5" />
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={handleDeleteSelected} className="btn-3d text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/30 px-3 py-2 rounded-xl disabled:opacity-50 border border-red-100 dark:border-red-900" disabled={selectedBlockIds.size === 0}>
                                Delete ({selectedBlockIds.size})
                            </button>
                            <button onClick={toggleSelectMode} className="text-xs font-bold text-slate-500 hover:text-slate-700 px-2">
                                Cancel
                            </button>
                        </>
                    )}
                    <button onClick={() => handleDateChange(1)} className="p-2 rounded-xl hover:bg-white dark:hover:bg-slate-700 shadow-sm active:scale-95 transition-all"><ChevronRightIcon className="w-6 h-6 text-slate-500" /></button>
                </div>
            </div>

            {/* Control Bar */}
            <div className="flex flex-wrap justify-center gap-3 items-center">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shadow-inner">
                    <button onClick={() => setViewMode('full')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'full' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-white transform scale-105' : 'text-slate-500'}`}>Summary</button>
                    <button onClick={() => setViewMode('blocks')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'blocks' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-white transform scale-105' : 'text-slate-500'}`}>Timeline</button>
                </div>

                <div className="flex items-center gap-2">
                    {/* Undo/Redo Buttons */}
                    <div className="flex items-center bg-white dark:bg-slate-800 rounded-xl p-1 shadow-sm border border-slate-100 dark:border-slate-700">
                        <button 
                            onClick={handleUndo} 
                            disabled={historyPast.length === 0}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-all text-slate-600 dark:text-slate-300 active:scale-95"
                            title="Undo last change"
                        >
                            <ArrowUturnLeftIcon className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={handleRedo} 
                            disabled={historyFuture.length === 0}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-all text-slate-600 dark:text-slate-300 active:scale-95"
                            title="Redo last change"
                        >
                            <ArrowUturnRightIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <select 
                        value={defaultDuration}
                        onChange={(e) => setDefaultDuration(parseInt(e.target.value))}
                        className="px-3 py-2.5 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-200 dark:border-slate-700 shadow-sm"
                    >
                        <option value={15}>15m</option>
                        <option value={30}>30m</option>
                        <option value={45}>45m</option>
                        <option value={60}>60m</option>
                    </select>

                    <button 
                        onClick={handleOpenAddBlock}
                        className="btn-3d flex items-center gap-1 px-4 py-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/30 text-xs font-bold text-white hover:bg-indigo-700 transition-all"
                    >
                        <PlusIcon className="w-3 h-3" /> Add Block
                    </button>
                    
                    <button 
                        onClick={handleOpenAddBreak}
                        className="btn-3d flex items-center gap-1 px-4 py-2.5 bg-teal-500 rounded-xl shadow-lg shadow-teal-500/30 text-xs font-bold text-white hover:bg-teal-600 transition-all"
                    >
                        <CoffeeIcon className="w-3 h-3" /> Break
                    </button>
                </div>
            </div>

            {loading ? <div className="p-8 text-center text-slate-400">Loading Plan...</div> :
             !plan && mergedBlocks.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <CalendarIcon className="w-16 h-16 text-slate-300 mb-6" />
                    <h3 className="text-xl font-bold text-slate-700 dark:text-white">No Plan for this day</h3>
                    <p className="text-slate-500 mb-8">Create a block schedule or wait for revisions.</p>
                    
                    <button 
                        onClick={() => setIsManualModalOpen(true)} 
                        className="btn-3d px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-xl shadow-indigo-200 dark:shadow-none transition-all flex items-center gap-2 text-lg"
                    >
                        <PlusIcon className="w-5 h-5" /> Create Schedule
                    </button>
                </div>
             ) : (
                viewMode === 'full' 
                ? <FullDayPlanLayout plan={plan || { date: currentDate, faPages: [], faPagesCount: 0, faStudyMinutesPlanned: 0, videos: [], anki: null, qbank: null, breaks: [], notesFromUser: '', notesFromAI: '', attachments: [], totalStudyMinutesPlanned: 0, totalBreakMinutes: 0, blocks: mergedBlocks }} onEdit={() => setIsManualModalOpen(true)} /> 
                : <BlocksLayout 
                    blocks={mergedBlocks}
                    onStartBlock={handleStartBlock} 
                    onPauseBlock={handlePauseBlock} 
                    onFinishBlock={initiateFinish}
                    onDeleteBlock={(b) => setBlockToDelete(b)}
                    onSelectBlock={handleOpenBlockDetail}
                    isSelectMode={isSelectMode}
                    selectedBlockIds={selectedBlockIds}
                    onToggleSelection={handleToggleBlockSelection}
                  />
             )
            }
        </div>
    );
};
