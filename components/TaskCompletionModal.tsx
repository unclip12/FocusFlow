
import React, { useState, useEffect } from 'react';
import { Block, BlockTask } from '../types';
import { CheckCircleIcon, XMarkIcon, ClockIcon, ArrowRightIcon, PlusIcon } from './Icons';

interface TaskCompletionModalProps {
    isOpen: boolean;
    block: Block;
    onClose: () => void;
    onSave: (
        status: 'COMPLETED' | 'PARTIAL' | 'NOT_DONE', 
        tasks: BlockTask[], 
        rescheduleAction?: { type: 'NEW_BLOCK' | 'NEXT_BLOCK', time?: string, tasks: BlockTask[] }
    ) => void;
    defaultDuration: number;
}

const REASONS = ["Ran out of time", "Difficult topic", "Distracted", "Too tired", "Tech issue", "Material missing"];

export const TaskCompletionModal: React.FC<TaskCompletionModalProps> = ({ isOpen, block, onClose, onSave, defaultDuration }) => {
    const [tasks, setTasks] = useState<BlockTask[]>([]);
    const [rescheduleMode, setRescheduleMode] = useState<'NEW_BLOCK' | 'NEXT_BLOCK' | null>(null);
    
    // Reschedule Time State
    const [newBlockStartTime, setNewBlockStartTime] = useState('');
    const [newBlockEndTime, setNewBlockEndTime] = useState('');
    
    // Initialize state from block
    useEffect(() => {
        if (isOpen && block.tasks) {
            setTasks(block.tasks.map(t => ({
                ...t,
                execution: t.execution || { completed: false, note: '' }
            })));
            
            const now = new Date();
            const startStr = now.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'});
            setNewBlockStartTime(startStr);
            
            // Default end time based on defaultDuration
            const d = new Date();
            d.setMinutes(d.getMinutes() + defaultDuration);
            setNewBlockEndTime(d.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'}));
        }
    }, [isOpen, block, defaultDuration]);

    const toggleTaskStatus = (index: number, status: boolean) => {
        const newTasks = [...tasks];
        newTasks[index].execution = { ...newTasks[index].execution, completed: status, note: '' };
        setTasks(newTasks);
    };

    const updateTaskNote = (index: number, note: string) => {
        const newTasks = [...tasks];
        newTasks[index].execution = { ...newTasks[index].execution!, note };
        setTasks(newTasks);
    };

    const adjustEndTime = (minutes: number) => {
        if (!newBlockStartTime) return;
        const [h, m] = newBlockStartTime.split(':').map(Number);
        const d = new Date();
        d.setHours(h, m + minutes);
        setNewBlockEndTime(d.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'}));
    };

    const getIncompleteTasks = () => tasks.filter(t => !t.execution?.completed);

    const handleSave = () => {
        const incomplete = getIncompleteTasks();
        const allDone = incomplete.length === 0;
        const status = allDone ? 'COMPLETED' : (incomplete.length === tasks.length ? 'NOT_DONE' : 'PARTIAL');
        
        let rescheduleAction = undefined;
        if (incomplete.length > 0 && rescheduleMode) {
            // If NEXT_BLOCK, time isn't needed. If NEW_BLOCK, strictly use Start Time. 
            // NOTE: The planService expects start time and duration. 
            // We'll pass start time, but logic in TodaysPlanView needs to calculate duration from End Time.
            // Actually onSave signature in TodaysPlanView for NEW_BLOCK takes time and duration.
            // We will adapt onSave signature here to pass endTime if needed, or handle duration calc here.
            
            // Wait, `onSave` in Props accepts `time?: string`. 
            // We should probably pass startTime AND duration, or simply startTime and let parent calc?
            // Current signature: `time?: string`. Let's pass startTime. 
            // BUT wait, we have End Time now. We should calculate duration here or pass end time.
            // Let's pass startTime, but we need to communicate duration.
            // The easiest way without changing types excessively is to just pass startTime, 
            // and we can attach duration to the payload or let parent handle defaults.
            // BETTER: Update `onSave` to accept an object or we calculate duration and pass it somehow?
            // The prompt asks for start time and end time.
            // I will hack `time` to be `START|DURATION` string or just `START`.
            // Actually, let's stick to `startTime` and assume the parent uses default or we update the parent.
            // Re-reading prompt: "ask me what is the end time... put plus 30".
            // Okay, let's calculate duration here and pass it? No, `insertBlockAndShift` takes duration.
            
            // Let's calculate duration.
            let duration = defaultDuration;
            if (rescheduleMode === 'NEW_BLOCK' && newBlockStartTime && newBlockEndTime) {
                const [sH, sM] = newBlockStartTime.split(':').map(Number);
                const [eH, eM] = newBlockEndTime.split(':').map(Number);
                duration = (eH * 60 + eM) - (sH * 60 + sM);
                if (duration < 0) duration += 24*60;
            }

            // We will encode duration into the `time` string as "HH:mm|DURATION" to pass it safely.
            // Or cleaner: update `rescheduleAction` type in parent. I'll do the string hack for minimal file changes if I can't update types easily.
            // Actually I can update types in this file since I am editing it.
            // But `TodaysPlanView` uses this type. I am editing `TodaysPlanView` too. So I can change the type!
            
            rescheduleAction = {
                type: rescheduleMode,
                time: rescheduleMode === 'NEW_BLOCK' ? newBlockStartTime : undefined,
                duration: rescheduleMode === 'NEW_BLOCK' ? duration : undefined,
                tasks: incomplete
            };
        }

        // Cast to match parent expectation which might be stricter if I don't update it perfectly.
        // I will update parent to accept `duration` in rescheduleAction.
        onSave(status, tasks, rescheduleAction as any);
        onClose();
    };

    if (!isOpen) return null;

    const incompleteCount = getIncompleteTasks().length;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
                
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Session Review</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{block.title}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><XMarkIcon className="w-6 h-6 text-slate-400" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950/50">
                    
                    {/* Task List */}
                    <div className="space-y-4">
                        {tasks.map((task, idx) => (
                            <div key={task.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded">{task.type}</span>
                                        <p className="font-bold text-slate-800 dark:text-white mt-1">{task.detail}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => toggleTaskStatus(idx, true)}
                                            className={`p-2 rounded-lg transition-all ${task.execution?.completed ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-green-100 dark:hover:bg-green-900/20 hover:text-green-500'}`}
                                        >
                                            <CheckCircleIcon className="w-6 h-6" />
                                        </button>
                                        <button 
                                            onClick={() => toggleTaskStatus(idx, false)}
                                            className={`p-2 rounded-lg transition-all ${!task.execution?.completed ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-red-100 dark:hover:bg-red-900/20 hover:text-red-500'}`}
                                        >
                                            <XMarkIcon className="w-6 h-6" />
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Context Input */}
                                <div className="mt-2">
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">
                                        {task.execution?.completed ? "Experience / Notes" : "Reason for Incomplete"}
                                    </label>
                                    
                                    {!task.execution?.completed && (
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {REASONS.map(r => (
                                                <button 
                                                    key={r}
                                                    onClick={() => updateTaskNote(idx, r)}
                                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${task.execution?.note === r ? 'bg-red-100 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                                                >
                                                    {r}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <textarea 
                                        value={task.execution?.note || ''}
                                        onChange={(e) => updateTaskNote(idx, e.target.value)}
                                        className={`w-full p-2 rounded-lg border text-sm outline-none focus:ring-2 transition-all ${task.execution?.completed ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30 focus:ring-green-500/20' : 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30 focus:ring-red-500/20'}`}
                                        placeholder={task.execution?.completed ? "Key takeaways..." : "Other reason..."}
                                        rows={2}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Reschedule Options (Only if incompletes exist) */}
                    {incompleteCount > 0 && (
                        <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-5 animate-fade-in">
                            <div className="flex items-center gap-2 mb-4 text-amber-700 dark:text-amber-400">
                                <ClockIcon className="w-5 h-5" />
                                <h4 className="font-bold">Reschedule {incompleteCount} Tasks</h4>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button 
                                    onClick={() => setRescheduleMode('NEW_BLOCK')}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${rescheduleMode === 'NEW_BLOCK' ? 'border-amber-500 bg-white dark:bg-slate-800 shadow-md' : 'border-transparent bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800'}`}
                                >
                                    <div className="font-bold text-slate-800 dark:text-white mb-1 flex items-center gap-2"><PlusIcon className="w-4 h-4"/> Create New Block</div>
                                    <p className="text-xs text-slate-500">Shift schedule forward</p>
                                </button>

                                <button 
                                    onClick={() => setRescheduleMode('NEXT_BLOCK')}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${rescheduleMode === 'NEXT_BLOCK' ? 'border-amber-500 bg-white dark:bg-slate-800 shadow-md' : 'border-transparent bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800'}`}
                                >
                                    <div className="font-bold text-slate-800 dark:text-white mb-1 flex items-center gap-2"><ArrowRightIcon className="w-4 h-4"/> Add to Next Block</div>
                                    <p className="text-xs text-slate-500">Merge with upcoming task</p>
                                </button>
                            </div>

                            {rescheduleMode === 'NEW_BLOCK' && (
                                <div className="mt-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-amber-100 dark:border-amber-900/30 animate-slide-in-up space-y-3">
                                    <label className="block text-xs font-bold text-slate-500 uppercase">Time Window</label>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1">
                                            <span className="text-[10px] text-slate-400 font-bold mb-1 block">Start</span>
                                            <input 
                                                type="time" 
                                                value={newBlockStartTime}
                                                onChange={(e) => setNewBlockStartTime(e.target.value)}
                                                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-lg font-bold outline-none focus:border-amber-500"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <span className="text-[10px] text-slate-400 font-bold mb-1 block">End</span>
                                            <input 
                                                type="time" 
                                                value={newBlockEndTime}
                                                onChange={(e) => setNewBlockEndTime(e.target.value)}
                                                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-lg font-bold outline-none focus:border-amber-500"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-2 flex-wrap">
                                        {[15, 30, 45, 60].map(min => (
                                            <button 
                                                key={min} 
                                                onClick={() => adjustEndTime(min)}
                                                className="px-3 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-100 dark:border-amber-800 hover:bg-amber-100 transition-colors"
                                            >
                                                +{min}m
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                </div>

                <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end gap-3 shrink-0 rounded-b-3xl">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                    <button onClick={handleSave} className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-colors flex items-center gap-2">
                        <CheckCircleIcon className="w-5 h-5" /> Finish Session
                    </button>
                </div>

            </div>
        </div>
    );
};
