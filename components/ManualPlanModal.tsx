

import React, { useState, useEffect } from 'react';
import { DayPlan, Block, BlockTask } from '../types';
import { XMarkIcon, PlusIcon, TrashIcon, ClockIcon, BookOpenIcon, FireIcon, CheckCircleIcon, VideoIcon, CoffeeIcon, ArrowPathIcon } from './Icons';

interface ManualPlanModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (plan: DayPlan) => void;
    initialDate: string;
    existingPlan?: DayPlan | null;
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

export const ManualPlanModal: React.FC<ManualPlanModalProps> = ({ isOpen, onClose, onSave, initialDate, existingPlan }) => {
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [startTime, setStartTime] = useState('08:00'); // Just for default new blocks

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

    useEffect(() => {
        if (isOpen) {
            if (existingPlan && existingPlan.blocks && existingPlan.blocks.length > 0) {
                setBlocks(existingPlan.blocks);
            } else {
                // Initialize with one empty block
                setBlocks([{
                    id: generateId(),
                    index: 0,
                    date: initialDate,
                    plannedStartTime: '08:00',
                    plannedEndTime: '08:30',
                    type: 'MIXED',
                    title: 'Study Session 1',
                    description: '',
                    plannedDurationMinutes: 30,
                    status: 'NOT_STARTED',
                    tasks: []
                }]);
            }
        }
    }, [isOpen, existingPlan, initialDate]);

    const addBlock = () => {
        const lastBlock = blocks[blocks.length - 1];
        let newStart = '09:00';
        let newEnd = '09:30';
        
        if (lastBlock) {
            newStart = lastBlock.plannedEndTime;
            const [h, m] = newStart.split(':').map(Number);
            const d = new Date();
            d.setHours(h, m + 30);
            newEnd = d.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'});
        }

        setBlocks([...blocks, {
            id: generateId(),
            index: blocks.length,
            date: initialDate,
            plannedStartTime: newStart,
            plannedEndTime: newEnd,
            type: 'MIXED',
            title: `Study Session ${blocks.length + 1}`,
            description: '',
            plannedDurationMinutes: 30,
            status: 'NOT_STARTED',
            tasks: []
        }]);
    };

    const removeBlock = (index: number) => {
        setBlocks(blocks.filter((_, i) => i !== index));
    };

    const updateBlock = (index: number, updates: Partial<Block>) => {
        const updatedBlocks = [...blocks];
        
        // Auto calc duration if times change
        if (updates.plannedStartTime || updates.plannedEndTime) {
            const start = updates.plannedStartTime || updatedBlocks[index].plannedStartTime;
            const end = updates.plannedEndTime || updatedBlocks[index].plannedEndTime;
            const [sH, sM] = start.split(':').map(Number);
            const [eH, eM] = end.split(':').map(Number);
            let diff = (eH * 60 + eM) - (sH * 60 + sM);
            if (diff < 0) diff += 24 * 60; // Crossing midnight
            updates.plannedDurationMinutes = diff;
        }

        updatedBlocks[index] = { ...updatedBlocks[index], ...updates };
        setBlocks(updatedBlocks);
    };

    const addTaskToBlock = (blockIndex: number, type: BlockTask['type']) => {
        const newBlocks = [...blocks];
        const block = newBlocks[blockIndex];
        if (!block.tasks) block.tasks = [];
        
        block.tasks.push({
            id: generateId(),
            type,
            detail: '',
            completed: false,
            meta: type === 'FA' ? { pageNumber: 0 } : type === 'ANKI' || type === 'QBANK' ? { count: 0 } : undefined
        });
        
        // Auto-update title if generic
        if (block.title.startsWith('Study Session')) {
            const counts = block.tasks.reduce((acc, t) => { acc[t.type] = (acc[t.type] || 0) + 1; return acc; }, {} as any);
            let titleParts = [];
            if (counts.FA) titleParts.push('Read FA');
            if (counts.VIDEO) titleParts.push('Watch Video');
            if (counts.ANKI) titleParts.push('Flashcards');
            if (counts.QBANK) titleParts.push('QBank');
            if (counts.REVISION) titleParts.push('Revision');
            if (titleParts.length > 0) block.title = titleParts.join(' + ');
        }

        setBlocks(newBlocks);
    };

    const updateTask = (blockIndex: number, taskIndex: number, updates: Partial<BlockTask>) => {
        const newBlocks = [...blocks];
        const block = newBlocks[blockIndex];
        if (block.tasks) {
            block.tasks[taskIndex] = { ...block.tasks[taskIndex], ...updates };
            setBlocks(newBlocks);
        }
    };

    const removeTask = (blockIndex: number, taskIndex: number) => {
        const newBlocks = [...blocks];
        const block = newBlocks[blockIndex];
        if (block.tasks) {
            block.tasks.splice(taskIndex, 1);
            setBlocks(newBlocks);
        }
    };

    const handleSave = () => {
        // Convert blocks to DayPlan structure roughly to satisfy type requirements
        // Real power is in the blocks array
        const totalMinutes = blocks.reduce((acc, b) => acc + b.plannedDurationMinutes, 0);
        
        const plan: DayPlan = {
            date: initialDate,
            blocks: blocks,
            startTimePlanned: blocks[0]?.plannedStartTime || '08:00',
            estimatedEndTime: blocks[blocks.length-1]?.plannedEndTime || '18:00',
            totalStudyMinutesPlanned: totalMinutes,
            totalBreakMinutes: 0,
            faPages: [], 
            faPagesCount: 0,
            faStudyMinutesPlanned: 0,
            videos: [],
            anki: null,
            qbank: null,
            breaks: [],
            notesFromUser: '',
            notesFromAI: '',
            attachments: [],
            blockDurationSetting: 30
        };
        
        onSave(plan);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0 bg-white dark:bg-slate-900 rounded-t-2xl">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Time Blocks Schedule</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><XMarkIcon className="w-6 h-6 text-slate-400" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/50">
                    
                    {blocks.map((block, bIdx) => (
                        <div key={block.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm relative group">
                            
                            {/* Block Header (Time) */}
                            <div className="flex items-center gap-4 mb-4">
                                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg border border-slate-200 dark:border-slate-600">
                                    <input 
                                        type="time" 
                                        value={block.plannedStartTime} 
                                        onChange={(e) => updateBlock(bIdx, { plannedStartTime: e.target.value })}
                                        className="bg-transparent font-bold text-slate-800 dark:text-white text-sm outline-none w-20 text-center"
                                    />
                                    <span className="text-slate-400">-</span>
                                    <input 
                                        type="time" 
                                        value={block.plannedEndTime} 
                                        onChange={(e) => updateBlock(bIdx, { plannedEndTime: e.target.value })}
                                        className="bg-transparent font-bold text-slate-800 dark:text-white text-sm outline-none w-20 text-center"
                                    />
                                </div>
                                <input 
                                    type="text"
                                    value={block.title}
                                    onChange={(e) => updateBlock(bIdx, { title: e.target.value })}
                                    className="flex-1 font-bold text-slate-700 dark:text-slate-200 bg-transparent outline-none border-b border-transparent focus:border-indigo-500 text-sm"
                                    placeholder="Block Title"
                                />
                                <button onClick={() => removeBlock(bIdx)} className="text-slate-300 hover:text-red-500 transition-colors">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Tasks List */}
                            <div className="space-y-2 mb-4 pl-2">
                                {block.tasks && block.tasks.map((task, tIdx) => (
                                    <div key={task.id} className="flex items-center gap-2 text-sm">
                                        <span className={`shrink-0 w-20 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded text-center ${
                                            task.type === 'FA' ? 'bg-indigo-100 text-indigo-700' : 
                                            task.type === 'VIDEO' ? 'bg-blue-100 text-blue-700' :
                                            task.type === 'ANKI' ? 'bg-amber-100 text-amber-700' :
                                            task.type === 'REVISION' ? 'bg-fuchsia-100 text-fuchsia-700' :
                                            'bg-emerald-100 text-emerald-700'
                                        }`}>
                                            {task.type}
                                        </span>
                                        
                                        {/* Dynamic Input based on Type */}
                                        {task.type === 'FA' ? (
                                            <div className="flex items-center gap-2 flex-1">
                                                <span className="text-slate-400 text-xs">Page:</span>
                                                <input 
                                                    className="w-16 p-1 border rounded text-center bg-white dark:bg-slate-700 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500" 
                                                    placeholder="#"
                                                    value={task.detail}
                                                    onChange={(e) => updateTask(bIdx, tIdx, { detail: e.target.value })}
                                                />
                                            </div>
                                        ) : task.type === 'VIDEO' ? (
                                            <input 
                                                className="flex-1 p-1 border rounded px-2 bg-white dark:bg-slate-700 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500" 
                                                placeholder="Video Topic..."
                                                value={task.detail}
                                                onChange={(e) => updateTask(bIdx, tIdx, { detail: e.target.value })}
                                            />
                                        ) : task.type === 'REVISION' ? (
                                            <input 
                                                className="flex-1 p-1 border rounded px-2 bg-white dark:bg-slate-700 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500" 
                                                placeholder="Revision Topic..."
                                                value={task.detail}
                                                onChange={(e) => updateTask(bIdx, tIdx, { detail: e.target.value })}
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2 flex-1">
                                                <span className="text-slate-400 text-xs">Count:</span>
                                                <input 
                                                    className="w-20 p-1 border rounded text-center bg-white dark:bg-slate-700 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500" 
                                                    placeholder="0"
                                                    type="number"
                                                    value={task.meta?.count || ''}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value);
                                                        updateTask(bIdx, tIdx, { detail: `${e.target.value} items`, meta: { ...task.meta, count: isNaN(val) ? 0 : val } })
                                                    }}
                                                />
                                            </div>
                                        )}

                                        <button onClick={() => removeTask(bIdx, tIdx)} className="text-slate-300 hover:text-red-400 px-2">&times;</button>
                                    </div>
                                ))}
                                {(!block.tasks || block.tasks.length === 0) && (
                                    <div className="text-xs text-slate-400 italic pl-2">No tasks added yet.</div>
                                )}
                            </div>

                            {/* Add Task Buttons */}
                            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                                <button onClick={() => addTaskToBlock(bIdx, 'FA')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors">
                                    <BookOpenIcon className="w-3 h-3 text-indigo-500" /> + Page
                                </button>
                                <button onClick={() => addTaskToBlock(bIdx, 'VIDEO')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors">
                                    <VideoIcon className="w-3 h-3 text-blue-500" /> + Video
                                </button>
                                <button onClick={() => addTaskToBlock(bIdx, 'REVISION')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/30 text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors">
                                    <ArrowPathIcon className="w-3 h-3 text-fuchsia-500" /> + Revision
                                </button>
                                <button onClick={() => addTaskToBlock(bIdx, 'ANKI')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700 hover:bg-amber-50 dark:hover:bg-amber-900/30 text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors">
                                    <FireIcon className="w-3 h-3 text-amber-500" /> + Flashcards
                                </button>
                                <button onClick={() => addTaskToBlock(bIdx, 'QBANK')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors">
                                    <CheckCircleIcon className="w-3 h-3 text-emerald-500" /> + Questions
                                </button>
                            </div>

                        </div>
                    ))}

                    <button 
                        onClick={addBlock}
                        className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all font-bold text-sm"
                    >
                        <PlusIcon className="w-5 h-5 mr-2" /> Add Time Block
                    </button>

                </div>

                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex gap-3 shrink-0 bg-white dark:bg-slate-900 rounded-b-2xl">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm">Cancel</button>
                    <button onClick={handleSave} className="flex-[2] py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-colors text-sm">Save Schedule</button>
                </div>
            </div>
        </div>
    );
};