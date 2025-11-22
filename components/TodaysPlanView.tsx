
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DayPlan, getAdjustedDate, Block, AppSettings, TimeLogEntry, TimeLogCategory, BlockTask, KnowledgeBaseEntry } from '../types';
import { getDayPlan, saveDayPlan, getRevisionSettings } from '../services/firebase';
import { saveTimeLog } from '../services/timeLogService';
import { startBlock, updateBlockInPlan, finishBlock, insertBlockAndShift, moveTasksToNextBlock, deleteBlock, startVirtualBlock, moveTasksToFuturePlan } from '../services/planService';
import { generateBlocks } from '../services/blockGenerator'; 
import { CalendarIcon, ClockIcon, VideoIcon, FireIcon, BookOpenIcon, PlayIcon, PauseIcon, ListCheckIcon, StopIcon, CheckCircleIcon, CoffeeIcon, ChevronLeftIcon, ChevronRightIcon, PencilSquareIcon, PlusIcon, XMarkIcon, TrashIcon, ArrowRightIcon, ChartBarIcon, ArrowPathIcon } from './Icons';
import { TaskCompletionModal } from './TaskCompletionModal'; 
import { ManualPlanModal } from './ManualPlanModal'; 
import { AddBlockModal } from './AddBlockModal';
import { BlockDetailModal } from './BlockDetailModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { processLogEntries } from '../services/faLoggerService';

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

