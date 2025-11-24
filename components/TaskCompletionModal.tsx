

import React, { useState, useEffect } from 'react';
import { Block, BlockTask } from '../types';
import { CheckCircleIcon, XMarkIcon, ClockIcon, ArrowRightIcon, PlusIcon, CalendarIcon } from './Icons';

interface TaskCompletionModalProps {
    isOpen: boolean;
    block: Block;
    onClose: () => void;
    onSave: (
        status: 'COMPLETED' | 'PARTIAL' | 'NOT_DONE', 
        tasks: BlockTask[], 
        rescheduleAction?: { type: 'NEW_BLOCK' | 'NEXT_BLOCK' | 'FUTURE_DATE', time?: string, duration?: number, date?: string, tasks: BlockTask[] }
    ) => void;
    defaultDuration: number;
}

const REASONS = ["Ran out of time", "Difficult topic", "Distracted", "Too tired", "Tech issue", "Material missing"];

export const TaskCompletionModal: React.FC<TaskCompletionModalProps> = ({ isOpen, block, onClose, onSave, defaultDuration }) => {
    const [tasks, setTasks] = useState<BlockTask[]>([]);
    const [rescheduleMode, setRescheduleMode] = useState<'NEW_BLOCK' | 'NEXT_BLOCK' | 'FUTURE_DATE' | null>(null);
    
    // Reschedule Time State
    const [newBlockStartTime, setNewBlockStartTime] = useState('');
    const [newBlockEndTime, setNewBlockEndTime] = useState('');
    
    // Future Date State
    const [futureDate, setFutureDate] = useState('');
    
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

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

            // Default future date: tomorrow
            const tmr = new Date();
            tmr.setDate(tmr.getDate() + 1);
            setFutureDate(tmr.toISOString().split('T')[0]);
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
            let duration = defaultDuration;
            
            if (rescheduleMode === 'NEW_BLOCK' && newBlockStartTime && newBlockEndTime) {
                const [sH, sM] = newBlockStartTime.split(':').map(Number);
                const [eH, eM] = newBlockEndTime.split(':').map(Number);
                duration = (eH * 60 + eM) - (sH * 60 + sM);
                if (duration < 0) duration += 24*60;
            }

            rescheduleAction = {
                type: rescheduleMode,
                time: rescheduleMode === 'NEW_BLOCK' ? newBlockStartTime : undefined,
                duration: rescheduleMode === 'NEW_BLOCK' ? duration : undefined,
                date: rescheduleMode === 'FUTURE_DATE' ? futureDate : undefined,
                tasks: incomplete
            };
        }

        onSave(status, tasks, rescheduleAction);
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
                            
                            <div className="space-y-3">
                                <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${rescheduleMode === 'NEW_BLOCK' ? 'border-amber-500 bg-white dark:bg-slate-800 shadow-md' : 'border-transparent bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800'}`}>
                                    <input 
                                        type="radio" 
                                        name="reschedule" 
                                        checked={rescheduleMode === 'NEW_BLOCK'} 
                                        onChange={() => setRescheduleMode('NEW_BLOCK')}
                                        className="text-amber-600 focus:ring-amber-500"
                                    />
                                    <div className="flex-1">
                                        <span className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
                                            <PlusIcon className="w-4 h-4"/> Create New Block Today
                                        </span>
                                        {rescheduleMode === 'NEW_BLOCK' && (
                                            <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800/50">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1">
                                                        <span className="text-[10px] text-slate-400 font-bold mb-1 block">Start</span>
                                                        <input 
                                                            type="time" 
                                                            value={newBlockStartTime}
                                                            onChange={(e) => setNewBlockStartTime(e.target.value)}
                                                            className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-bold outline-none focus:border-amber-500"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <span className="text-[10px] text-slate-400 font-bold mb-1 block">End</span>
                                                        <input 
                                                            type="time" 
                                                            value={newBlockEndTime}
                                                            onChange={(e) => setNewBlockEndTime(e.target.value)}
                                                            className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-bold outline-none focus:border-amber-500"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 flex-wrap mt-2">
                                                    {[15, 30, 45, 60].map(min => (
                                                        <button 
                                                            key={min} 
                                                            onClick={() => adjustEndTime(min)}
                                                            className="px-2 py-1 rounded bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-100 dark:border-amber-800 hover:bg-amber-50 transition-colors"
                                                        >
                                                            +{min}m
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </label>

                                <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${rescheduleMode === 'NEXT_BLOCK' ? 'border-amber-500 bg-white dark:bg-slate-800 shadow-md' : 'border-transparent bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800'}`}>
                                    <input 
                                        type="radio" 
                                        name="reschedule" 
                                        checked={rescheduleMode === 'NEXT_BLOCK'} 
                                        onChange={() => setRescheduleMode('NEXT_BLOCK')}
                                        className="text-amber-600 focus:ring-amber-500"
                                    />
                                    <div className="flex-1">
                                        <span className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
                                            <ArrowRightIcon className="w-4 h-4"/> Add to Next Block
                                        </span>
                                    </div>
                                </label>

                                <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${rescheduleMode === 'FUTURE_DATE' ? 'border-amber-500 bg-white dark:bg-slate-800 shadow-md' : 'border-transparent bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800'}`}>
                                    <input 
                                        type="radio" 
                                        name="reschedule" 
                                        checked={rescheduleMode === 'FUTURE_DATE'} 
                                        onChange={() => setRescheduleMode('FUTURE_DATE')}
                                        className="text-amber-600 focus:ring-amber-500"
                                    />
                                    <div className="flex-1">
                                        <span className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
                                            <CalendarIcon className="w-4 h-4"/> Reschedule to Date
                                        </span>
                                        {rescheduleMode === 'FUTURE_DATE' && (
                                            <div className="mt-2 p-2">
                                                <input 
                                                    type="date" 
                                                    value={futureDate}
                                                    onChange={(e) => setFutureDate(e.target.value)}
                                                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-bold outline-none focus:border-amber-500"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </label>
                            </div>
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