
import React, { useState, useEffect, useRef } from 'react';
import { Block, BlockTask, KnowledgeBaseEntry, SYSTEMS, CATEGORIES, TimeLogEntry, DayPlan } from '../types';
import { XMarkIcon, PlayIcon, PauseIcon, StopIcon, PlusIcon, TrashIcon, BookOpenIcon, VideoIcon, StarIcon, QIcon, ArrowPathIcon, ChevronLeftIcon, CheckCircleIcon, ClockIcon, ListCheckIcon, SparklesIcon, ChevronDownIcon, CalendarIcon } from './Icons';
import { generateBlocks } from '../services/blockGenerator';
import { insertBlockAndShift, finishBlock, updateBlockInPlan } from '../services/planService';
import { saveTimeLog } from '../services/timeLogService';
import { processLogEntries } from '../services/faLoggerService';
import { getRevisionSettings, getDayPlan } from '../services/firebase';
import { PauseReasonModal } from './PauseReasonModal';

interface FocusTimerViewProps {
    onBack: () => void;
    knowledgeBase: KnowledgeBaseEntry[];
    onUpdateKnowledgeBase: (newKB: KnowledgeBaseEntry[]) => Promise<void>;
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

// --- Circular Slider Math ---
const RADIUS = 120;
const CENTER = 150; // SVG size 300x300
const MAX_MINUTES = 120;

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
};

const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
        "M", start.x, start.y, 
        "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
};

const BlockSelectorModal: React.FC<{ 
    isOpen: boolean, 
    onClose: () => void, 
    onSelect: (block: Block) => void 
}> = ({ isOpen, onClose, onSelect }) => {
    const [plan, setPlan] = useState<DayPlan | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            const today = new Date().toLocaleDateString('en-CA');
            getDayPlan(today).then(p => {
                setPlan(p);
                setLoading(false);
            });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const pendingBlocks = plan?.blocks?.filter(b => b.status === 'NOT_STARTED' || b.status === 'PAUSED' || b.status === 'IN_PROGRESS') || [];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 dark:text-white">Select from Today's Plan</h3>
                    <button onClick={onClose}><XMarkIcon className="w-5 h-5 text-slate-400" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {loading ? <p className="text-center text-slate-400 text-sm">Loading...</p> : 
                     pendingBlocks.length === 0 ? <p className="text-center text-slate-400 text-sm">No pending tasks found for today.</p> :
                     pendingBlocks.map(block => (
                         <div key={block.id} onClick={() => onSelect(block)} className="p-3 rounded-xl border border-slate-100 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer transition-colors group">
                             <div className="flex justify-between items-start">
                                 <div>
                                     <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">{block.title}</p>
                                     <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">{block.plannedStartTime} - {block.plannedEndTime}</p>
                                 </div>
                                 <span className="text-[10px] font-bold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">SELECT</span>
                             </div>
                         </div>
                     ))
                    }
                </div>
            </div>
        </div>
    );
};