const InfoCard: React.FC<{ 
    title: string; 
    icon: React.ElementType; 
    children: React.ReactNode; 
    className?: string;
    colorClass?: string; 
}> = ({ title, icon: Icon, children, className = '', colorClass = 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300' }) => (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm ${className}`}>
        <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-xl ${colorClass} flex items-center justify-center shadow-sm`}>
                <Icon className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-700 dark:text-slate-200 text-lg">{title}</h3>
        </div>
        {children}
    </div>
);

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
                    <button onClick={onEdit} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline">
                        <PencilSquareIcon className="w-4 h-4" /> Edit Plan
                    </button>
                </div>

                <InfoCard 
                    title="Planned Blocks" 
                    icon={CalendarIcon} 
                    colorClass="text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
                >
                    <div className="space-y-2">
                        {plan.blocks && plan.blocks.length > 0 ? plan.blocks.map((b, i) => (
                            <div key={i} className="flex justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                                <span className="font-mono text-slate-500 w-24">{formatTime12(b.plannedStartTime)} - {formatTime12(b.plannedEndTime)}</span>
                                <span className="font-bold truncate flex-1 text-slate-700 dark:text-slate-300">{b.title}</span>
                                <span className="text-xs text-slate-400">{b.plannedDurationMinutes}m</span>
                            </div>
                        )) : <p className="text-sm text-slate-400 italic">No blocks scheduled.</p>}
                    </div>
                </InfoCard>

                <InfoCard 
                    title="Execution Overview" 
                    icon={FireIcon}
                    colorClass="text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300"
                >
                    <div className="space-y-3">
                        {executedBlocks.length > 0 ? executedBlocks.map((b, i) => (
                            <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between text-sm py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 gap-2">
                                <div className="flex items-center gap-3">
                                    <span className="font-mono font-bold text-slate-600 dark:text-slate-400 w-24 shrink-0">
                                        {formatTime12(b.actualStartTime)} - {formatTime12(b.actualEndTime)}
                                    </span>
                                    <div>
                                        <span className="font-bold text-slate-800 dark:text-white block sm:inline">{b.title}</span>
                                        {b.rescheduledTo && (
                                            <span className="text-[10px] text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded ml-0 sm:ml-2 font-bold">
                                                Rescheduled
                                            </span>
                                        )}
                                        {b.status === 'DONE' && !b.rescheduledTo && (
                                            <span className="text-[10px] text-green-600 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded ml-0 sm:ml-2 font-bold">
                                                Done
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span className="text-xs font-mono text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded self-start sm:self-auto">
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
                    colorClass="text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300"
                >
                    <div className="mb-6">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Planned</p>
                        <div className="flex items-baseline justify-center gap-1">
                            <span className="text-3xl font-black text-slate-800 dark:text-white">{totalHours}</span><span className="text-sm font-bold text-slate-500">h</span>
                            {remainingMinutes > 0 && <><span className="text-3xl font-black text-slate-800 dark:text-white ml-2">{remainingMinutes}</span><span className="text-sm font-bold text-slate-500">m</span></>}
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                        <div className="flex justify-between items-end mb-2">
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Actual Execution</p>
                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{completionPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mb-2 overflow-hidden">
                            <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${completionPercent}%` }}></div>
                        </div>
                        <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
                            {actualHours}h {actualRemMinutes}m <span className="text-sm font-normal text-slate-400">done</span>
                        </p>
                    </div>
                </InfoCard>

                 <InfoCard 
                    title="Timeline" 
                    icon={ClockIcon}
                    colorClass="text-violet-600 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300"
                >
                    <div className="space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-700">
                            <span className="text-xs font-bold text-slate-400 uppercase">Start Time</span>
                            <div className="text-right">
                                <div className="text-sm font-mono font-bold text-slate-800 dark:text-white">{actualStartTime ? formatTime12(actualStartTime) : '--:--'}</div>
                                <div className="text-[10px] text-slate-400">Planned: {formatTime12(plan.startTimePlanned)}</div>
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400 uppercase">Finish Time</span>
                            <div className="text-right">
                                <div className="text-sm font-mono font-bold text-slate-800 dark:text-white">{actualEndTime ? formatTime12(actualEndTime) : 'In Progress'}</div>
                                <div className="text-[10px] text-slate-400">Planned: {formatTime12(plan.estimatedEndTime)}</div>
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
    onClick: () => void 
}> = ({ children, onDelete, onClick }) => {
    const touchStartRef = useRef<{ x: number, y: number } | null>(null);
    const [offset, setOffset] = useState(0);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchStartRef.current) return;
        const deltaX = e.touches[0].clientX - touchStartRef.current.x;
        const deltaY = e.touches[0].clientY - touchStartRef.current.y;
        
        // Horizontal swipe dominant
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
            const newOffset = Math.min(0, Math.max(-100, deltaX)); // Cap at -100px
            setOffset(newOffset);
        }
    };

    const handleTouchEnd = () => {
        if (offset < -50) {
            setOffset(-80); // Snap open
        } else {
            setOffset(0); // Snap close
        }
        touchStartRef.current = null;
    };

    // Mouse handlers for desktop swipe simulation
    const handleMouseDown = (e: React.MouseEvent) => {
        touchStartRef.current = { x: e.clientX, y: e.clientY };
    };
    
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!touchStartRef.current || e.buttons !== 1) return;
        const deltaX = e.clientX - touchStartRef.current.x;
        if (deltaX < 0) { // Only swipe left
             const newOffset = Math.min(0, Math.max(-100, deltaX));
             setOffset(newOffset);
        }
    };

    const handleMouseUp = () => {
        if (offset < -50) setOffset(-80);
        else setOffset(0);
        touchStartRef.current = null;
    };

    return (
        <div className="relative overflow-hidden rounded-xl select-none">
            <div 
                className="absolute inset-y-0 right-0 w-24 bg-red-500 flex items-center justify-center z-0 cursor-pointer"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
                <TrashIcon className="w-6 h-6 text-white" />
            </div>
            <div 
                className="relative z-10 bg-white dark:bg-slate-900 transition-transform duration-200 ease-out cursor-pointer"
                style={{ transform: `translateX(${offset}px)` }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={() => {
                    if (offset === 0) onClick();
                    else setOffset(0); // Close swipe on click if open
                }}
            >
                {children}
            </div>
        </div>
    );
};

