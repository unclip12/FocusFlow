
import React, { useState, useEffect, useRef } from 'react';
import { BlockTask, KnowledgeBaseEntry, SYSTEMS, CATEGORIES } from '../types';
import { XMarkIcon, PlayIcon, PauseIcon, StopIcon, PlusIcon, TrashIcon, BookOpenIcon, VideoIcon, StarIcon, QIcon, ArrowPathIcon } from './Icons';

interface QuickFocusModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (startTime: string, endTime: string, tasks: BlockTask[], title: string) => void;
    knowledgeBase: KnowledgeBaseEntry[];
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

export const QuickFocusModal: React.FC<QuickFocusModalProps> = ({ isOpen, onClose, onSave, knowledgeBase }) => {
    // Timer State
    const [durationMinutes, setDurationMinutes] = useState(25);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [timerState, setTimerState] = useState<'IDLE' | 'RUNNING' | 'PAUSED'>('IDLE');
    const timerRef = useRef<number | null>(null);
    const startTimeRef = useRef<Date | null>(null);

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

    // Task Logging State
    const [sessionTitle, setSessionTitle] = useState('Focus Session');
    const [tasks, setTasks] = useState<BlockTask[]>([]);
    
    // UI State for expanding tasks
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            document.body.style.overflow = '';
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isOpen]);

    // Cleanup on unmount or close
    useEffect(() => {
        if (!isOpen) {
            setTimerState('IDLE');
            setElapsedSeconds(0);
            setTasks([]);
            setSessionTitle('Focus Session');
            setDurationMinutes(25);
        }
    }, [isOpen]);

    const startTimer = () => {
        if (timerState === 'IDLE') {
            startTimeRef.current = new Date();
        }
        setTimerState('RUNNING');
        timerRef.current = window.setInterval(() => {
            setElapsedSeconds(prev => prev + 1);
        }, 1000);
    };

    const pauseTimer = () => {
        setTimerState('PAUSED');
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const addTime = (minutes: number) => {
        setDurationMinutes(prev => prev + minutes);
    };

    const formatTime = (totalSeconds: number) => {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // --- Task Logic (Reused mostly from AddBlockModal) ---
    const addTask = (type: BlockTask['type']) => {
        const newTask: BlockTask = {
            id: generateId(),
            type,
            detail: '',
            completed: true, // Auto-complete for logged tasks
            execution: { completed: true },
            meta: {
                pageNumber: type === 'FA' ? undefined : undefined,
                count: type === 'ANKI' || type === 'QBANK' ? 0 : undefined,
                topic: '',
                system: '',
                subject: '',
                subtopics: [],
                playbackSpeed: 1
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

    const handleFinish = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        
        const now = new Date();
        const start = new Date(now.getTime() - elapsedSeconds * 1000);
        
        const startTimeStr = start.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'});
        const endTimeStr = now.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'});

        // Construct final title based on tasks if generic
        let finalTitle = sessionTitle;
        if (finalTitle === 'Focus Session' && tasks.length > 0) {
             const counts = tasks.reduce((acc, t) => { acc[t.type] = (acc[t.type] || 0) + 1; return acc; }, {} as any);
             let titleParts = [];
             if (counts.FA) titleParts.push('Read FA');
             if (counts.VIDEO) titleParts.push('Watch Video');
             if (counts.ANKI) titleParts.push('Anki');
             if (counts.QBANK) titleParts.push('QBank');
             if (counts.REVISION) titleParts.push('Revision');
             if (titleParts.length > 0) finalTitle = titleParts.join(' + ');
        }

        onSave(startTimeStr, endTimeStr, tasks, finalTitle);
        onClose();
    };

    if (!isOpen) return null;

    const remainingSeconds = (durationMinutes * 60) - elapsedSeconds;
    const isOvertime = remainingSeconds < 0;
    
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[95vh] relative overflow-hidden">
                
                {/* Timer Header Area */}
                <div className={`p-8 text-center relative transition-colors duration-500 ${isOvertime ? 'bg-red-50 dark:bg-red-900/20' : 'bg-indigo-50 dark:bg-indigo-900/20'}`}>
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                        <XMarkIcon className="w-6 h-6 text-slate-400" />
                    </button>
                    
                    <div className="mb-2">
                        <input 
                            value={sessionTitle}
                            onChange={(e) => setSessionTitle(e.target.value)}
                            className="bg-transparent text-center font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-sm outline-none w-full"
                        />
                    </div>

                    <div className={`text-6xl font-black font-mono tracking-tighter mb-6 ${isOvertime ? 'text-red-500 animate-pulse' : 'text-slate-800 dark:text-white'}`}>
                        {formatTime(Math.abs(remainingSeconds))}
                    </div>

                    <div className="flex items-center justify-center gap-4 mb-4">
                        {timerState === 'RUNNING' ? (
                            <button onClick={pauseTimer} className="p-4 bg-amber-100 text-amber-600 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all">
                                <PauseIcon className="w-8 h-8" />
                            </button>
                        ) : (
                            <button onClick={startTimer} className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all">
                                <PlayIcon className="w-8 h-8" />
                            </button>
                        )}
                        <button onClick={handleFinish} className="p-4 bg-green-100 text-green-600 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all" title="Finish & Log">
                            <StopIcon className="w-8 h-8" />
                        </button>
                    </div>

                    <div className="flex justify-center gap-2">
                        <button onClick={() => addTime(5)} className="px-3 py-1 bg-white/50 dark:bg-black/20 rounded-lg text-xs font-bold text-slate-500 hover:bg-white dark:hover:bg-slate-800 transition-colors">+5m</button>
                        <button onClick={() => addTime(10)} className="px-3 py-1 bg-white/50 dark:bg-black/20 rounded-lg text-xs font-bold text-slate-500 hover:bg-white dark:hover:bg-slate-800 transition-colors">+10m</button>
                        <button onClick={() => addTime(25)} className="px-3 py-1 bg-white/50 dark:bg-black/20 rounded-lg text-xs font-bold text-slate-500 hover:bg-white dark:hover:bg-slate-800 transition-colors">+25m</button>
                    </div>
                </div>

                {/* Task Logging Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-950/50 space-y-4">
                    <div className="flex justify-between items-end">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Log Activity</label>
                        <div className="flex gap-1">
                            <button onClick={() => addTask('FA')} className="p-1.5 bg-indigo-100 text-indigo-600 rounded hover:bg-indigo-200"><BookOpenIcon className="w-3 h-3" /></button>
                            <button onClick={() => addTask('VIDEO')} className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"><VideoIcon className="w-3 h-3" /></button>
                            <button onClick={() => addTask('ANKI')} className="p-1.5 bg-amber-100 text-amber-600 rounded hover:bg-amber-200"><StarIcon className="w-3 h-3" /></button>
                            <button onClick={() => addTask('QBANK')} className="p-1.5 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200"><QIcon className="w-3 h-3" /></button>
                            <button onClick={() => addTask('REVISION')} className="p-1.5 bg-fuchsia-100 text-fuchsia-600 rounded hover:bg-fuchsia-200"><ArrowPathIcon className="w-3 h-3" /></button>
                        </div>
                    </div>

                    {tasks.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-xs italic border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                            Add tasks while you study or after you finish.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {tasks.map((task) => {
                                const isExpanded = expandedTaskId === task.id;
                                return (
                                    <div key={task.id} className={`bg-white dark:bg-slate-800 rounded-xl border transition-all ${isExpanded ? 'border-indigo-300 dark:border-indigo-700 shadow-md' : 'border-slate-200 dark:border-slate-700 shadow-sm'}`}>
                                        <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}>
                                            <span className={`shrink-0 w-6 h-6 flex items-center justify-center rounded ${task.type === 'FA' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                                                {task.type === 'FA' ? <BookOpenIcon className="w-3 h-3" /> : <PlusIcon className="w-3 h-3" />}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <input 
                                                    className="w-full bg-transparent text-sm font-bold text-slate-800 dark:text-white outline-none placeholder-slate-400"
                                                    placeholder={task.type === 'FA' ? "Page #" : "Task Details"}
                                                    value={task.detail}
                                                    onChange={(e) => updateTask(task.id, { detail: e.target.value })}
                                                    onBlur={(e) => task.type === 'FA' && handlePageBlur(task.id, e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                            <button onClick={(e) => { e.stopPropagation(); removeTask(task.id); }} className="text-slate-300 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                                        </div>
                                        
                                        {isExpanded && (
                                            <div className="p-3 pt-0 border-t border-slate-100 dark:border-slate-700 mt-1">
                                                <input 
                                                    className="w-full p-2 mt-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded text-xs outline-none"
                                                    placeholder="Topic / Notes..."
                                                    value={task.meta?.topic || ''}
                                                    onChange={(e) => updateTaskMeta(task.id, { topic: e.target.value })}
                                                />
                                                {/* Simplified counts for QBank/Anki */}
                                                {(task.type === 'ANKI' || task.type === 'QBANK') && (
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Count:</span>
                                                        <input 
                                                            type="number"
                                                            className="w-16 p-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded text-xs text-center outline-none font-bold"
                                                            value={task.meta?.count || ''}
                                                            onChange={(e) => updateTask(task.id, { detail: `${e.target.value} items`, meta: { ...task.meta, count: parseInt(e.target.value) || 0 } })}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
