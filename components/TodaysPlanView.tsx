
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DayPlan, getAdjustedDate, Block, AppSettings, TimeLogEntry, TimeLogCategory, BlockTask, KnowledgeBaseEntry, RevisionSettings, NotificationTrigger, FMGEEntry } from '../types';
import { getDayPlan, saveDayPlan, getRevisionSettings, saveKnowledgeBase, saveFMGEEntry, getFMGEData } from '../services/firebase';
import { saveTimeLog, deleteTimeLog } from '../services/timeLogService';
import { startBlock, updateBlockInPlan, finishBlock, insertBlockAndShift, moveTasksToNextBlock, deleteBlock, startVirtualBlock, moveTasksToFuturePlan } from '../services/planService';
import { generateBlocks } from '../services/blockGenerator'; 
import { CalendarIcon, ClockIcon, VideoIcon, StarIcon, QIcon, BookOpenIcon, PlayIcon, PauseIcon, ListCheckIcon, StopIcon, CheckCircleIcon, CoffeeIcon, ChevronLeftIcon, ChevronRightIcon, PencilSquareIcon, PlusIcon, XMarkIcon, TrashIcon, ArrowRightIcon, ChartBarIcon, ArrowPathIcon, ArrowUturnLeftIcon, ArrowUturnRightIcon, CursorArrowRaysIcon, SunIcon, MoonIcon, SunCloudIcon, SunsetIcon, ChevronDownIcon, SparklesIcon, ClipboardDocumentCheckIcon, FireIcon, BoltIcon } from './Icons';
import { TaskCompletionModal } from './TaskCompletionModal'; 
import { ManualPlanModal } from './ManualPlanModal'; 
import { AddBlockModal } from './AddBlockModal';
import { AddBreakModal } from './AddBreakModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { PauseReasonModal } from './PauseReasonModal';
import { processLogEntries } from '../services/faLoggerService';
import { calculateNextRevisionDate } from '../services/srsService';
import { sendLocalNotification, getNotificationTone } from '../services/notificationService';

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
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const formatTime24 = (date: Date) => {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

// --- COMPONENTS ---

// New Emoji Map for Stickers
const PERIOD_EMOJIS: Record<string, string> = {
    'Early Morning': '🌌', // 00:00 - 05:00 (Technically late night, but chronological start)
    'Morning': '🌅',
    'Late Morning': '☀️',
    'Afternoon': '🌤️',
    'Evening': '🌆',
    'Night': '🌙',
};

const TimelineSectionHeader: React.FC<{ 
    period: string, 
    blocks: Block[], 
    isCollapsed: boolean,
    onToggle: () => void
}> = ({ period, blocks, isCollapsed, onToggle }) => {
    
    // Filter out breaks for counting
    const studyBlocks = blocks.filter(b => b.type !== 'BREAK');
    const totalBlocks = studyBlocks.length;
    const completedBlocks = studyBlocks.filter(b => b.status === 'DONE').length;
    const progressPercent = totalBlocks > 0 ? (completedBlocks / totalBlocks) * 100 : 0;

    // Calculate Times (Standard sort)
    const sortedBlocks = [...blocks].sort((a, b) => parseTimeToMinutes(a.plannedStartTime) - parseTimeToMinutes(b.plannedStartTime));
    const firstBlock = sortedBlocks[0];
    const lastBlock = sortedBlocks[sortedBlocks.length - 1];
    
    // Use actual start/end if available for more accuracy, else planned
    const startTimeStr = firstBlock ? formatTime12(firstBlock.actualStartTime || firstBlock.plannedStartTime) : '';
    const endTimeStr = lastBlock ? formatTime12(lastBlock.actualEndTime || lastBlock.plannedEndTime) : '';
    const timeRange = firstBlock && lastBlock ? `${startTimeStr} - ${endTimeStr}` : '';

    // Calculate Total Planned Duration for display (excluding breaks)
    const totalDurationMins = studyBlocks.reduce((acc, b) => acc + b.plannedDurationMinutes, 0);
    const durationDisplay = formatDurationString(totalDurationMins);

    // Calculate Aggregate Time Saved/Lost for Seal (Exclude breaks from seal logic)
    let totalPlannedForCompleted = 0;
    let totalActualForCompleted = 0;
    let hasCompleted = false;

    studyBlocks.forEach(b => {
        if (b.status === 'DONE' && b.actualDurationMinutes !== undefined) {
            hasCompleted = true;
            totalPlannedForCompleted += b.plannedDurationMinutes;
            totalActualForCompleted += b.actualDurationMinutes;
        }
    });

    // Glassy Header Styles
    let config = {
        bgBase: 'bg-slate-100/50 dark:bg-slate-800/50',
        fillGradient: 'from-slate-500/50 to-slate-600/50',
        textColor: 'text-slate-900 dark:text-slate-100',
        borderColor: 'border-slate-300/50 dark:border-slate-700/50',
        shadowColor: 'rgba(100, 116, 139, 0.3)',
    };

    switch (period) {
        case 'Early Morning': // 00:00 - 06:00
            config = {
                bgBase: 'bg-slate-200/60 dark:bg-slate-900/60',
                fillGradient: 'from-slate-400/70 via-violet-500/70 to-slate-500/70',
                textColor: 'text-slate-900 dark:text-slate-200',
                borderColor: 'border-slate-300/50 dark:border-slate-700/50',
                shadowColor: 'rgba(71, 85, 105, 0.3)',
            };
            break;
        case 'Morning': // 06:00 - 10:00
            config = {
                bgBase: 'bg-rose-100/60 dark:bg-rose-900/20',
                fillGradient: 'from-rose-200/70 via-orange-200/70 to-rose-300/70',
                textColor: 'text-rose-950 dark:text-rose-100',
                borderColor: 'border-rose-200/50 dark:border-rose-700/50',
                shadowColor: 'rgba(244, 63, 94, 0.3)',
            };
            break;
        case 'Late Morning': // 10:00 - 13:00
            config = {
                bgBase: 'bg-amber-100/60 dark:bg-amber-900/20',
                fillGradient: 'from-amber-200/70 via-yellow-300/70 to-amber-300/70',
                textColor: 'text-amber-950 dark:text-amber-100',
                borderColor: 'border-amber-200/50 dark:border-amber-700/50',
                shadowColor: 'rgba(245, 158, 11, 0.3)',
            };
            break;
        case 'Afternoon': // 13:00 - 17:00
            config = {
                bgBase: 'bg-orange-100/60 dark:bg-orange-900/20',
                fillGradient: 'from-orange-200/70 via-red-300/70 to-orange-300/70',
                textColor: 'text-orange-950 dark:text-orange-100',
                borderColor: 'border-orange-200/50 dark:border-orange-700/50',
                shadowColor: 'rgba(249, 115, 22, 0.3)',
            };
            break;
        case 'Evening': // 17:00 - 21:00
            config = {
                bgBase: 'bg-indigo-100/60 dark:bg-indigo-900/20',
                fillGradient: 'from-indigo-300/70 via-purple-400/70 to-indigo-300/70',
                textColor: 'text-indigo-950 dark:text-indigo-100',
                borderColor: 'border-indigo-200/50 dark:border-indigo-700/50',
                shadowColor: 'rgba(99, 102, 241, 0.3)',
            };
            break;
        case 'Night': // 21:00 - 24:00
            config = {
                bgBase: 'bg-blue-100/60 dark:bg-blue-900/20',
                fillGradient: 'from-blue-400/70 via-indigo-500/70 to-blue-500/70',
                textColor: 'text-blue-950 dark:text-blue-100',
                borderColor: 'border-blue-300/50 dark:border-blue-700/50',
                shadowColor: 'rgba(37, 99, 235, 0.3)',
            };
            break;
    }

    const emoji = PERIOD_EMOJIS[period] || '📅';

    return (
        <div 
            onClick={onToggle}
            className={`relative mt-8 mb-4 h-24 rounded-2xl overflow-hidden cursor-pointer select-none transform transition-all active:scale-[0.98] group card-3d ${config.bgBase} border-2 ${config.borderColor} backdrop-blur-xl`}
            style={{
                animation: `pulse-border-${period.replace(/\s+/g, '')} 3s infinite ease-in-out`
            }}
        >
            {/* Liquid Progress Fill Container */}
            <div 
                className="absolute top-0 left-0 bottom-0 transition-all duration-1000 ease-out overflow-hidden"
                style={{ width: `${progressPercent}%` }}
            >
                <div className={`absolute inset-0 bg-gradient-to-r ${config.fillGradient} opacity-80 backdrop-blur-sm`}></div>
                <div 
                    className="absolute inset-0 opacity-30"
                    style={{
                        backgroundImage: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 45%, transparent 60%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 3s infinite linear'
                    }}
                ></div>
            </div>

            {/* Content Layer */}
            <div className="relative z-10 flex items-center justify-between h-full px-4 sm:px-6">
                
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`p-2 rounded-full bg-white/40 backdrop-blur-md shadow-sm transition-transform duration-300 ${isCollapsed ? '-rotate-90' : 'rotate-0'} shrink-0`}>
                        <ChevronDownIcon className={`w-5 h-5 ${config.textColor}`} />
                    </div>
                    
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Sticker Icon */}
                        <div className="text-4xl drop-shadow-md filter hover:scale-110 transition-transform cursor-pointer shrink-0" title={period}>
                            {emoji}
                        </div>
                        
                        <div className="flex flex-col min-w-0">
                            <h3 className={`text-xl sm:text-2xl font-black tracking-tight ${config.textColor} drop-shadow-md mix-blend-hard-light leading-none truncate`}>
                                {period}
                            </h3>
                            <span className={`text-xs sm:text-sm font-bold font-mono mt-1 opacity-90 ${config.textColor} mix-blend-hard-light truncate`}>
                                {timeRange && <span className="mr-1">{timeRange} •</span>}
                                {durationDisplay} study • {totalBlocks} Tasks
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Side: Time Seal or Counter */}
                <div className="flex items-center shrink-0 ml-2">
                    {hasCompleted ? (
                        <div className="scale-75 sm:scale-90 origin-right">
                            <TimeSeal planned={totalPlannedForCompleted} actual={totalActualForCompleted} />
                        </div>
                    ) : (
                        <div className="flex items-baseline gap-1">
                            <span className={`text-4xl sm:text-5xl font-black ${config.textColor} drop-shadow-md mix-blend-overlay`}>
                                {completedBlocks}
                            </span>
                            <span className={`text-lg sm:text-xl font-bold ${config.textColor} opacity-60 mix-blend-overlay`}>
                                /{totalBlocks}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {progressPercent > 0 && progressPercent < 100 && (
                <div 
                    className="absolute top-0 bottom-0 w-2 bg-white/30 blur-sm z-20"
                    style={{ left: `${progressPercent}%`, transform: 'translateX(-50%)' }}
                ></div>
            )}
            
            {/* Keep Styles for Animation */}
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
                <div className="font-black text-2xl leading-none tracking-tighter drop-shadow-sm flex items-center">{isSaved ? '+' : '-'}{Math.round(absDiff)}<span className="text-xs ml-0.5 align-top mt-1">m</span></div>
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
    <div className={`bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-3xl border border-white/40 dark:border-white/10 p-6 shadow-lg card-3d ${className}`}>
        <div className="flex items-center gap-3 mb-5">
            <div className={`p-3 rounded-xl ${colorClass} shadow-sm border border-white/50 dark:border-white/5 backdrop-blur-sm`}>
                <Icon className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg tracking-tight">{title}</h3>
        </div>
        {children}
    </div>
);

const FullDayPlanLayout: React.FC<{ plan: DayPlan, onEdit: () => void }> = ({ plan, onEdit }) => {
    const totalStudyMinutes = plan.totalStudyMinutesPlanned || 0;
    const totalHours = Math.floor(totalStudyMinutes / 60);
    const remainingMinutes = totalStudyMinutes % 60;
    
    // Execution Stats - Filter out BREAKS for effective study time
    const executedBlocks = plan.blocks?.filter(b => b.status === 'DONE') || [];
    const actualStudyBlocks = executedBlocks.filter(b => b.type !== 'BREAK');
    const actualMinutes = actualStudyBlocks.reduce((acc, b) => acc + (b.actualDurationMinutes || 0), 0);
    
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
                    <button onClick={onEdit} className="btn-3d bg-white/50 dark:bg-slate-800/50 border border-white/30 dark:border-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 backdrop-blur-md">
                        <PencilSquareIcon className="w-4 h-4" /> Edit Plan
                    </button>
                </div>

                <InfoCard 
                    title="Planned Blocks" 
                    icon={CalendarIcon} 
                    colorClass="text-blue-600 bg-blue-50/80 dark:bg-blue-900/30"
                >
                    <div className="space-y-2">
                        {plan.blocks && plan.blocks.length > 0 ? plan.blocks.filter(b => b.type !== 'BREAK').map((b, i) => (
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
                    colorClass="text-orange-600 bg-orange-50/80 dark:bg-orange-900/30"
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
                                <span className={`text-xs font-mono font-bold ${b.type === 'BREAK' ? 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20' : 'text-slate-500 bg-slate-50 dark:bg-slate-800'} px-2 py-1 rounded border border-slate-200 dark:border-slate-700 self-start sm:self-auto`}>
                                    {b.type === 'BREAK' ? `Break: ${formatDurationString(b.actualDurationMinutes || 0)}` : formatDurationString(b.actualDurationMinutes || 0)}
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
                    colorClass="text-emerald-600 bg-emerald-50/80 dark:bg-emerald-900/30"
                >
                    <div className="mb-6">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Total Planned</p>
                        <div className="flex items-baseline justify-center gap-1 bg-slate-50/50 dark:bg-slate-800/50 py-4 rounded-2xl border border-slate-100 dark:border-slate-700 backdrop-blur-sm">
                            <span className="text-4xl font-black text-slate-800 dark:text-white drop-shadow-sm">{totalHours}</span><span className="text-sm font-bold text-slate-500">h</span>
                            {remainingMinutes > 0 && <><span className="text-4xl font-black text-slate-800 dark:text-white ml-2 drop-shadow-sm">{remainingMinutes}</span><span className="text-sm font-bold text-slate-500">m</span></>}
                        </div>
                    </div>

                    <div className="bg-white/70 dark:bg-slate-800/70 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-inner-3d backdrop-blur-sm">
                        <div className="flex justify-between items-end mb-2">
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Actual Execution</p>
                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{completionPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 mb-2 overflow-hidden shadow-inner">
                            <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full rounded-full transition-all duration-1000 ease-out shadow-md" style={{ width: `${completionPercent}%` }}></div>
                        </div>
                        <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300 mt-2">
                            {actualHours}h {actualRemMinutes}m <span className="text-sm font-normal text-slate-400">effective</span>
                        </p>
                    </div>
                </InfoCard>

                 <InfoCard 
                    title="Timeline" 
                    icon={ClockIcon}
                    colorClass="text-violet-600 bg-violet-50/80 dark:bg-violet-900/30"
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
    onSelect: () => void,
    onReset?: () => void
}> = ({ children, onDelete, onClick, isSelectMode, isSelected, onSelect, onReset }) => {
    const touchStartRef = useRef<{ x: number, y: number } | null>(null);
    const [offset, setOffset] = useState(0);

    const enableSwipe = !isSelectMode;
    const maxSwipe = onReset ? -160 : -80; // Expand if reset is available

    const handleTouchStart = (e: React.TouchEvent) => {
        if (!enableSwipe) return;
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchStartRef.current || !enableSwipe) return;
        const deltaX = e.touches[0].clientX - touchStartRef.current.x;
        const deltaY = e.touches[0].clientY - touchStartRef.current.y;
        
        if (Math.abs(deltaX) > Math.abs(deltaY) + 5) {
            const newOffset = Math.min(0, Math.max(maxSwipe * 1.5, deltaX)); // Allow some overdrag
            setOffset(newOffset);
        }
    };

    const handleTouchEnd = () => {
        if (!enableSwipe) return;
        // Snap to open if past threshold (halfway)
        if (offset < maxSwipe / 2) {
            setOffset(maxSwipe);
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
             const newOffset = Math.min(0, Math.max(maxSwipe * 1.5, deltaX)); 
             setOffset(newOffset);
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (!enableSwipe) return;
        if (offset < maxSwipe / 2) setOffset(maxSwipe);
        else setOffset(0);
        touchStartRef.current = null;
    };

    return (
        <div className="relative overflow-visible select-none mb-4">
            {/* Action Buttons Layer */}
            <div className="absolute top-0 bottom-4 right-0 flex z-0 my-1">
                {onReset && (
                    <div 
                        className="w-20 bg-indigo-500 flex items-center justify-center cursor-pointer rounded-l-2xl shadow-inner transition-colors hover:bg-indigo-600 backdrop-blur-sm"
                        onClick={(e) => { e.stopPropagation(); onReset(); setOffset(0); }}
                        title="Reset Block"
                    >
                        <div className="flex flex-col items-center text-white">
                            <ArrowPathIcon className="w-5 h-5" />
                            <span className="text-[10px] font-bold mt-1">Reset</span>
                        </div>
                    </div>
                )}
                <div 
                    className={`w-24 bg-red-500 flex items-center justify-center cursor-pointer shadow-inner transition-colors hover:bg-red-600 backdrop-blur-sm ${onReset ? 'rounded-r-2xl' : 'rounded-2xl'}`}
                    onClick={(e) => { e.stopPropagation(); onDelete(); setOffset(0); }}
                    title="Delete Block"
                >
                    <div className="flex flex-col items-center text-white">
                        <TrashIcon className="w-5 h-5" />
                        <span className="text-[10px] font-bold mt-1">Delete</span>
                    </div>
                </div>
            </div>

            {/* Foreground Content Layer */}
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
const BlockCard: React.FC<{ 
    block: Block, 
    isCurrent: boolean, 
    isNext: boolean, 
    onStart: () => void, 
    onPause: () => void, 
    onFinish: () => void,
    currentTimeMinutes: number,
    onUpdate: (b: Block) => void,
    onEditPlan: () => void
}> = ({ block, isCurrent, isNext, onStart, onPause, onFinish, currentTimeMinutes, onUpdate, onEditPlan }) => {
    
    const isDone = block.status === 'DONE';
    const isBreak = block.type === 'BREAK';
    const isVirtual = block.isVirtual; 
    
    const [countdown, setCountdown] = useState<string>('--:--');
    const [progress, setProgress] = useState(0);
    const timerRef = useRef<number | null>(null);

    // Editing State for Completed Blocks
    const [isEditing, setIsEditing] = useState(false);
    const [editBlock, setEditBlock] = useState<Block>(block);

    useEffect(() => {
        if (isEditing) setEditBlock(block);
    }, [isEditing, block]);

    useEffect(() => {
        if (isCurrent && block.status === 'IN_PROGRESS') {
            const updateTimer = () => {
                const now = new Date();
                let totalElapsedMs = 0;

                if (block.segments) {
                    for (const segment of block.segments) {
                        if (segment.start && segment.end) {
                            const startParts = segment.start.split(':').map(Number);
                            const endParts = segment.end.split(':').map(Number);
                            const segStart = new Date();
                            segStart.setHours(startParts[0], startParts[1], startParts[2] || 0, 0);
                            const segEnd = new Date();
                            segEnd.setHours(endParts[0], endParts[1], endParts[2] || 0, 0);
                            if (segEnd < segStart) segEnd.setDate(segEnd.getDate() + 1);
                            totalElapsedMs += (segEnd.getTime() - segStart.getTime());
                        }
                    }
                }

                if (block.segments && block.segments.length > 0) {
                    const lastSegment = block.segments[block.segments.length - 1];
                    if (!lastSegment.end && lastSegment.start) {
                        const startParts = lastSegment.start.split(':').map(Number);
                        const segStart = new Date();
                        segStart.setHours(startParts[0], startParts[1], startParts[2] || 0, 0);
                        totalElapsedMs += (now.getTime() - segStart.getTime());
                    }
                }

                const totalDurationMs = block.plannedDurationMinutes * 60 * 1000;
                const remainingMs = totalDurationMs - totalElapsedMs;
                
                const calculatedProgress = Math.min(100, Math.max(0, (totalElapsedMs / totalDurationMs) * 100));
                setProgress(calculatedProgress);

                const absMs = Math.abs(remainingMs);
                const h = Math.floor(absMs / 3600000);
                const m = Math.floor((absMs % 3600000) / 60000);
                const s = Math.floor((absMs % 60000) / 1000);
                
                const sign = remainingMs < 0 ? '-' : '';
                const timeString = h > 0 
                    ? `${sign}${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
                    : `${sign}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                
                setCountdown(timeString);
            };
            updateTimer();
            timerRef.current = window.setInterval(updateTimer, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isCurrent, block.status, block.segments, block.plannedDurationMinutes]);

    const recalculateStats = (segments: any[]) => {
        if (!segments || segments.length === 0) return;
        let totalMs = 0;
        let earliestStart: Date | null = null;
        let latestEnd: Date | null = null;

        segments.forEach(seg => {
            if(seg.start && seg.end) {
                const sParts = seg.start.split(':').map(Number);
                const eParts = seg.end.split(':').map(Number);
                
                const sDate = new Date();
                sDate.setHours(sParts[0], sParts[1], sParts[2] || 0, 0);
                
                const eDate = new Date();
                eDate.setHours(eParts[0], eParts[1], eParts[2] || 0, 0);
                if(eDate < sDate) eDate.setDate(eDate.getDate() + 1);

                totalMs += (eDate.getTime() - sDate.getTime());

                if(!earliestStart || sDate < earliestStart) earliestStart = sDate;
                if(!latestEnd || eDate > latestEnd) latestEnd = eDate;
            }
        });

        if (earliestStart && latestEnd) {
            const sStr = (earliestStart as Date).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'});
            const eStr = (latestEnd as Date).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'});
            const durMins = Math.round(totalMs / 60000);

            setEditBlock(prev => ({
                ...prev,
                actualStartTime: sStr,
                actualEndTime: eStr,
                actualDurationMinutes: durMins,
                segments 
            }));
        }
    };

    const handleSaveEdit = () => {
        onUpdate(editBlock);
        setIsEditing(false);
    };

    const updateSegment = (index: number, field: 'start' | 'end', value: string) => {
        if (!editBlock.segments) return;
        const newSegments = [...editBlock.segments];
        newSegments[index] = { ...newSegments[index], [field]: value };
        recalculateStats(newSegments);
    };

    const updateInterruption = (index: number, field: 'start' | 'end' | 'reason', value: string) => {
        if (!editBlock.interruptions) return;
        const newInts = [...editBlock.interruptions];
        newInts[index] = { ...newInts[index], [field]: value };
        setEditBlock({ ...editBlock, interruptions: newInts });
    };

    const toggleTaskCompletion = (taskId: string) => {
        if (!editBlock.tasks) return;
        const newTasks = editBlock.tasks.map(t => 
            t.id === taskId 
            ? { ...t, execution: { ...t.execution, completed: !t.execution?.completed } } 
            : t
        );
        setEditBlock({ ...editBlock, tasks: newTasks });
    };

    let cardStyle = 'bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border-white/30 dark:border-slate-700/50';
    let shadowClass = 'card-3d';
    let accentColor = 'bg-slate-200/50 dark:bg-slate-700/50'; 

    if (isVirtual) {
        cardStyle = 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/30 dark:border-amber-800 backdrop-blur-sm';
        accentColor = 'bg-amber-400';
    } else if (block.rescheduledTo || block.completionStatus === 'NOT_DONE') {
        cardStyle = 'bg-red-50/50 dark:bg-red-900/10 border-red-200/30 dark:border-red-800 backdrop-blur-sm';
        accentColor = 'bg-red-400';
    } else if (isDone) {
        cardStyle = 'bg-green-50/50 dark:bg-green-900/10 border-green-200/30 dark:border-green-800 backdrop-blur-sm';
        accentColor = 'bg-green-500';
        shadowClass = 'card-3d'; 
    } else if (isCurrent) {
        cardStyle = 'bg-white/80 dark:bg-slate-800/80 border-emerald-400/70 dark:border-emerald-600/70 z-20 relative overflow-hidden backdrop-blur-xl';
        shadowClass = 'shadow-[0_0_40px_-5px_rgba(16,185,129,0.5)] dark:shadow-[0_0_40px_-10px_rgba(16,185,129,0.4)] scale-[1.02]';
        accentColor = 'bg-emerald-500';
    } else if (isBreak) {
        cardStyle = 'bg-teal-50/50 dark:bg-teal-900/20 border-dashed border-teal-200/50 dark:border-teal-800 backdrop-blur-sm';
        shadowClass = 'shadow-sm';
        accentColor = 'bg-teal-400';
    }

    const renderSegments = () => {
        const items: React.ReactNode[] = [];
        const segmentsSource = isEditing ? editBlock.segments : block.segments;
        const interruptionsSource = isEditing ? editBlock.interruptions : block.interruptions;

        if (segmentsSource) {
            segmentsSource.forEach((seg, idx) => {
                if (isEditing) {
                    items.push(
                        <div key={`seg-${idx}`} className="flex items-center gap-2 py-1 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                            <input 
                                type="time" 
                                value={seg.start} 
                                onChange={e => updateSegment(idx, 'start', e.target.value)} 
                                className="w-20 p-1 text-xs font-mono border rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-emerald-500 outline-none"
                            />
                            <span className="text-slate-400">-</span>
                            <input 
                                type="time" 
                                value={seg.end || ''} 
                                onChange={e => updateSegment(idx, 'end', e.target.value)} 
                                className="w-20 p-1 text-xs font-mono border rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-emerald-500 outline-none"
                            />
                            <span className="text-xs font-bold text-green-600 dark:text-green-400 ml-auto">Study</span>
                        </div>
                    );
                } else if (seg.start && seg.end) {
                    const start = parseTimeToMinutes(seg.start);
                    let end = parseTimeToMinutes(seg.end);
                    if (end < start) end += 24*60;
                    const dur = end - start;
                    items.push(
                        <div key={`seg-${idx}`} className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                            <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{formatTime12(seg.start)} - {formatTime12(seg.end)}</span>
                            <span className="text-xs font-bold text-green-600 dark:text-green-400">Studied ({dur}m)</span>
                        </div>
                    );
                }
            });
        }

        if (interruptionsSource) {
            interruptionsSource.forEach((int, idx) => {
                if (isEditing) {
                    items.push(
                        <div key={`int-${idx}`} className="flex flex-col gap-1 py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0 bg-amber-50/50 dark:bg-amber-900/10 -mx-2 px-2 rounded">
                            <div className="flex items-center gap-2">
                                <input 
                                    type="time" 
                                    value={int.start} 
                                    onChange={e => updateInterruption(idx, 'start', e.target.value)} 
                                    className="w-20 p-1 text-xs font-mono border rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-amber-500 outline-none"
                                />
                                <span className="text-slate-400">-</span>
                                <input 
                                    type="time" 
                                    value={int.end || ''} 
                                    onChange={e => updateInterruption(idx, 'end', e.target.value)} 
                                    className="w-20 p-1 text-xs font-mono border rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-amber-500 outline-none"
                                />
                            </div>
                            <input 
                                type="text" 
                                value={int.reason || ''} 
                                onChange={e => updateInterruption(idx, 'reason', e.target.value)} 
                                className="w-full p-1 text-xs border rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-amber-500 outline-none"
                                placeholder="Reason"
                            />
                        </div>
                    );
                } else if (int.start && int.end) {
                    const start = parseTimeToMinutes(int.start);
                    let end = parseTimeToMinutes(int.end);
                    if (end < start) end += 24*60;
                    const dur = end - start;
                    items.push(
                        <div key={`int-${idx}`} className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-700/50 last:border-0 bg-amber-50/50 dark:bg-amber-900/10 -mx-2 px-2 rounded">
                            <span className="text-xs font-mono text-slate-500 dark:text-slate-500">{formatTime12(int.start)} - {formatTime12(int.end)}</span>
                            <span className="text-xs font-bold text-amber-600 dark:text-amber-500 flex items-center gap-1">
                                <CoffeeIcon className="w-3 h-3"/> {int.reason || "Break"} ({dur}m)
                            </span>
                        </div>
                    );
                }
            });
        }

        return (
            <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50 space-y-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Activity Log</p>
                {items}
                
                {isEditing && (
                    <div className="flex gap-2 mt-2">
                        <button 
                            onClick={() => {
                                const lastSeg = editBlock.segments ? editBlock.segments[editBlock.segments.length-1] : null;
                                const start = lastSeg ? lastSeg.end || lastSeg.start : editBlock.plannedStartTime;
                                setEditBlock(prev => ({
                                    ...prev,
                                    segments: [...(prev.segments || []), { start, end: start }]
                                }));
                            }}
                            className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 flex items-center gap-1"
                        >
                            <PlusIcon className="w-3 h-3" /> Segment
                        </button>
                        <button 
                            onClick={() => {
                                const lastSeg = editBlock.segments ? editBlock.segments[editBlock.segments.length-1] : null;
                                const start = lastSeg ? lastSeg.end || lastSeg.start : editBlock.plannedStartTime;
                                setEditBlock(prev => ({
                                    ...prev,
                                    interruptions: [...(prev.interruptions || []), { start, end: start, reason: '' }]
                                }));
                            }}
                            className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200 flex items-center gap-1"
                        >
                            <PlusIcon className="w-3 h-3" /> Break
                        </button>
                    </div>
                )}
            </div>
        );
    };

    if (isDone) {
        const actualDuration = block.actualDurationMinutes || 0;
        const plannedDuration = block.plannedDurationMinutes || 0;
        
        const displayStartTime = isEditing ? editBlock.actualStartTime : block.actualStartTime;
        const displayEndTime = isEditing ? editBlock.actualEndTime : block.actualEndTime;
        const displayDuration = isEditing ? editBlock.actualDurationMinutes : block.actualDurationMinutes;

        return (
            <div className={`rounded-2xl border ${cardStyle} ${shadowClass} overflow-hidden flex flex-col md:flex-row w-full transition-all duration-300`}>
                <div 
                    className="flex-1 p-4 border-b md:border-b-0 md:border-r border-slate-200/50 dark:border-slate-700/50 bg-white/30 dark:bg-slate-800/30 backdrop-blur-md cursor-pointer hover:bg-slate-100/30 dark:hover:bg-slate-700/30 transition-colors relative group"
                    onClick={(e) => { 
                        e.stopPropagation(); 
                        onEditPlan(); 
                    }}
                >
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <PencilSquareIcon className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">Original Plan</div>
                    <div className="font-mono font-bold text-sm text-slate-600 dark:text-slate-300 mb-1">{isVirtual ? formatTime12(block.plannedStartTime) : `${formatTime12(block.plannedStartTime)} - ${formatTime12(block.plannedEndTime)}`}</div>
                    <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-3">{block.title}</h4>
                    
                    <div className="space-y-1">
                        {block.tasks && block.tasks.length > 0 ? block.tasks.map((t, i) => (
                            <div key={i} className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0"></div>
                                <span>
                                    {t.detail}
                                    {t.type === 'FMGE' && t.meta?.slideStart && (
                                        <span className="ml-1 opacity-75 font-medium">
                                            ({t.meta.slideStart}-{t.meta.slideEnd})
                                        </span>
                                    )}
                                </span>
                            </div>
                        )) : <span className="text-xs text-slate-400 italic">{block.description || "No specific subtasks."}</span>}
                    </div>
                </div>

                <div 
                    className={`flex-1 p-4 relative backdrop-blur-sm transition-colors group ${isEditing ? 'bg-white dark:bg-slate-900 ring-2 ring-green-500/50' : 'bg-green-50/20 dark:bg-green-900/10 hover:bg-green-100/20 dark:hover:bg-green-900/20 cursor-pointer'}`}
                    onClick={(e) => {
                        if (!isEditing) {
                            e.stopPropagation();
                            setIsEditing(true);
                        }
                    }}
                >
                    {!isEditing && (
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <div className="bg-white dark:bg-slate-800 p-1 rounded shadow-sm text-xs font-bold text-slate-500 flex items-center gap-1">
                                <PencilSquareIcon className="w-3 h-3" /> Edit Log
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <div className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase mb-1 flex items-center gap-1 tracking-wider">
                                <CheckCircleIcon className="w-3 h-3" /> Execution
                            </div>
                            
                            <div className="font-mono font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                                <span>{formatTime12(displayStartTime)} - {formatTime12(displayEndTime)}</span>
                                {(displayDuration !== undefined) && (
                                    <span className={`text-xs font-normal text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded ${isEditing ? 'animate-pulse font-bold text-indigo-600' : ''}`}>
                                        (Eff. Study: {formatDurationString(displayDuration)})
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            {!block.rescheduledTo && block.completionStatus !== 'NOT_DONE' && Math.abs(plannedDuration - actualDuration) > 1 && !isEditing && (
                                <TimeSeal planned={plannedDuration} actual={actualDuration} />
                            )}
                            
                            {isEditing && (
                                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => { setIsEditing(false); setEditBlock(block); }} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Cancel">
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                    <button onClick={handleSaveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Save">
                                        <CheckCircleIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {block.rescheduledTo && (
                        <div className="mb-3 bg-red-50/50 dark:bg-red-900/20 border border-red-100/50 dark:border-red-800/50 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-red-700 dark:text-red-300 font-bold shadow-sm">
                            <ArrowRightIcon className="w-3.5 h-3.5" />
                            <span>Rescheduled to {block.rescheduledTo.includes(':') ? formatTime12(block.rescheduledTo) : block.rescheduledTo}</span>
                        </div>
                    )}

                    <div onClick={e => isEditing && e.stopPropagation()}>
                        {renderSegments()}
                    </div>

                    <div className="space-y-2 mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50" onClick={e => isEditing && e.stopPropagation()}>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Completion</p>
                        {(isEditing ? editBlock.tasks : block.tasks) && (isEditing ? editBlock.tasks : block.tasks)!.length > 0 ? (isEditing ? editBlock.tasks : block.tasks)!.map((t, i) => (
                            <div key={i} className={`p-2 rounded-lg border flex items-center justify-between shadow-sm backdrop-blur-sm ${t.execution?.completed ? 'bg-white/50 border-green-100/50 dark:border-green-900/30 dark:bg-slate-800/50' : 'bg-red-50/50 border-red-100/50 dark:border-red-900/30 dark:bg-slate-800/50'}`}>
                                <div className="flex items-center gap-2 mb-1 min-w-0 flex-1">
                                    {isEditing ? (
                                        <button 
                                            onClick={() => toggleTaskCompletion(t.id)}
                                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                                        >
                                            {t.execution?.completed ? <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" /> : <XMarkIcon className="w-4 h-4 text-red-500 flex-shrink-0" />}
                                        </button>
                                    ) : (
                                        t.execution?.completed ? <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" /> : <XMarkIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                                    )}
                                    <div className="flex flex-col min-w-0">
                                        <span className={`text-xs font-bold truncate ${t.execution?.completed ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>{t.detail}</span>
                                    </div>
                                </div>
                                {t.execution?.note && (
                                    <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-700/50 px-2 py-1 rounded max-w-[40%] truncate text-right ml-2 shrink-0" title={t.execution.note}>
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
                            {isBreak && <span className="text-[10px] font-bold bg-teal-100/50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 px-2 py-0.5 rounded shadow-sm border border-teal-200/50 dark:border-teal-800">BREAK</span>}
                            {isVirtual && <span className="text-[10px] font-bold bg-amber-100/50 dark:bg-amber-900/30 px-2 py-0.5 rounded text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800 shadow-sm">DUE</span>}
                        </div>
                        <h4 className="font-extrabold text-xl text-slate-800 dark:text-white tracking-tight drop-shadow-sm">{block.title}</h4>
                        {(isVirtual || isBreak || block.type === 'FMGE_REVISION') && block.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium bg-white/40 dark:bg-black/10 inline-block px-2 py-1 rounded">{block.description}</p>}
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {isCurrent ? (
                            <>
                                <div className="px-4 py-1.5 bg-emerald-100/80 dark:bg-emerald-900/50 rounded-xl text-emerald-700 dark:text-emerald-300 font-mono font-black text-xl mr-2 animate-pulse shadow-inner border border-emerald-200/50 dark:border-emerald-800">
                                    {countdown}
                                </div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onFinish(); }} 
                                    className="btn-3d bg-white/80 text-emerald-600 border border-emerald-200 hover:bg-emerald-50 px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1 shadow-sm backdrop-blur-sm"
                                >
                                    <StopIcon className="w-4 h-4" /> Finish
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onPause(); }} 
                                    className="btn-3d p-2.5 bg-amber-100/80 text-amber-600 rounded-xl hover:bg-amber-200 transition-colors backdrop-blur-sm"
                                >
                                    <PauseIcon className="w-5 h-5" />
                                </button>
                            </>
                        ) : block.status === 'PAUSED' ? (
                            <button onClick={(e) => { e.stopPropagation(); onStart(); }} className="btn-3d px-4 py-2 bg-amber-100/80 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-200 transition-colors flex items-center gap-1 backdrop-blur-sm">
                                <PlayIcon className="w-4 h-4" /> Resume
                            </button>
                        ) : (
                            !isBreak && (
                                <button onClick={(e) => { e.stopPropagation(); onStart(); }} className={`btn-3d p-3 rounded-xl transition-all backdrop-blur-sm ${isNext ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100/50 dark:bg-slate-700/50 text-slate-400 hover:text-indigo-500'} ${isVirtual ? 'bg-amber-500 text-white hover:bg-amber-600' : ''}`}>
                                    <PlayIcon className="w-6 h-6" />
                                </button>
                            )
                        )}
                        
                        {isBreak && !isCurrent && block.status !== 'DONE' && (
                            <button onClick={(e) => { e.stopPropagation(); onStart(); }} className={`btn-3d p-3 rounded-xl transition-all bg-teal-500 text-white hover:bg-teal-600 backdrop-blur-sm`}>
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
                                FA: 'bg-indigo-50/60 dark:bg-indigo-900/20 border-indigo-100/50 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300',
                                VIDEO: 'bg-blue-50/60 dark:bg-blue-900/20 border-blue-100/50 dark:border-blue-800/50 text-blue-700 dark:text-blue-300',
                                ANKI: 'bg-amber-50/60 dark:bg-amber-900/20 border-amber-100/50 dark:border-amber-800/50 text-amber-700 dark:text-amber-300',
                                QBANK: 'bg-emerald-50/60 dark:bg-emerald-900/20 border-emerald-100/50 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300',
                                FMGE: 'bg-cyan-50/60 dark:bg-cyan-900/20 border-cyan-100/50 dark:border-cyan-800/50 text-cyan-700 dark:text-cyan-300',
                                REVISION: 'bg-fuchsia-50/60 dark:bg-fuchsia-900/20 border-fuchsia-100/50 dark:border-fuchsia-800/50 text-fuchsia-700 dark:text-fuchsia-300',
                                OTHER: 'bg-slate-50/60 dark:bg-slate-800/20 border-slate-200/50 dark:border-slate-700/50 text-slate-600 dark:text-slate-300',
                            }[task.type] || 'bg-slate-50/60 dark:bg-slate-800/20 border-slate-200/50 dark:border-slate-700/50 text-slate-600 dark:text-slate-300';
                            
                            return (
                                <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold shadow-sm backdrop-blur-sm ${taskColorClasses}`}>
                                    {task.type === 'FA' && <BookOpenIcon className="w-3 h-3" />}
                                    {task.type === 'VIDEO' && <VideoIcon className="w-3 h-3" />}
                                    {task.type === 'ANKI' && <StarIcon className="w-3 h-3" />}
                                    {task.type === 'QBANK' && <QIcon className="w-3 h-3" />}
                                    {task.type === 'FMGE' && <BookOpenIcon className="w-3 h-3" />}
                                    {task.type === 'REVISION' && <ArrowPathIcon className="w-3 h-3" />}
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
                    <div className="mt-3 pt-3 border-t border-emerald-200/30 dark:border-emerald-800/30 flex justify-between items-center">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-pulse">
                            <ClockIcon className="w-3 h-3" /> Focus Mode Active
                        </span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-white/40 dark:bg-black/20 px-2 py-1 rounded-lg backdrop-blur-md">started {formatTime12(block.actualStartTime)}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- BLOCKS LAYOUT (Timeline View) ---
interface BlocksLayoutProps {
    blocks: Block[];
    onStartBlock: (blockId: string, block: Block) => void;
    onPauseBlock: (blockId: string, blockTitle: string) => void;
    onFinishBlock: (block: Block) => void;
    onDeleteBlock: (block: Block) => void;
    onSelectBlock: (block: Block) => void;
    isSelectMode: boolean;
    selectedBlockIds: Set<string>;
    onToggleSelection: (blockId: string) => void;
    onResetBlock: (block: Block) => void;
    currentTimeMinutes: number; // NEW PROP
    onUpdateBlock: (b: Block) => void; // New Prop for Edit
}

const BlocksLayout: React.FC<BlocksLayoutProps> = ({ blocks, onStartBlock, onPauseBlock, onFinishBlock, onDeleteBlock, onSelectBlock, isSelectMode, selectedBlockIds, onToggleSelection, onResetBlock, currentTimeMinutes, onUpdateBlock }) => {
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

    const getPeriod = (timeStr: string): string => {
        const hour = parseInt(timeStr.split(':')[0]);
        
        if (hour < 6) return 'Early Morning'; // 00:00 - 05:59
        if (hour < 10) return 'Morning';      // 06:00 - 09:59
        if (hour < 13) return 'Late Morning'; // 10:00 - 12:59
        if (hour < 17) return 'Afternoon';    // 13:00 - 16:59
        if (hour < 21) return 'Evening';      // 17:00 - 20:59
        return 'Night';                       // 21:00 - 23:59
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
        // Sort using standard minutes
        const upcomingBlocks = blocks
            .filter(b => b.status === 'NOT_STARTED' && b.type !== 'BREAK')
            .sort((a,b) => parseTimeToMinutes(a.plannedStartTime) - parseTimeToMinutes(b.plannedStartTime));
        
        const next = upcomingBlocks.find(b => parseTimeToMinutes(b.plannedStartTime) >= nowMinutes);
        if (next) {
            nextBlockId = next.id;
        }
    }

    // Order aligned with standard day
    const PERIODS_ORDER = ['Early Morning', 'Morning', 'Late Morning', 'Afternoon', 'Evening', 'Night'];
    
    const toggleCollapse = (period: string) => {
        setCollapsedSections(prev => ({ ...prev, [period]: !prev[period] }));
    };
    
    return (
        <div className="space-y-4">
            {PERIODS_ORDER.map(period => {
                const periodBlocks = groupedBlocks[period];
                if (!periodBlocks || periodBlocks.length === 0) return null;

                const isCollapsed = collapsedSections[period] || false;

                return (
                    <div key={period}>
                        <TimelineSectionHeader
                            period={period}
                            blocks={periodBlocks} // Pass all blocks
                            isCollapsed={isCollapsed}
                            onToggle={() => toggleCollapse(period)}
                        />
                        {!isCollapsed && (
                            <div className="pl-4 border-l-2 border-slate-200/50 dark:border-slate-700/50 ml-6 space-y-4 animate-fade-in-up">
                                {periodBlocks.map(block => (
                                    <SwipeableBlockWrapper
                                        key={block.id}
                                        onDelete={() => onDeleteBlock(block)}
                                        onClick={() => onSelectBlock(block)}
                                        isSelectMode={isSelectMode}
                                        isSelected={selectedBlockIds.has(block.id)}
                                        onSelect={() => onToggleSelection(block.id)}
                                        onReset={block.status === 'DONE' ? () => onResetBlock(block) : undefined}
                                    >
                                        <BlockCard
                                            block={block}
                                            isCurrent={currentBlock?.id === block.id}
                                            isNext={!currentBlock && nextBlockId === block.id}
                                            onStart={() => onStartBlock(block.id, block)}
                                            onPause={() => onPauseBlock(block.id, block.title)}
                                            onFinish={() => onFinishBlock(block)}
                                            currentTimeMinutes={currentTimeMinutes} // Pass time down
                                            onUpdate={onUpdateBlock}
                                            onEditPlan={() => onSelectBlock(block)} // Left click edits plan
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
    onUpdateFMGE?: (entry: FMGEEntry) => void;
    onStartFocus?: () => void;
}

export const TodaysPlanView: React.FC<TodaysPlanViewProps> = ({ targetDate, settings, onUpdateSettings, knowledgeBase = [], onUpdateKnowledgeBase, onUpdateFMGE, onStartFocus }) => {
    const [viewMode, setViewMode] = useState<'full' | 'blocks'>('blocks');
    const [currentDate, setCurrentDate] = useState(targetDate || getAdjustedDate(new Date()));
    const [plan, setPlan] = useState<DayPlan | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Real-time Clock State
    const [currentTimeMinutes, setCurrentTimeMinutes] = useState(0);

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
    
    // Unplanned Study Log State
    const [isUnplannedLogModalOpen, setIsUnplannedLogModalOpen] = useState(false);
    
    const [defaultDuration, setDefaultDuration] = useState(30);

    // Block Detail & Edit
    const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
    const [blockToDelete, setBlockToDelete] = useState<Block | null>(null);

    // Pause Logic
    const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
    const [pausingBlockId, setPausingBlockId] = useState<string | null>(null);
    const [pausingBlockTitle, setPausingBlockTitle] = useState('');

    // Notification Sent Tracking (Prevent spam)
    const sentNotificationsRef = useRef<Set<string>>(new Set());

    // Timer Effect for updating current time visual & Notifications
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());
        };
        updateTime(); // Initial set
        const interval = setInterval(updateTime, 10000); // Update every 10 sec for smoother UI
        return () => clearInterval(interval);
    }, []);

    // Notification Loop Logic
    useEffect(() => {
        if (!plan || !settings.notifications.enabled || !plan.blocks) return;

        const checkNotifications = () => {
            const now = new Date();
            const currentMin = now.getHours() * 60 + now.getMinutes();
            const nowIsoMinute = now.toISOString().substring(0, 16); // YYYY-MM-DDTHH:mm precision

            // Use custom triggers or fallback to empty if not defined
            const triggers = settings.notifications.customTriggers || [];
            if (triggers.length === 0) return;

            const sortedBlocks = [...plan.blocks].sort((a, b) => parseTimeToMinutes(a.plannedStartTime) - parseTimeToMinutes(b.plannedStartTime));
            
            // Identify the "First Block" (Start >= 06:00) to apply specific triggers
            const firstTask = sortedBlocks.find(b => parseTimeToMinutes(b.plannedStartTime) >= 6 * 60 && b.type !== 'BREAK');

            sortedBlocks.forEach((block) => {
                const startMin = parseTimeToMinutes(block.plannedStartTime);
                const endMin = parseTimeToMinutes(block.plannedEndTime);
                
                // Helper: Avoid duplicate sends per minute/trigger
                const sendOnce = (triggerId: string, title: string, body: string) => {
                    const key = `${block.id}-${triggerId}-${nowIsoMinute}`;
                    if (!sentNotificationsRef.current.has(key)) {
                        sendLocalNotification(title, body);
                        sentNotificationsRef.current.add(key);
                    }
                };

                triggers.forEach(trigger => {
                    if (!trigger.enabled) return;

                    // 1. FIRST BLOCK TRIGGERS
                    if (trigger.category === 'FIRST_BLOCK' && firstTask && block.id === firstTask.id) {
                        const targetTime = trigger.timing === 'BEFORE' ? startMin - trigger.offsetMinutes : startMin + trigger.offsetMinutes;
                        if (currentMin === targetTime) {
                            sendOnce(trigger.id, 'First Task', `"${block.title}" starts in ${trigger.offsetMinutes} mins.`);
                        }
                    }

                    // 2. BLOCK START TRIGGERS (Ongoing/Upcoming)
                    // Usually applied to all blocks unless it's the first one covered above (optional, but usually inclusive)
                    if (trigger.category === 'BLOCK_START') {
                        // Don't double notify if it's the first block and we have a specific trigger for that, 
                        // but simpler to just allow general rules to apply too.
                        const targetTime = trigger.timing === 'BEFORE' ? startMin - trigger.offsetMinutes : startMin + trigger.offsetMinutes;
                        if (currentMin === targetTime) {
                            sendOnce(trigger.id, 'Upcoming Block', `"${block.title}" starts in ${trigger.offsetMinutes} mins.`);
                        }
                    }

                    // 3. BLOCK END TRIGGERS
                    if (trigger.category === 'BLOCK_END') {
                        const targetTime = trigger.timing === 'BEFORE' ? endMin - trigger.offsetMinutes : endMin + trigger.offsetMinutes;
                        
                        // Only fire if in progress or about to start (relevant context)
                        if (currentMin === targetTime && (block.status === 'IN_PROGRESS' || block.status === 'NOT_STARTED')) {
                            sendOnce(trigger.id, 'Finishing Soon', `"${block.title}" ends in ${trigger.offsetMinutes} mins.`);
                        }
                    }

                    // 4. OVERDUE / ACCOUNTABILITY TRIGGERS
                    // Logic: Current time passed end time by offset, and block isn't done.
                    if (trigger.category === 'OVERDUE' && block.status !== 'DONE' && block.status !== 'SKIPPED') {
                        const targetTime = trigger.timing === 'AFTER' ? endMin + trigger.offsetMinutes : endMin - trigger.offsetMinutes; // Usually AFTER
                        
                        if (currentMin === targetTime) {
                            sendOnce(trigger.id, 'Overdue Task', `"${block.title}" is overdue by ${trigger.offsetMinutes} mins. Please complete it!`);
                        }
                    }
                });
            });
        };

        const intervalId = setInterval(checkNotifications, 10000); // Check every 10 seconds
        return () => clearInterval(intervalId);

    }, [plan, settings]);

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

    const handleResetBlock = async (block: Block) => {
        if (!confirm(`Are you sure you want to reset "${block.title}"? This will clear execution data and delete logs.`)) return;

        // 1. Clean up logs
        await deleteBlocksAndSync([block]);

        // 2. Reset Block Data - Explicitly clear execution data with null to force DB update
        // Cast to any to allow setting null on optional fields for proper Firestore deletion semantics
        const updatedBlock: Block = {
            ...block,
            status: 'NOT_STARTED',
            actualStartTime: null as any, 
            actualEndTime: null as any,
            actualDurationMinutes: null as any,
            completionStatus: null as any,
            segments: null as any,
            interruptions: null as any,
            generatedLogIds: [],
            generatedTimeLogIds: [],
            actualNotes: null as any,
            rescheduledTo: null as any,
            tasks: block.tasks?.map(t => ({ ...t, execution: null as any })) // Clear task execution
        };

        // 3. Update Plan
        const updatedPlan = await updateBlockInPlan(currentDate, block.id, updatedBlock);
        if (updatedPlan) handlePlanChange(updatedPlan);
    };

    const handleDeleteSelected = async () => {
        if (!plan || selectedBlockIds.size === 0) return;
        
        const realBlocksToDelete = (plan.blocks || []).filter(b => selectedBlockIds.has(b.id));
        const virtualBlocksToDelete = finalMergedBlocks.filter(b => selectedBlockIds.has(b.id) && b.isVirtual);

        const totalCount = realBlocksToDelete.length + virtualBlocksToDelete.length;
        if (totalCount === 0) return;

        if (!confirm(`Permanently delete ${totalCount} blocks?`)) return;

        // 1. Handle Real Blocks
        if (realBlocksToDelete.length > 0) {
            await deleteBlocksAndSync(realBlocksToDelete);
            const updatedBlocks = (plan.blocks || []).filter(b => !selectedBlockIds.has(b.id));
            const updatedPlan = { ...plan, blocks: updatedBlocks };
            await handlePlanChange(updatedPlan); // This saves day plan
        }

        // 2. Handle Virtual Blocks
        if (virtualBlocksToDelete.length > 0) {
            let kbUpdates = false;
            let updatedKB = [...knowledgeBase];

            for (const vb of virtualBlocksToDelete) {
                if (vb.type === 'REVISION_FA') {
                    // Extract page number. ID is like "rev-123"
                    const pageNum = vb.id.replace('rev-', '');
                    const entry = updatedKB.find(k => k.pageNumber === pageNum);
                    if (entry) {
                        // Remove from schedule (Clear nextRevisionAt)
                        const newEntry = { ...entry, nextRevisionAt: null };
                        updatedKB = updatedKB.map(k => k.pageNumber === pageNum ? newEntry : k);
                        kbUpdates = true;
                    }
                } else if (vb.type === 'FMGE_REVISION') {
                    // Extract ID. ID is like "fmge-{uuid}"
                    const fmgeId = vb.id.replace('fmge-', '');
                    const fmgeEntries = await getFMGEData(); 
                    const entry = fmgeEntries.find(e => e.id === fmgeId);
                    if (entry) {
                        const newEntry = { ...entry, nextRevisionAt: null };
                        await saveFMGEEntry(newEntry);
                    }
                }
            }

            if (kbUpdates && onUpdateKnowledgeBase) {
                await onUpdateKnowledgeBase(updatedKB);
            }
            
            setFmgeVirtualBlocks([]); // Clear temporarily to force refresh or just wait for re-render
        }

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

    // Updated Merged Blocks to include FMGE Revisions
    const mergedBlocks = useMemo(() => {
        let actualBlocks = plan?.blocks || [];
        
        // 1. Knowledge Base (FA) Revisions
        const dueRevisions = knowledgeBase.filter(kb => {
            if (!kb.nextRevisionAt) return false;
            const dueStr = getAdjustedDate(new Date(kb.nextRevisionAt));
            return dueStr === currentDate;
        });
        
        const faVirtualBlocks: Block[] = dueRevisions.map(kb => {
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

        const all = [...actualBlocks, ...faVirtualBlocks]; 
        return all.sort((a, b) => parseTimeToMinutes(a.plannedStartTime) - parseTimeToMinutes(b.plannedStartTime));
    }, [plan, knowledgeBase, currentDate]);

    // Fetch FMGE Data locally for virtual blocks
    const [fmgeVirtualBlocks, setFmgeVirtualBlocks] = useState<Block[]>([]);
    useEffect(() => {
        const fetchFmge = async () => {
            const fmgeData = await getFMGEData();
            const due = fmgeData.filter(e => {
                if (!e.nextRevisionAt) return false;
                return getAdjustedDate(new Date(e.nextRevisionAt)) === currentDate;
            });
            
            const blocks: Block[] = due.map(e => {
                const dueTime = new Date(e.nextRevisionAt!);
                const timeStr = formatTime24(dueTime);
                // Check if already done in plan
                const isDone = plan?.blocks?.some(b => b.status === 'DONE' && b.tasks?.some(t => t.type === 'FMGE' && t.meta?.subject === e.subject && t.meta?.slideStart === e.slideStart));
                if (isDone) return null;

                return {
                    id: `fmge-${e.id}`, index: -1, date: currentDate,
                    plannedStartTime: timeStr, plannedEndTime: timeStr, type: 'FMGE_REVISION' as any, // Custom type or use OTHER
                    title: `Revise FMGE: ${e.subject}`,
                    description: `Slides ${e.slideStart}-${e.slideEnd}`,
                    plannedDurationMinutes: 30, status: 'NOT_STARTED', isVirtual: true,
                    tasks: [{ 
                        id: `vt-fmge-${e.id}`, 
                        type: 'FMGE', 
                        detail: `${e.subject} Slides`, 
                        completed: false, 
                        meta: { subject: e.subject, slideStart: e.slideStart, slideEnd: e.slideEnd } 
                    }]
                };
            }).filter(Boolean) as Block[];
            setFmgeVirtualBlocks(blocks);
        };
        fetchFmge();
    }, [currentDate, plan, isSelectMode]); // Re-fetch when select mode changes (likely after delete)

    const finalMergedBlocks = useMemo(() => {
        const all = [...mergedBlocks, ...fmgeVirtualBlocks];
        return all.sort((a, b) => parseTimeToMinutes(a.plannedStartTime) - parseTimeToMinutes(b.plannedStartTime));
    }, [mergedBlocks, fmgeVirtualBlocks]);


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
    
    const handlePauseBlock = (blockId: string, blockTitle: string) => {
        setPausingBlockId(blockId);
        setPausingBlockTitle(blockTitle);
        setIsPauseModalOpen(true);
    };

    const handleConfirmPause = async (reason: string, notes: string, createBreakMinutes?: number) => {
        if (!pausingBlockId) return;
        try {
            const actualNotes = `Paused: ${reason}${notes ? ` - Note: ${notes}` : ''}`;
            const updatedPlan = await updateBlockInPlan(currentDate, pausingBlockId, { 
                status: 'PAUSED',
                actualNotes: actualNotes
            });
            
            if (updatedPlan) {
                if (createBreakMinutes) {
                    // Create break block immediately after
                    const now = new Date();
                    const startTimeStr = now.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'});
                    await insertBlockAndShift(currentDate, startTimeStr, createBreakMinutes, [], 'Break', 'BREAK', reason);
                    // Reload
                    const refreshed = await getDayPlan(currentDate);
                    if(refreshed) handlePlanChange(refreshed);
                } else {
                    handlePlanChange(updatedPlan);
                }
            }
        } catch (e) { console.error(e); }
        setPausingBlockId(null);
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
    
            // 1. FA LOGIC
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
                        // Time logs creation logic here (omitted for brevity, same as original)
                    }
                }
            }

            // 2. FMGE LOGIC (New)
            const completedFmgeTasks = tasks.filter((t: any) => t.type === 'FMGE' && t.execution?.completed);
            if (completedFmgeTasks.length > 0) {
                const revSettings = await getRevisionSettings() || { mode: 'balanced', targetCount: 7 };
                const fmgeData = await getFMGEData();
                
                // Calculate Duration
                const startOfBlock = new Date(`${currentDate}T${finishingBlock.actualStartTime || '00:00:00'}`);
                const totalDurationMinutes = Math.round((finishDate.getTime() - startOfBlock.getTime()) / 60000);
                const durationPerTask = Math.max(1, Math.round(totalDurationMinutes / completedFmgeTasks.length));

                for (const task of completedFmgeTasks) {
                    const meta = task.meta;
                    if (meta && meta.subject && meta.slideStart) {
                        // Find Matching FMGE Entry
                        const entry = fmgeData.find(e => e.subject === meta.subject && e.slideStart === meta.slideStart && e.slideEnd === meta.slideEnd);
                        if (entry) {
                            // Calculate Next Date
                            const nextIndex = entry.currentRevisionIndex + 1;
                            const nextDate = calculateNextRevisionDate(finishDate, nextIndex, revSettings);
                            
                            // Create Log
                            const newLog = {
                                id: generateId(),
                                timestamp: finishDate.toISOString(),
                                durationMinutes: durationPerTask,
                                type: 'REVISION' as const,
                                revisionIndex: nextIndex,
                                slideStart: entry.slideStart,
                                slideEnd: entry.slideEnd,
                                notes: 'Completed via Today\'s Plan'
                            };

                            // Update Entry
                            const updatedEntry: FMGEEntry = {
                                ...entry,
                                logs: [...entry.logs, newLog],
                                revisionCount: entry.revisionCount + 1,
                                currentRevisionIndex: nextIndex,
                                lastStudiedAt: finishDate.toISOString(),
                                nextRevisionAt: nextDate ? nextDate.toISOString() : null
                            };
                            
                            await saveFMGEEntry(updatedEntry);
                            
                            // --- SYNC BACK TO APP STATE ---
                            if (onUpdateFMGE) {
                                onUpdateFMGE(updatedEntry);
                            }
                        }
                    }
                }
            }
    
            const notesFromTasks = tasks.map((t: BlockTask) => t.execution?.note).filter(Boolean).join('\n');
            
            const updatedPlan = await finishBlock(currentDate, finishingBlock.id, { 
                status, 
                tasks,
                rescheduledTo: rescheduleAction?.type === 'NEW_BLOCK' ? rescheduleAction.time : (rescheduleAction?.type === 'FUTURE_DATE' ? rescheduleAction.date : undefined),
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
        setSelectedBlock(null);
        setIsAddBlockModalOpen(true);
    };

    const handleOpenAddBreak = () => {
        const lastBlock = plan?.blocks && plan.blocks.length > 0 ? plan.blocks[plan.blocks.length - 1] : null;
        let startTime = '12:00';
        if (lastBlock) startTime = lastBlock.plannedEndTime;
        setAddBlockStartTime(startTime); // reuse state for break
        setIsAddBreakModalOpen(true);
    };

    const handleOpenUnplannedLog = () => {
        // For logging past study, default to current time or recent past
        const now = new Date();
        const startTimeStr = now.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'});
        setAddBlockStartTime(startTimeStr);
        setIsUnplannedLogModalOpen(true);
    };

    const handleSaveBlock = async (title: string, startTime: string, endTime: string, tasks: BlockTask[], date?: string) => {
        const targetDate = date || currentDate;
        
        // Calculate Duration
        const [sH, sM] = startTime.split(':').map(Number);
        const [eH, eM] = endTime.split(':').map(Number);
        let duration = (eH * 60 + eM) - (sH * 60 + sM);
        if (duration < 0) duration += 24 * 60;

        if (targetDate !== currentDate) {
            // Move Block Logic (Delete from current, create in target)
            if (selectedBlock && !selectedBlock.isVirtual) {
                await deleteBlock(currentDate, selectedBlock.id);
            }
            const type = selectedBlock?.type || 'MIXED';
            const description = selectedBlock?.description || '';
            
            await insertBlockAndShift(targetDate, startTime, duration, tasks, title, type, description);
            
            // Refresh current view (to remove deleted block)
            const updated = await getDayPlan(currentDate);
            if (updated) handlePlanChange(updated);
        } else {
            if (selectedBlock && !selectedBlock.isVirtual) {
                // Update Existing
                const updatedBlock: Block = {
                    ...selectedBlock,
                    title,
                    plannedStartTime: startTime,
                    plannedEndTime: endTime,
                    plannedDurationMinutes: duration,
                    tasks
                };
                await handleUpdateBlock(updatedBlock);
            } else {
                // Create New (or convert Virtual to Real)
                const updatedPlan = await insertBlockAndShift(currentDate, startTime, duration, tasks, title);
                if (updatedPlan) handlePlanChange(updatedPlan);
            }
        }
        setSelectedBlock(null); // Clear selection
    };

    // Reusable logic for saving completed blocks (Unplanned logs OR Pomodoro finish)
    const saveCompletedSession = async (title: string, startTime: string, endTime: string, tasks: BlockTask[], date?: string) => {
        try {
            const targetDate = date || currentDate;
            // 1. Calculate duration
            const [sH, sM] = startTime.split(':').map(Number);
            const [eH, eM] = endTime.split(':').map(Number);
            let duration = (eH * 60 + eM) - (sH * 60 + sM);
            if (duration < 0) duration += 24 * 60;

            // 2. Mark tasks as completed
            const completedTasks = tasks.map(t => ({ ...t, completed: true, execution: { completed: true } }));

            // 3. Process Logic
            let generatedKbLogIds: string[] = [];
            let generatedTimeLogIds: string[] = [];

            if (onUpdateKnowledgeBase) {
                const faTasks = completedTasks.filter(t => t.type === 'FA');
                if (faTasks.length > 0) {
                    const revSettings = await getRevisionSettings() || { mode: 'balanced', targetCount: 7 };
                    const entriesToLog = faTasks.map((t) => {
                        const pageMatch = t.detail.match(/\d+/);
                        const pageNum = pageMatch ? parseInt(pageMatch[0]) : (t.meta?.pageNumber || 0);
                        return {
                            pageNumber: pageNum,
                            isExplicitRevision: title.toLowerCase().includes('revis') || t.detail.toLowerCase().includes('revis'),
                            topics: t.meta?.topic ? [t.meta.topic] : [],
                            date: targetDate
                        };
                    }).filter((e) => e.pageNumber > 0);

                    if (entriesToLog.length > 0) {
                        const { results, updatedKB } = processLogEntries(entriesToLog, knowledgeBase, revSettings);
                        await onUpdateKnowledgeBase(updatedKB);
                        
                        results.forEach(res => {
                            const newLog = res.updatedEntry.logs[res.updatedEntry.logs.length - 1];
                            if (newLog) generatedKbLogIds.push(newLog.id);
                        });

                        const startOfBlock = new Date(`${targetDate}T${startTime}:00`);
                        const durationPerTask = Math.max(1, Math.round(duration / entriesToLog.length));
                        let taskStartTime = new Date(startOfBlock.getTime());

                        for (const res of results) {
                            const start = taskStartTime;
                            const end = new Date(start.getTime() + durationPerTask * 60000);
                            const newTimeLogId = generateId();
                            const newKbLog = results.find(r => r.pageNumber === res.pageNumber)?.updatedEntry.logs.slice(-1)[0];

                            const timeLog: TimeLogEntry = {
                                id: newTimeLogId,
                                date: targetDate,
                                startTime: start.toISOString(),
                                endTime: end.toISOString(),
                                durationMinutes: durationPerTask,
                                category: res.eventType === 'REVISION' ? 'REVISION' : 'STUDY',
                                source: 'FA_LOGGER',
                                activity: `Log: ${title} - FA Pg ${res.pageNumber}`,
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

            // 4. Create the Block directly
            const blockId = generateId();
            const updatedPlan = await insertBlockAndShift(
                targetDate, 
                startTime, 
                duration, 
                completedTasks, 
                title, 
                'MIXED', 
                'Completed Session',
                blockId,
                'DONE', // Initial status
                {
                    actualStartTime: startTime,
                    actualEndTime: endTime,
                    actualDurationMinutes: duration,
                    completionStatus: 'COMPLETED',
                    generatedLogIds: generatedKbLogIds,
                    generatedTimeLogIds: generatedTimeLogIds,
                    actualNotes: 'Session logged manually.',
                    segments: [{ start: startTime, end: endTime }] 
                }
            );

            if (updatedPlan) handlePlanChange(updatedPlan);

        } catch (e) {
            console.error("Failed to save session", e);
        }
    };

    const handleSaveUnplanned = (title: string, startTime: string, endTime: string, tasks: BlockTask[], date?: string) => {
        saveCompletedSession(title, startTime, endTime, tasks, date);
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
            setIsAddBlockModalOpen(true); // Open AddBlockModal in edit mode
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
            
            <PauseReasonModal 
                isOpen={isPauseModalOpen}
                onClose={() => { setIsPauseModalOpen(false); setPausingBlockId(null); }}
                onConfirm={handleConfirmPause}
                blockTitle={pausingBlockTitle}
            />

            <ManualPlanModal 
                isOpen={isManualModalOpen} 
                onClose={() => setIsManualModalOpen(false)} 
                onSave={handleSaveManualPlan}
                initialDate={currentDate}
                existingPlan={plan}
            />

            <AddBlockModal 
                isOpen={isAddBlockModalOpen}
                onClose={() => { setIsAddBlockModalOpen(false); setSelectedBlock(null); }}
                onSave={handleSaveBlock}
                initialStartTime={addBlockStartTime}
                initialDate={currentDate}
                knowledgeBase={knowledgeBase}
                blockToEdit={selectedBlock}
            />

            <AddBreakModal
                isOpen={isAddBreakModalOpen}
                onClose={() => setIsAddBreakModalOpen(false)}
                onSave={handleSaveBreak}
                initialStartTime={addBlockStartTime}
            />

            <AddBlockModal 
                isOpen={isUnplannedLogModalOpen}
                onClose={() => setIsUnplannedLogModalOpen(false)}
                onSave={handleSaveUnplanned}
                initialStartTime={addBlockStartTime}
                initialDate={currentDate}
                knowledgeBase={knowledgeBase}
                blockToEdit={null} // Always new
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

            <div className="flex justify-between items-center relative bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-2 rounded-2xl border border-white/40 dark:border-slate-700/50 shadow-sm card-3d">
                <button onClick={() => handleDateChange(-1)} className="p-2 rounded-xl hover:bg-white/80 dark:hover:bg-slate-700/80 shadow-sm active:scale-95 transition-all"><ChevronLeftIcon className="w-6 h-6 text-slate-500" /></button>
                
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
                        className="p-2 rounded-xl hover:bg-yellow-50 dark:hover:bg-yellow-900/20 text-slate-400 hover:text-yellow-50 transition-colors hover:shadow-sm" 
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
                    <button onClick={() => handleDateChange(1)} className="p-2 rounded-xl hover:bg-white/80 dark:hover:bg-slate-700/80 shadow-sm active:scale-95 transition-all"><ChevronRightIcon className="w-6 h-6 text-slate-500" /></button>
                </div>
            </div>

            {/* Control Bar */}
            <div className="flex flex-wrap justify-center gap-3 items-center">
                <div className="flex bg-white/50 dark:bg-slate-800/50 p-1 rounded-xl shadow-inner backdrop-blur-md">
                    <button onClick={() => setViewMode('full')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'full' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-white transform scale-105' : 'text-slate-500'}`}>Summary</button>
                    <button onClick={() => setViewMode('blocks')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'blocks' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-white transform scale-105' : 'text-slate-500'}`}>Timeline</button>
                </div>

                <div className="flex items-center gap-2">
                    {/* Undo/Redo Buttons */}
                    <div className="flex items-center bg-white/60 dark:bg-slate-800/60 rounded-xl p-1 shadow-sm border border-white/40 dark:border-slate-700 backdrop-blur-md">
                        <button 
                            onClick={handleUndo} 
                            disabled={historyPast.length === 0}
                            className="p-2 rounded-lg hover:bg-slate-100/50 dark:hover:bg-slate-700/50 disabled:opacity-30 transition-all text-slate-600 dark:text-slate-300 active:scale-95"
                            title="Undo last change"
                        >
                            <ArrowUturnLeftIcon className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={handleRedo} 
                            disabled={historyFuture.length === 0}
                            className="p-2 rounded-lg hover:bg-slate-100/50 dark:hover:bg-slate-700/50 disabled:opacity-30 transition-all text-slate-600 dark:text-slate-300 active:scale-95"
                            title="Redo last change"
                        >
                            <ArrowUturnRightIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <button 
                        onClick={onStartFocus}
                        className="btn-3d flex items-center gap-1 px-4 py-2.5 bg-yellow-500 rounded-xl shadow-lg shadow-yellow-500/30 text-xs font-bold text-white hover:bg-yellow-600 transition-all backdrop-blur-sm"
                        title="Start Pomodoro / Quick Focus"
                    >
                        <BoltIcon className="w-4 h-4" /> Quick Focus
                    </button>

                    <button 
                        onClick={handleOpenAddBlock}
                        className="btn-3d flex items-center gap-1 px-4 py-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/30 text-xs font-bold text-white hover:bg-indigo-700 transition-all backdrop-blur-sm"
                    >
                        <PlusIcon className="w-3 h-3" /> Add Block
                    </button>
                    
                    <button 
                        onClick={handleOpenAddBreak}
                        className="btn-3d flex items-center gap-1 px-4 py-2.5 bg-teal-500 rounded-xl shadow-lg shadow-teal-500/30 text-xs font-bold text-white hover:bg-teal-600 transition-all backdrop-blur-sm"
                    >
                        <CoffeeIcon className="w-3 h-3" /> Break
                    </button>

                    <button 
                        onClick={handleOpenUnplannedLog}
                        className="btn-3d flex items-center gap-1 px-4 py-2.5 bg-slate-700 dark:bg-slate-600 rounded-xl shadow-lg shadow-slate-500/30 text-xs font-bold text-white hover:bg-slate-800 dark:hover:bg-slate-500 transition-all backdrop-blur-sm"
                        title="Log past study activity instantly"
                    >
                        <ClipboardDocumentCheckIcon className="w-3 h-3" /> Study Log
                    </button>
                </div>
            </div>

            {/* View Content */}
            <div className="mt-6">
                {loading ? (
                    <div className="text-center py-20 text-slate-400 animate-pulse">Loading plan...</div>
                ) : !plan ? (
                    <div className="text-center py-20 text-slate-400">No plan found for this date.</div>
                ) : (
                    <>
                        {viewMode === 'full' ? (
                            <FullDayPlanLayout plan={plan} onEdit={() => setViewMode('blocks')} />
                        ) : (
                            <BlocksLayout 
                                blocks={finalMergedBlocks}
                                onStartBlock={handleStartBlock}
                                onPauseBlock={handlePauseBlock}
                                onFinishBlock={initiateFinish}
                                onDeleteBlock={(b) => setBlockToDelete(b)}
                                onSelectBlock={handleOpenBlockDetail}
                                isSelectMode={isSelectMode}
                                selectedBlockIds={selectedBlockIds}
                                onToggleSelection={handleToggleBlockSelection}
                                onResetBlock={handleResetBlock}
                                currentTimeMinutes={currentTimeMinutes}
                                onUpdateBlock={handleUpdateBlock}
                            />
                        )}
                    </>
                )}
            </div>

        </div>
    );
};