// --- BLOCK RENDERER ---
const BlockCard: React.FC<{ block: Block, isCurrent: boolean, isNext: boolean, onStart: () => void, onPause: () => void, onFinish: () => void }> = ({ block, isCurrent, isNext, onStart, onPause, onFinish }) => {
    const isDone = block.status === 'DONE';
    const isBreak = block.type === 'BREAK';
    const isRevision = block.type === 'REVISION_FA';
    const isVirtual = block.isVirtual; // Flag for revision projections
    
    // Countdown Timer Logic
    const [countdown, setCountdown] = useState<string>('--:--');
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        if (isCurrent && block.actualStartTime) {
            const updateTimer = () => {
                const now = new Date();
                const [startH, startM] = block.actualStartTime!.split(':').map(Number);
                const startTime = new Date();
                startTime.setHours(startH, startM, 0);
                
                const elapsedMs = now.getTime() - startTime.getTime();
                // For regular blocks, count down from planned duration
                const totalDurationMs = block.plannedDurationMinutes * 60 * 1000;
                const remainingMs = totalDurationMs - elapsedMs;
                
                if (remainingMs <= 0) {
                    // If overtime, show negative or elapsed? Let's show negative for urgency.
                    const m = Math.floor(Math.abs(remainingMs) / 60000);
                    const s = Math.floor((Math.abs(remainingMs) % 60000) / 1000);
                    setCountdown(`-${m}:${s.toString().padStart(2, '0')}`);
                } else {
                    const m = Math.floor(remainingMs / 60000);
                    const s = Math.floor((remainingMs % 60000) / 1000);
                    setCountdown(`${m}:${s.toString().padStart(2, '0')}`);
                }
            };
            
            timerRef.current = window.setInterval(updateTimer, 1000);
            updateTimer(); // Initial
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isCurrent, block.actualStartTime, block.plannedDurationMinutes]);

    // Split View for Completed Blocks
    if (isDone) {
        const actualDuration = block.actualDurationMinutes || 0;
        const plannedDuration = block.plannedDurationMinutes || 0;
        const overrun = actualDuration - plannedDuration;
        
        return (
            <div className="relative pl-4 md:pl-0 group animate-fade-in">
                <div className="absolute left-[-8px] md:left-[-20px] top-0 bottom-0 w-0.5 bg-green-200 dark:bg-green-900 hidden md:block"></div>
                
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800 overflow-hidden flex flex-col md:flex-row">
                    
                    {/* LEFT SIDE: ORIGINAL PLAN */}
                    <div className="flex-1 p-4 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
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

                    {/* RIGHT SIDE: EXECUTION DETAILS */}
                    <div className="flex-1 p-4">
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
                            {overrun > 0 && (
                                <span className="text-[10px] font-black text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                                    +{overrun}m Over
                                </span>
                            )}
                        </div>

                        {/* Reschedule Link */}
                        {block.rescheduledTo && (
                            <div className="mb-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300 font-bold">
                                <ArrowRightIcon className="w-3.5 h-3.5" />
                                <span>Rescheduled to {block.rescheduledTo.includes(':') ? formatTime12(block.rescheduledTo) : block.rescheduledTo}</span>
                            </div>
                        )}

                        <div className="space-y-3">
                            {block.tasks && block.tasks.length > 0 ? block.tasks.map((t, i) => (
                                <div key={i} className={`p-2 rounded-lg border flex items-center justify-between ${t.execution?.completed ? 'bg-green-50/30 border-green-100 dark:border-green-900/30' : 'bg-red-50/30 border-red-100 dark:border-red-900/30'}`}>
                                    <div className="flex items-center gap-2 mb-1 min-w-0 flex-1">
                                        {t.execution?.completed ? <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" /> : <XMarkIcon className="w-4 h-4 text-red-500 flex-shrink-0" />}
                                        <span className={`text-xs font-bold truncate ${t.execution?.completed ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>{t.detail}</span>
                                    </div>
                                    {t.execution?.note && (
                                        <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-black/20 px-2 py-1 rounded max-w-[40%] truncate text-right ml-2 shrink-0" title={t.execution.note}>
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
            </div>
        );
    }

    // Active / Pending Block View
    return (
        <div className={`relative pl-4 md:pl-0 transition-all ${isBreak ? 'opacity-80' : ''} ${isVirtual ? 'hover:scale-[1.01] hover:shadow-md' : ''}`}>
            <div className={`absolute left-[-8px] md:left-[-20px] top-0 bottom-0 w-0.5 hidden md:block ${isVirtual ? 'bg-amber-300 dark:bg-amber-700' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
            
            <div className={`rounded-xl p-4 border flex flex-col gap-4 
                ${isBreak ? 'bg-slate-50 dark:bg-slate-800/50 border-dashed border-slate-300 dark:border-slate-600' : isVirtual ? 'bg-amber-50/30 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm'} 
                ${isCurrent ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900' : ''}
                ${isNext && !isVirtual ? 'border-indigo-200 dark:border-indigo-800' : ''}
            `}>
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`font-mono font-bold text-sm ${isCurrent ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>
                                {isVirtual ? formatTime12(block.plannedStartTime) : `${formatTime12(block.plannedStartTime)} - ${formatTime12(block.plannedEndTime)}`}
                            </span>
                            {isBreak && <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-500">BREAK</span>}
                            {isVirtual && <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">DUE</span>}
                        </div>
                        <h4 className="font-bold text-lg text-slate-800 dark:text-white">{block.title}</h4>
                        {isVirtual && block.description && <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 font-medium">{block.description}</p>}
                    </div>
                    
                    {/* Controls */}
                    <div className="flex items-center gap-2">
                        {isCurrent ? (
                            <>
                                <div className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-700 dark:text-indigo-300 font-mono font-bold text-lg mr-2 animate-pulse">
                                    {countdown}
                                </div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onFinish(); }} 
                                    className="bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50 px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm flex items-center gap-1"
                                >
                                    <StopIcon className="w-4 h-4" /> Finish
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onPause(); }} 
                                    className="p-2 bg-amber-100 text-amber-600 rounded-lg hover:bg-amber-200 transition-colors"
                                >
                                    <PauseIcon className="w-4 h-4" />
                                </button>
                            </>
                        ) : block.status === 'PAUSED' ? (
                            <button onClick={(e) => { e.stopPropagation(); onStart(); }} className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-200 transition-colors flex items-center gap-1">
                                <PlayIcon className="w-4 h-4" /> Resume
                            </button>
                        ) : (
                            !isBreak && (
                                <button onClick={(e) => { e.stopPropagation(); onStart(); }} className={`p-2 rounded-full transition-all ${isNext ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-indigo-500'} ${isVirtual ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-md' : ''}`}>
                                    <PlayIcon className="w-5 h-5" />
                                </button>
                            )
                        )}
                    </div>
                </div>

                {/* Granular Tasks Display */}
                {block.tasks && block.tasks.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                        {block.tasks.map((task, i) => (
                            <div key={i} className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-medium ${
                                task.type === 'FA' ? 'bg-indigo-50 border-indigo-100 text-indigo-700' :
                                task.type === 'VIDEO' ? 'bg-blue-50 border-blue-100 text-blue-700' :
                                task.type === 'ANKI' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                                'bg-slate-50 border-slate-200 text-slate-600'
                            }`}>
                                {task.type === 'FA' && <BookOpenIcon className="w-3 h-3" />}
                                {task.type === 'VIDEO' && <VideoIcon className="w-3 h-3" />}
                                {task.type === 'ANKI' && <FireIcon className="w-3 h-3" />}
                                <span>{task.detail}</span>
                            </div>
                        ))}
                    </div>
                )}
                
                {/* Active Timer Indicator */}
                {isCurrent && (
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                        <span className="text-xs font-bold text-indigo-500 flex items-center gap-1">
                            <ClockIcon className="w-3 h-3" /> Session Active
                        </span>
                        <span className="text-xs text-slate-400">started at {formatTime12(block.actualStartTime)}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const BlocksLayout: React.FC<{ 
    blocks: Block[], // Sorted blocks including virtual ones
    onStartBlock: (id: string, block: Block) => void, 
    onPauseBlock: (id: string) => void, 
    onFinishBlock: (block: Block) => void,
    onDeleteBlock: (block: Block) => void,
    onSelectBlock: (block: Block) => void
}> = ({ blocks, onStartBlock, onPauseBlock, onFinishBlock, onDeleteBlock, onSelectBlock }) => {
    const currentBlock = blocks.find(b => b.status === 'IN_PROGRESS');
    const nextBlock = blocks.find(b => b.status === 'NOT_STARTED');

    if (blocks.length === 0) {
        return (
            <div className="p-8 text-center flex flex-col items-center">
                <ListCheckIcon className="w-12 h-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-700 dark:text-white">No Timeline Items</h3>
                <p className="text-slate-500 mb-4">Add a block or wait for revision items to appear.</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-4">
            {blocks.map((block) => (
                <SwipeableBlockWrapper 
                    key={block.id}
                    onDelete={() => onDeleteBlock(block)}
                    onClick={() => onSelectBlock(block)}
                >
                    <BlockCard 
                        block={block}
                        isCurrent={currentBlock?.id === block.id}
                        isNext={nextBlock?.id === block.id}
                        onStart={() => onStartBlock(block.id, block)}
                        onPause={() => onPauseBlock(block.id)}
                        onFinish={() => onFinishBlock(block)}
                    />
                </SwipeableBlockWrapper>
            ))}
        </div>
    );
};

interface TodaysPlanViewProps {
    targetDate?: string;
    settings: AppSettings;
    knowledgeBase?: KnowledgeBaseEntry[];
    onUpdateKnowledgeBase?: (newKB: KnowledgeBaseEntry[]) => Promise<void>; // Function to update KB in parent
}

// --- MAIN VIEW COMPONENT ---
export const TodaysPlanView: React.FC<TodaysPlanViewProps> = ({ targetDate, settings, knowledgeBase = [], onUpdateKnowledgeBase }) => {
    const [viewMode, setViewMode] = useState<'full' | 'blocks'>('blocks');
    const [currentDate, setCurrentDate] = useState(targetDate || getAdjustedDate(new Date()));
    const [plan, setPlan] = useState<DayPlan | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Block Logic State
    const [finishingBlock, setFinishingBlock] = useState<Block | null>(null);
    const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [isAddBlockModalOpen, setIsAddBlockModalOpen] = useState(false);
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
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const handleDateChange = (offset: number) => {
        const d = new Date(currentDate + 'T12:00:00');
        d.setDate(d.getDate() + offset);
        setCurrentDate(getAdjustedDate(d));
    };

    // --- MERGED BLOCKS LOGIC (Actual Plan + Due Revisions) ---
    const mergedBlocks = useMemo(() => {
        let actualBlocks = plan?.blocks || [];
        
        // Filter KB for due revisions
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
                id: `rev-${kb.pageNumber}`, // Temporary ID
                index: -1,
                date: currentDate,
                plannedStartTime: timeStr,
                plannedEndTime: timeStr, // Point in time
                type: 'REVISION_FA',
                title: `Revise: ${kb.title}`,
                description: `Revision Page: ${kb.pageNumber}`,
                plannedDurationMinutes: 15, // Default assumption
                status: 'NOT_STARTED',
                isVirtual: true,
                tasks: [{
                    id: `vt-${kb.pageNumber}`,
                    type: 'FA',
                    detail: `Page ${kb.pageNumber}`,
                    completed: false,
                    meta: { pageNumber: parseInt(kb.pageNumber), topic: kb.title }
                }]
            };
        }).filter(Boolean) as Block[];

        // Merge and Sort
        const all = [...actualBlocks, ...virtualBlocks];
        return all.sort((a, b) => parseTimeToMinutes(a.plannedStartTime) - parseTimeToMinutes(b.plannedStartTime));
    }, [plan, knowledgeBase, currentDate]);


    // --- BLOCK ACTIONS ---

    const handleStartBlock = async (blockId: string, blockObj: Block) => {
        try {
            if (blockObj.isVirtual) {
                // Materialize virtual block into DB then start
                const updatedPlan = await startVirtualBlock(currentDate, blockObj);
                if (updatedPlan) setPlan(updatedPlan);
            } else {
                const updatedPlan = await startBlock(currentDate, blockId);
                if (updatedPlan) setPlan(updatedPlan);
            }
        } catch (e) { console.error("Start block failed", e); }
    };
    
    const handlePauseBlock = async (blockId: string) => {
        try {
            const updatedPlan = await updateBlockInPlan(currentDate, blockId, { status: 'PAUSED' });
            if (updatedPlan) setPlan(updatedPlan);
        } catch (e) { console.error("Pause block failed", e); }
    };

    const initiateFinish = (block: Block) => {
        setFinishingBlock(block);
        setIsCompletionModalOpen(true);
    };

    const handleFinishConfirm = async (
        status: 'COMPLETED' | 'PARTIAL' | 'NOT_DONE', 
        tasks: BlockTask[], 
        rescheduleAction?: { type: 'NEW_BLOCK' | 'NEXT_BLOCK' | 'FUTURE_DATE', time?: string, duration?: number, date?: string, tasks: BlockTask[] }
    ) => {
        if (!finishingBlock) return;
        
        try {
            // 1. Handle Rescheduling Logic First
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

            // 2. Finish Current Block
            const updatedPlan = await finishBlock(currentDate, finishingBlock.id, { 
                status, 
                pagesCovered: [],
                carryForwardPages: [], 
                notes: '', 
                tasks: tasks,
                rescheduledTo: rescheduleAction?.type === 'NEW_BLOCK' ? rescheduleAction.time : (rescheduleAction?.type === 'FUTURE_DATE' ? rescheduleAction.date : undefined)
            });

            if (updatedPlan) {
                setPlan(updatedPlan);
            }

            // 3. SYNC TO KB & TimeLogs if task is completed (FA Logger & KnowledgeBase)
            if (status === 'COMPLETED' || status === 'PARTIAL') {
                // Find completed FA tasks
                // Robustly find any task that looks like a FA page read
                const completedFATasks = tasks.filter(t => t.type === 'FA' && t.execution?.completed);
                
                if (completedFATasks.length > 0 && onUpdateKnowledgeBase) {
                    // Fetch latest settings to ensure SRS is applied correctly
                    const revSettings = await getRevisionSettings() || { mode: 'balanced', targetCount: 7 };

                    const entriesToLog = completedFATasks.map(t => {
                        // Ensure we get a page number
                        const pageMatch = t.detail.match(/\d+/);
                        const pageNum = pageMatch ? parseInt(pageMatch[0]) : (t.meta?.pageNumber || 0);
                        
                        return {
                            pageNumber: pageNum,
                            isExplicitRevision: finishingBlock.title.toLowerCase().includes('revis') || t.detail.toLowerCase().includes('revis'),
                            topics: t.meta?.topic ? [t.meta.topic] : [],
                            date: currentDate // Explicitly use today's plan date
                        };
                    }).filter(e => e.pageNumber > 0);

                    if (entriesToLog.length > 0) {
                        // processLogEntries calculates nextRevisionAt based on current RevisionSettings
                        const { results, updatedKB } = processLogEntries(entriesToLog, knowledgeBase, revSettings);
                        await onUpdateKnowledgeBase(updatedKB);
                        
                        // Save TimeLogs for each processed entry
                        const startTimeStr = finishingBlock.actualStartTime || "00:00";
                        const endTimeStr = finishingBlock.actualEndTime || "00:00";
                        const durationPerTask = Math.round((finishingBlock.actualDurationMinutes || 30) / entriesToLog.length) || 1;

                        for (const res of results) {
                            const start = new Date(currentDate + 'T' + startTimeStr + ':00');
                            const end = new Date(currentDate + 'T' + endTimeStr + ':00');
                            // Handle midnight crossover for time logging
                            if (end < start) end.setDate(end.getDate() + 1);

                            const timeLog: TimeLogEntry = {
                                id: generateId(),
                                date: currentDate,
                                startTime: start.toISOString(),
                                endTime: end.toISOString(),
                                durationMinutes: durationPerTask,
                                category: res.eventType === 'REVISION' ? 'REVISION' : 'STUDY',
                                source: 'TODAYS_PLAN_BLOCK',
                                activity: `Block: ${finishingBlock.title} - FA Pg ${res.pageNumber}`,
                                pageNumber: res.pageNumber,
                                linkedEntityId: res.updatedEntry.logs[res.updatedEntry.logs.length-1].id
                            };
                            await saveTimeLog(timeLog);
                        }
                    }
                }
            }

        } catch (e) { console.error("Finish block failed", e); } finally { setIsCompletionModalOpen(false); setFinishingBlock(null); }
    };

    // ... (Modal Handlers - unchanged) ...
    const handleOpenAddBlock = () => {
        const lastBlock = plan?.blocks && plan.blocks.length > 0 ? plan.blocks[plan.blocks.length - 1] : null;
        let startTime = '08:00';
        if (lastBlock) startTime = lastBlock.plannedEndTime;
        setAddBlockStartTime(startTime);
        setIsAddBlockModalOpen(true);
    };

    const handleSaveNewBlock = async (title: string, startTime: string, endTime: string, tasks: BlockTask[]) => {
        const [sH, sM] = startTime.split(':').map(Number);
        const [eH, eM] = endTime.split(':').map(Number);
        let duration = (eH * 60 + eM) - (sH * 60 + sM);
        if (duration < 0) duration += 24 * 60;
        const updatedPlan = await insertBlockAndShift(currentDate, startTime, duration, tasks, title);
        if (updatedPlan) setPlan(updatedPlan);
    };

    const handleSaveManualPlan = async (newPlan: DayPlan) => {
        await saveDayPlan(newPlan);
        setPlan(newPlan);
    };

    const handleOpenBlockDetail = (block: Block) => {
        setSelectedBlock(block);
        setIsDetailModalOpen(true);
    };

    const handleUpdateBlock = async (updatedBlock: Block) => {
        if (updatedBlock.isVirtual) {
            return;
        }
        try {
            await updateBlockInPlan(currentDate, updatedBlock.id, updatedBlock);
            const updated = await getDayPlan(currentDate);
            setPlan(updated);
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
            setPlan(updated);
        } catch (e) { console.error(e); }
    };

    const confirmDeleteBlock = async () => {
        if (blockToDelete) {
            if (blockToDelete.isVirtual) {
                setBlockToDelete(null);
                return;
            }
            const updatedPlan = await deleteBlock(currentDate, blockToDelete.id);
            if (updatedPlan) setPlan(updatedPlan);
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
                message={`Are you sure you want to delete "${blockToDelete?.title}"?`}
            />

            <div className="flex justify-between items-center relative">
                <button onClick={() => handleDateChange(-1)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeftIcon className="w-6 h-6 text-slate-500" /></button>
                
                <div className="relative group cursor-pointer px-4 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white text-center select-none">
                        {formattedDate}
                    </h2>
                    <input 
                        type="date"
                        value={currentDate}
                        onChange={(e) => e.target.value && setCurrentDate(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    />
                </div>

                <button onClick={() => handleDateChange(1)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronRightIcon className="w-6 h-6 text-slate-500" /></button>
            </div>

            {/* Control Bar */}
            <div className="flex flex-wrap justify-center gap-3 items-center">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button onClick={() => setViewMode('full')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${viewMode === 'full' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-white' : 'text-slate-500'}`}>Summary</button>
                    <button onClick={() => setViewMode('blocks')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${viewMode === 'blocks' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-white' : 'text-slate-500'}`}>Timeline</button>
                </div>

                <div className="flex items-center gap-2">
                    <select 
                        value={defaultDuration}
                        onChange={(e) => setDefaultDuration(parseInt(e.target.value))}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 border border-transparent"
                    >
                        <option value={15}>15m</option>
                        <option value={30}>30m</option>
                        <option value={45}>45m</option>
                        <option value={60}>60m</option>
                    </select>

                    <button 
                        onClick={handleOpenAddBlock}
                        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 dark:bg-slate-700 rounded-lg shadow-sm text-xs font-bold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-slate-600 transition-colors"
                    >
                        <PlusIcon className="w-3 h-3" /> Add Block
                    </button>
                </div>
            </div>

            {loading ? <div className="p-8 text-center text-slate-400">Loading Plan...</div> :
             !plan && mergedBlocks.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <CalendarIcon className="w-12 h-12 text-slate-300 mb-4" />
                    <h3 className="text-lg font-bold text-slate-700 dark:text-white">No Plan for this day</h3>
                    <p className="text-slate-500 mb-6">Create a block schedule or wait for revisions.</p>
                    
                    <button 
                        onClick={() => setIsManualModalOpen(true)} 
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg transition-all flex items-center gap-2"
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
                  />
             )
            }
        </div>
    );
};