export const FocusTimerView: React.FC<FocusTimerViewProps> = ({ onBack, knowledgeBase, onUpdateKnowledgeBase }) => {
    // Timer State
    const [durationMinutes, setDurationMinutes] = useState(25);
    const [elapsedSeconds, setElapsedSeconds] = useState(0); 
    const [timerState, setTimerState] = useState<'IDLE' | 'RUNNING' | 'PAUSED'>('IDLE');
    
    // Timer Logic Refs
    const timerRef = useRef<number | null>(null);
    const startTimeRef = useRef<number | null>(null); // Timestamp when START was clicked (last active segment)
    const accumulatedTimeRef = useRef<number>(0); // Seconds accumulated before current segment

    const [startTimeStr, setStartTimeStr] = useState<string>('');

    // Pause Tracking
    const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
    const [pauseTimestamp, setPauseTimestamp] = useState<Date | null>(null);
    const [pendingPauseReason, setPendingPauseReason] = useState<string>('Pause');
    const [interruptions, setInterruptions] = useState<{start: string, end: string, reason: string}[]>([]);

    // Session State
    const [sessionTitle, setSessionTitle] = useState('Focus Session');
    const [tasks, setTasks] = useState<BlockTask[]>([]);
    
    // Today's Plan Integration
    const [linkedBlockId, setLinkedBlockId] = useState<string | null>(null);
    const [isBlockSelectorOpen, setIsBlockSelectorOpen] = useState(false);
    
    // Auto-Time Calculation State
    const [lastTaskEndTime, setLastTaskEndTime] = useState<Date | null>(null);

    // UI
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Circular Slider Ref
    const svgRef = useRef<SVGSVGElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Wake Lock Logic
    const wakeLockRef = useRef<any>(null);

    const requestWakeLock = async () => {
        if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
            try {
                wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
            } catch (err) {
                console.warn(`Wake Lock request failed: ${err}`);
            }
        }
    };

    const releaseWakeLock = async () => {
        if (wakeLockRef.current) {
            try {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
            } catch (err) {
                console.warn(`Wake Lock release failed: ${err}`);
            }
        }
    };

    // Handle Wake Lock Lifecycle
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && timerState === 'RUNNING') {
                requestWakeLock();
            }
        };

        if (timerState === 'RUNNING') {
            requestWakeLock();
            document.addEventListener('visibilitychange', handleVisibilityChange);
        } else {
            releaseWakeLock();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        }

        return () => {
            releaseWakeLock();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [timerState]);

    // Initial Start Time Capture
    useEffect(() => {
        // Reset when component mounts (or remounts)
        resetSessionState();
    }, []);

    const resetSessionState = () => {
        const now = new Date();
        setStartTimeStr(now.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'}));
        setLastTaskEndTime(now);
        setDurationMinutes(25);
        setElapsedSeconds(0);
        setTimerState('IDLE');
        setSessionTitle('Focus Session');
        setTasks([]);
        setLinkedBlockId(null);
        setInterruptions([]);
        accumulatedTimeRef.current = 0;
        startTimeRef.current = null;
        if (timerRef.current) clearInterval(timerRef.current);
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const startTimer = () => {
        if (timerState === 'RUNNING') return;

        // If resuming from pause, log the interruption
        if (timerState === 'PAUSED' && pauseTimestamp) {
            const now = new Date();
            const startStr = pauseTimestamp.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'});
            const endStr = now.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'});
            
            // Only log if at least 1 minute passed
            if (now.getTime() - pauseTimestamp.getTime() > 60000) {
                setInterruptions(prev => [...prev, {
                    start: startStr,
                    end: endStr,
                    reason: pendingPauseReason
                }]);
            }
            setPauseTimestamp(null);
        } else if (timerState === 'IDLE') {
             // Fresh start
             const now = new Date();
             setStartTimeStr(now.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'}));
             setLastTaskEndTime(now);
        }

        startTimeRef.current = Date.now();
        setTimerState('RUNNING');

        timerRef.current = window.setInterval(() => {
            if (startTimeRef.current) {
                const now = Date.now();
                const deltaSeconds = Math.floor((now - startTimeRef.current) / 1000);
                setElapsedSeconds(accumulatedTimeRef.current + deltaSeconds);
            }
        }, 1000);
    };

    const handlePauseClick = () => {
        if (timerState !== 'RUNNING') return;

        // Stop Timer Loop
        if (timerRef.current) clearInterval(timerRef.current);
        
        // Calculate accumulated time
        if (startTimeRef.current) {
            const now = Date.now();
            const deltaSeconds = Math.floor((now - startTimeRef.current) / 1000);
            accumulatedTimeRef.current += deltaSeconds;
        }
        
        // Set State
        setTimerState('PAUSED');
        setElapsedSeconds(accumulatedTimeRef.current); 
        startTimeRef.current = null;
        
        // Record Pause Start Time & Open Modal
        setPauseTimestamp(new Date());
        setIsPauseModalOpen(true);
    };

    const handlePauseConfirm = (reason: string, notes: string) => {
        // Just store the reason. The actual logging happens when (and if) they resume.
        setPendingPauseReason(reason);
        // If notes provided, maybe append to session title or store temporarily? 
        // For now, simpler to just track reason for the timeline.
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (timerState !== 'IDLE') return; 
        e.preventDefault(); 
        setIsDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        handlePointerMove(e);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging || !svgRef.current) return;
        e.preventDefault();
        const rect = svgRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        
        const x = e.clientX - cx;
        const y = e.clientY - cy;
        
        let angleDeg = Math.atan2(y, x) * (180 / Math.PI);
        angleDeg += 90; 
        if (angleDeg < 0) angleDeg += 360;
        
        let rawMins = (angleDeg / 360) * MAX_MINUTES;
        // Fixed: Use 1-minute increments for smoother sliding
        let snappedMins = Math.round(rawMins);
        
        if (snappedMins <= 0) snappedMins = 120;
        
        setDurationMinutes(snappedMins);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.currentTarget && e.currentTarget.releasePointerCapture) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
    };

    const formatTimeDisplay = () => {
        if (timerState === 'IDLE') {
            return `${durationMinutes}:00`;
        }
        const totalSeconds = durationMinutes * 60;
        const remaining = Math.max(0, totalSeconds - elapsedSeconds);
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // --- Task Logic ---
    const addTask = (type: BlockTask['type']) => {
        // Auto-calculate time
        const now = new Date();
        const start = lastTaskEndTime || new Date(); // Use end of previous task or start of session
        
        const startStr = start.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'});
        const endStr = now.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'});
        
        // Update pointer for next task
        setLastTaskEndTime(now);

        const newTask: BlockTask = {
            id: generateId(),
            type,
            detail: '',
            completed: true, 
            execution: { completed: true },
            meta: {
                pageNumber: type === 'FA' ? undefined : undefined,
                count: type === 'ANKI' || type === 'QBANK' ? 0 : undefined,
                topic: '',
                system: '',
                subject: '',
                subtopics: [],
                url: '',
                videoStartTime: undefined,
                videoEndTime: undefined,
                playbackSpeed: 1,
                logStart: startStr,
                logEnd: endStr
            }
        };
        setTasks([...tasks, newTask]);
        setExpandedTaskId(newTask.id);
    };

    const updateTask = (id: string, updates: Partial<BlockTask>) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    };

    const updateTaskMeta = (id: string, metaUpdates: Partial<BlockTask['meta']>) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, meta: { ...t.meta, ...metaUpdates } } : t));
    };

    const removeTask = (id: string) => {
        setTasks(tasks.filter(t => t.id !== id));
    };

    const handlePageBlur = (id: string, pageStr: string) => {
        if (!pageStr || !knowledgeBase) return;
        const entry = knowledgeBase.find(k => k.pageNumber === pageStr);
        if (entry) {
            updateTaskMeta(id, {
                topic: entry.title,
                system: entry.system,
                subject: entry.subject,
                subtopics: entry.topics?.map(t => t.name) || []
            });
        }
    };

    const handleSelectBlock = (block: Block) => {
        setSessionTitle(block.title);
        setLinkedBlockId(block.id);
        
        if (block.tasks && block.tasks.length > 0) {
            const importedTasks = block.tasks.map(t => ({
                ...t,
                id: generateId(),
                completed: true,
                execution: { completed: true },
                meta: { ...t.meta }
            }));
            setTasks(importedTasks);
        }
        setIsBlockSelectorOpen(false);
    };

    // --- Completion Logic ---
    const handleFinish = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        
        // Finalize time calc
        let finalElapsed = elapsedSeconds;
        if (timerState === 'RUNNING' && startTimeRef.current) {
             const now = Date.now();
             const deltaSeconds = Math.floor((now - startTimeRef.current) / 1000);
             finalElapsed = accumulatedTimeRef.current + deltaSeconds;
        }

        setIsSaving(true);

        try {
            const todayStr = new Date().toLocaleDateString('en-CA');
            const now = new Date();
            // End time is simply NOW
            const endTimeStr = now.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'});
            
            // Start time is when the session officially began (start of block)
            // startTimeStr state variable holds this from the first click of Start.
            
            // Calculate total duration in minutes (Wall clock time)
            const [sH, sM] = startTimeStr.split(':').map(Number);
            const startObj = new Date();
            startObj.setHours(sH, sM, 0, 0);
            
            let durationMins = Math.round((now.getTime() - startObj.getTime()) / 60000);
            if (durationMins <= 0) durationMins = Math.ceil(finalElapsed / 60);

            // Construct final notes from tasks
            const taskNotes = tasks.map(t => {
                let note = `- ${t.type}: ${t.detail}`;
                if (t.meta?.logStart && t.meta?.logEnd) {
                    note += ` (${t.meta.logStart}-${t.meta.logEnd})`;
                }
                return note;
            }).join('\n');

            let generatedKbLogIds: string[] = [];
            let generatedTimeLogIds: string[] = [];

            const faTasks = tasks.filter(t => t.type === 'FA');
            if (faTasks.length > 0) {
                const revSettings = await getRevisionSettings() || { mode: 'balanced', targetCount: 7 };
                const entriesToLog = faTasks.map((t) => {
                    const pageMatch = t.detail.match(/\d+/);
                    const pageNum = pageMatch ? parseInt(pageMatch[0]) : (t.meta?.pageNumber || 0);
                    return {
                        pageNumber: pageNum,
                        isExplicitRevision: sessionTitle.toLowerCase().includes('revis') || t.detail.toLowerCase().includes('revis'),
                        topics: t.meta?.topic ? [t.meta.topic] : [],
                        date: todayStr
                    };
                }).filter((e) => e.pageNumber > 0);

                if (entriesToLog.length > 0) {
                    const { results, updatedKB } = processLogEntries(entriesToLog, knowledgeBase, revSettings);
                    await onUpdateKnowledgeBase(updatedKB);
                    
                    results.forEach(res => {
                        const newLog = res.updatedEntry.logs[res.updatedEntry.logs.length - 1];
                        if (newLog) generatedKbLogIds.push(newLog.id);
                    });

                    for (const res of results) {
                        const originalTask = faTasks.find(t => (t.detail.includes(String(res.pageNumber)) || t.meta?.pageNumber === res.pageNumber));
                        let tStart = startObj;
                        let tEnd = now;
                        let tDur = durationMins;

                        if (originalTask && originalTask.meta?.logStart && originalTask.meta?.logEnd) {
                            const [tsH, tsM] = originalTask.meta.logStart.split(':').map(Number);
                            const [teH, teM] = originalTask.meta.logEnd.split(':').map(Number);
                            const tStartObj = new Date(); tStartObj.setHours(tsH, tsM, 0, 0);
                            const tEndObj = new Date(); tEndObj.setHours(teH, teM, 0, 0);
                            
                            tStart = tStartObj;
                            tEnd = tEndObj;
                            tDur = Math.round((tEnd.getTime() - tStart.getTime()) / 60000);
                        }

                        const newTimeLogId = generateId();
                        const newKbLog = results.find(r => r.pageNumber === res.pageNumber)?.updatedEntry.logs.slice(-1)[0];

                        const timeLog: TimeLogEntry = {
                            id: newTimeLogId,
                            date: todayStr,
                            startTime: tStart.toISOString(),
                            endTime: tEnd.toISOString(),
                            durationMinutes: tDur > 0 ? tDur : 1,
                            category: res.eventType === 'REVISION' ? 'REVISION' : 'STUDY',
                            source: 'FA_LOGGER',
                            activity: `Log: ${sessionTitle} - FA Pg ${res.pageNumber}`,
                            pageNumber: String(res.pageNumber),
                            linkedEntityId: newKbLog ? newKbLog.id : undefined
                        };
                        await saveTimeLog(timeLog);
                        generatedTimeLogIds.push(newTimeLogId);
                    }
                }
            }

            if (linkedBlockId) {
                // UPDATE EXISTING BLOCK
                await finishBlock(todayStr, linkedBlockId, {
                    status: 'COMPLETED',
                    tasks: tasks,
                    pagesCovered: [],
                    carryForwardPages: [],
                    notes: `Executed via Focus Timer.\n${taskNotes}`,
                    generatedLogIds: generatedKbLogIds,
                    generatedTimeLogIds: generatedTimeLogIds,
                    interruptions: interruptions // Save logged breaks
                }, endTimeStr);
                
                await updateBlockInPlan(todayStr, linkedBlockId, {
                    actualStartTime: startTimeStr,
                    actualDurationMinutes: durationMins
                });

            } else {
                // CREATE NEW BLOCK (Consolidated)
                let finalTitle = sessionTitle;
                if (finalTitle === 'Focus Session' && tasks.length > 0) {
                     const counts = tasks.reduce((acc, t) => { acc[t.type] = (acc[t.type] || 0) + 1; return acc; }, {} as any);
                     let titleParts = [];
                     if (counts.FA) titleParts.push('Read FA');
                     if (counts.VIDEO) titleParts.push('Video');
                     if (counts.ANKI) titleParts.push('Anki');
                     if (counts.QBANK) titleParts.push('QBank');
                     if (counts.REVISION) titleParts.push('Revision');
                     if (titleParts.length > 0) finalTitle = titleParts.join(' + ');
                }

                await insertBlockAndShift(
                    todayStr,
                    startTimeStr,
                    durationMins,
                    tasks,
                    finalTitle,
                    'MIXED',
                    'Quick Focus Session',
                    generateId(),
                    'DONE',
                    {
                        actualStartTime: startTimeStr,
                        actualEndTime: endTimeStr,
                        actualDurationMinutes: durationMins,
                        completionStatus: 'COMPLETED',
                        generatedLogIds: generatedKbLogIds,
                        generatedTimeLogIds: generatedTimeLogIds,
                        actualNotes: taskNotes,
                        interruptions: interruptions // Save logged breaks
                    }
                );
            }

            // CRITICAL: Reset session state for next use
            resetSessionState();
            
            // Go back to plan
            onBack();

        } catch (e) {
            console.error("Failed to save focus session", e);
            alert("Error saving session. Please check connection.");
        } finally {
            setIsSaving(false);
        }
    };

    let displayAngle = 0;
    if (timerState === 'IDLE') {
        displayAngle = (durationMinutes / MAX_MINUTES) * 360;
    } else {
        const totalSeconds = durationMinutes * 60;
        const remaining = Math.max(0, totalSeconds - elapsedSeconds);
        const remainingMinutes = remaining / 60;
        displayAngle = (remainingMinutes / MAX_MINUTES) * 360;
    }
    displayAngle = Math.max(0, Math.min(360, displayAngle));
    const handlePos = polarToCartesian(CENTER, CENTER, RADIUS, displayAngle);

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 overflow-hidden animate-fade-in relative selection:bg-indigo-200 dark:selection:bg-indigo-800">
            
            <PauseReasonModal 
                isOpen={isPauseModalOpen}
                blockTitle={sessionTitle}
                onClose={() => setIsPauseModalOpen(false)}
                onConfirm={(reason, notes) => handlePauseConfirm(reason, notes)}
            />

            <BlockSelectorModal 
                isOpen={isBlockSelectorOpen} 
                onClose={() => setIsBlockSelectorOpen(false)} 
                onSelect={handleSelectBlock}
            />

            {/* Header */}
            <div className="p-4 flex items-center justify-between relative z-20">
                <button onClick={onBack} className="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-full transition-colors text-slate-500 dark:text-slate-400">
                    <ChevronLeftIcon className="w-6 h-6" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col items-center relative z-10 custom-scrollbar">
                
                {/* Timer Section */}
                <div className="w-full max-w-md flex flex-col items-center pt-2 pb-8">
                    <div className="relative w-[300px] h-[300px] mb-6">
                        <svg 
                            ref={svgRef}
                            width="300" height="300" 
                            className={`w-full h-full ${timerState === 'IDLE' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                            style={{ touchAction: 'none' }}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                        >
                            {/* Background Track */}
                            <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="rgba(128,128,128,0.1)" stroke="none" />
                            
                            {/* Progress Arc */}
                            <path 
                                d={describeArc(CENTER, CENTER, RADIUS, 0, displayAngle)} 
                                fill="none" 
                                stroke={timerState === 'RUNNING' ? "#10b981" : (timerState === 'PAUSED' ? "#f59e0b" : "#6366f1")} 
                                strokeWidth="8" 
                                strokeLinecap="round"
                            />
                            
                            {/* Handle (Thumb) */}
                            {timerState === 'IDLE' && (
                                <circle 
                                    cx={handlePos.x} 
                                    cy={handlePos.y} 
                                    r={12} 
                                    fill="#fff" 
                                    stroke="#6366f1" 
                                    strokeWidth="4"
                                    className="shadow-lg filter drop-shadow-md transition-transform hover:scale-110"
                                />
                            )}
                        </svg>

                        {/* Center Display */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                             {/* Digital Time */}
                            <div className="text-6xl font-thin font-mono tracking-tighter text-slate-800 dark:text-white">
                                {formatTimeDisplay()}
                            </div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">
                                {timerState === 'IDLE' ? 'SET TIME' : (timerState === 'PAUSED' ? 'PAUSED' : 'FOCUS')}
                            </div>
                        </div>
                    </div>

                    {/* Session Tag Pill */}
                    <div className="mb-6 flex gap-2">
                        <input 
                            value={sessionTitle} 
                            onChange={e => setSessionTitle(e.target.value)}
                            className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-center rounded-full px-4 py-2 text-sm font-bold border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all w-64 shadow-sm"
                            placeholder="Session Title"
                        />
                        {/* Import from Plan Button */}
                        {!linkedBlockId && (
                            <button 
                                onClick={() => setIsBlockSelectorOpen(true)}
                                className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full p-2 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                                title="Import from Today's Plan"
                            >
                                <CalendarIcon className="w-5 h-5" />
                            </button>
                        )}
                        {linkedBlockId && (
                            <div className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full p-2" title="Linked to Plan">
                                <CheckCircleIcon className="w-5 h-5" />
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="flex gap-4">
                        {timerState === 'IDLE' ? (
                            <button 
                                onClick={startTimer}
                                className="px-12 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200 dark:shadow-none active:scale-95"
                            >
                                Start Focus
                            </button>
                        ) : (
                            <>
                                <button 
                                    onClick={timerState === 'RUNNING' ? handlePauseClick : startTimer}
                                    className={`px-8 py-3 font-bold rounded-xl transition-all active:scale-95 flex items-center gap-2 ${timerState === 'RUNNING' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                                >
                                    {timerState === 'RUNNING' ? <PauseIcon className="w-5 h-5"/> : <PlayIcon className="w-5 h-5"/>}
                                    {timerState === 'RUNNING' ? 'Pause' : 'Resume'}
                                </button>
                                <button 
                                    onClick={handleFinish}
                                    disabled={isSaving}
                                    className="px-8 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95 flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSaving ? <ArrowPathIcon className="w-5 h-5 animate-spin"/> : <StopIcon className="w-5 h-5"/>}
                                    Finish
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Bottom Card: Task Editor */}
                <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-t-[32px] p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] border-t border-slate-100 dark:border-slate-800 flex-1 min-h-[400px]">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                                <ListCheckIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white text-lg">Session Plan</h3>
                                <p className="text-xs text-slate-500">Log finished tasks here</p>
                            </div>
                        </div>
                    </div>

                    {/* Tasks List */}
                    <div className="space-y-4 mb-6">
                        {tasks.length === 0 ? (
                            <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                                <p className="text-sm text-slate-400 italic">No tasks added for this session.</p>
                            </div>
                        ) : (
                            tasks.map((task) => (
                                <div key={task.id} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex items-center justify-between group">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`shrink-0 p-2 rounded-lg ${
                                            task.type === 'FA' ? 'bg-indigo-100 text-indigo-600' : 
                                            task.type === 'VIDEO' ? 'bg-blue-100 text-blue-600' :
                                            task.type === 'ANKI' ? 'bg-amber-100 text-amber-600' :
                                            task.type === 'QBANK' ? 'bg-emerald-100 text-emerald-600' :
                                            'bg-fuchsia-100 text-fuchsia-600'
                                        }`}>
                                            {task.type === 'FA' && <BookOpenIcon className="w-4 h-4" />}
                                            {task.type === 'VIDEO' && <VideoIcon className="w-4 h-4" />}
                                            {task.type === 'ANKI' && <StarIcon className="w-4 h-4" />}
                                            {task.type === 'QBANK' && <QIcon className="w-4 h-4" />}
                                            {task.type === 'REVISION' && <ArrowPathIcon className="w-4 h-4" />}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <input 
                                                className="bg-transparent font-bold text-sm text-slate-700 dark:text-slate-200 outline-none w-full"
                                                value={task.detail}
                                                onChange={(e) => updateTask(task.id, { detail: e.target.value })}
                                                placeholder="Task details..."
                                            />
                                            {task.meta?.topic && <span className="text-[10px] text-slate-400 truncate">{task.meta.topic}</span>}
                                        </div>
                                    </div>
                                    <button onClick={() => removeTask(task.id)} className="text-slate-300 hover:text-red-500 p-2">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Add Task Buttons */}
                    <div className="flex gap-2 justify-center">
                        <button onClick={() => addTask('FA')} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm hover:scale-110 transition-transform text-indigo-500" title="Add Page">
                            <BookOpenIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => addTask('VIDEO')} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm hover:scale-110 transition-transform text-blue-500" title="Add Video">
                            <VideoIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => addTask('ANKI')} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm hover:scale-110 transition-transform text-amber-500" title="Add Cards">
                            <StarIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => addTask('QBANK')} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm hover:scale-110 transition-transform text-emerald-500" title="Add Questions">
                            <QIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => addTask('REVISION')} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm hover:scale-110 transition-transform text-fuchsia-500" title="Add Revision">
                            <ArrowPathIcon className="w-5 h-5" />
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};
