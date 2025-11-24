

import React, { useState, useEffect } from 'react';
import { Block, BlockTask } from '../types';
import { XMarkIcon, PencilSquareIcon, CheckCircleIcon, TrashIcon, ClockIcon } from './Icons';

interface BlockDetailModalProps {
    isOpen: boolean;
    block: Block | null;
    onClose: () => void;
    onUpdate: (updatedBlock: Block) => void;
    onReschedule: (action: { type: 'NEW_BLOCK' | 'NEXT_BLOCK', time?: string, duration?: number, tasks: BlockTask[] }) => void;
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

export const BlockDetailModal: React.FC<BlockDetailModalProps> = ({ isOpen, block, onClose, onUpdate, onReschedule }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Block | null>(null);
    const [newTaskDetail, setNewTaskDetail] = useState('');
    
    // Reschedule inputs
    const [rescheduleMode, setRescheduleMode] = useState<'NEW_BLOCK' | 'NEXT_BLOCK' | null>(null);
    const [rescheduleStart, setRescheduleStart] = useState('');

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
        if (block) {
            setFormData(JSON.parse(JSON.stringify(block)));
            setIsEditing(false);
            setRescheduleMode(null);
            
            const now = new Date();
            setRescheduleStart(now.toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}));
        }
    }, [block, isOpen]);

    if (!isOpen || !block || !formData) return null;

    const handleSave = () => {
        if (formData) {
            onUpdate(formData);
            
            if (rescheduleMode) {
                const incompleteTasks = formData.tasks?.filter(t => !t.execution?.completed) || [];
                if (incompleteTasks.length > 0) {
                    onReschedule({
                        type: rescheduleMode,
                        time: rescheduleStart,
                        duration: formData.plannedDurationMinutes,
                        tasks: incompleteTasks
                    });
                }
            }
            onClose();
        }
    };

    const toggleTaskCompletion = (idx: number) => {
        if (!formData.tasks) return;
        const tasks = [...formData.tasks];
        const current = tasks[idx].execution?.completed || false;
        tasks[idx] = {
            ...tasks[idx],
            execution: { ...tasks[idx].execution, completed: !current }
        };
        setFormData({ ...formData, tasks });
    };

    const updateTaskDetail = (idx: number, val: string) => {
        if (!formData.tasks) return;
        const tasks = [...formData.tasks];
        tasks[idx].detail = val;
        setFormData({ ...formData, tasks });
    };

    const updateTaskMeta = (idx: number, metaUpdates: Partial<BlockTask['meta']>) => {
        if (!formData.tasks) return;
        const tasks = [...formData.tasks];
        tasks[idx] = { ...tasks[idx], meta: { ...tasks[idx].meta, ...metaUpdates } };
        setFormData({ ...formData, tasks });
    };

    const addTask = () => {
        if (!newTaskDetail.trim()) return;
        const newTask: BlockTask = {
            id: generateId(),
            type: 'OTHER',
            detail: newTaskDetail,
            completed: false,
            execution: { completed: false }
        };
        setFormData({
            ...formData,
            tasks: [...(formData.tasks || []), newTask]
        });
        setNewTaskDetail('');
    };

    const removeTask = (idx: number) => {
        if (!formData.tasks) return;
        const tasks = [...formData.tasks];
        tasks.splice(idx, 1);
        setFormData({ ...formData, tasks });
    };

    const incompleteCount = formData.tasks?.filter(t => !t.execution?.completed).length || 0;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                    <div className="flex-1">
                        {isEditing ? (
                            <input 
                                type="text" 
                                value={formData.title} 
                                onChange={e => setFormData({...formData, title: e.target.value})}
                                className="font-bold text-lg bg-slate-100 dark:bg-slate-800 rounded px-2 py-1 w-full"
                            />
                        ) : (
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white truncate pr-4">{block.title}</h3>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {!isEditing && (
                            <button onClick={() => setIsEditing(true)} className="p-2 text-slate-400 hover:text-indigo-500 transition-colors">
                                <PencilSquareIcon className="w-5 h-5" />
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                            <XMarkIcon className="w-6 h-6 text-slate-400" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Planned</div>
                            {isEditing ? (
                                <div className="flex gap-2 items-center">
                                    <input type="time" value={formData.plannedStartTime} onChange={e => setFormData({...formData, plannedStartTime: e.target.value})} className="bg-white dark:bg-slate-900 rounded px-1 w-full text-sm font-mono" />
                                    <span>-</span>
                                    <input type="time" value={formData.plannedEndTime} onChange={e => setFormData({...formData, plannedEndTime: e.target.value})} className="bg-white dark:bg-slate-900 rounded px-1 w-full text-sm font-mono" />
                                </div>
                            ) : (
                                <div className="font-mono font-bold text-slate-700 dark:text-slate-200">
                                    {formData.plannedStartTime} - {formData.plannedEndTime}
                                </div>
                            )}
                        </div>
                        <div className={`p-3 rounded-xl border ${formData.status === 'DONE' ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Actual</div>
                            {isEditing ? (
                                <div className="flex gap-2 items-center">
                                    <input type="time" value={formData.actualStartTime || ''} onChange={e => setFormData({...formData, actualStartTime: e.target.value})} className="bg-white dark:bg-slate-900 rounded px-1 w-full text-sm font-mono" />
                                    <span>-</span>
                                    <input type="time" value={formData.actualEndTime || ''} onChange={e => setFormData({...formData, actualEndTime: e.target.value})} className="bg-white dark:bg-slate-900 rounded px-1 w-full text-sm font-mono" />
                                </div>
                            ) : (
                                <div className="font-mono font-bold text-slate-700 dark:text-slate-200">
                                    {formData.actualStartTime || '--:--'} - {formData.actualEndTime || '--:--'}
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Tasks & Execution</h4>
                        <div className="space-y-2">
                            {formData.tasks?.map((task, idx) => (
                                <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <button 
                                        onClick={() => isEditing && toggleTaskCompletion(idx)} 
                                        className={`shrink-0 transition-colors ${!isEditing ? 'cursor-default' : ''}`}
                                        disabled={!isEditing}
                                    >
                                        {task.execution?.completed ? (
                                            <CheckCircleIcon className="w-5 h-5 text-green-500" />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600"></div>
                                        )}
                                    </button>
                                    
                                    {isEditing ? (
                                        task.type === 'VIDEO' ? (
                                            <div className="flex flex-1 gap-2 items-center">
                                                <input 
                                                    value={task.detail}
                                                    onChange={e => updateTaskDetail(idx, e.target.value)}
                                                    className="flex-[2] bg-slate-100 dark:bg-slate-900 rounded px-2 py-1 text-sm"
                                                    placeholder="Video Title"
                                                />
                                                <div className="flex items-center gap-1">
                                                    <input 
                                                        type="number"
                                                        className="w-12 p-1 border rounded text-center bg-white dark:bg-slate-700 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500 text-[10px] sm:text-xs"
                                                        placeholder="Start"
                                                        value={task.meta?.videoStartTime ?? ''}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value);
                                                            const start = isNaN(val) ? 0 : val;
                                                            const end = task.meta?.videoEndTime || 0;
                                                            updateTaskMeta(idx, { videoStartTime: start, videoDuration: Math.max(0, end - start) });
                                                        }}
                                                    />
                                                    <span className="text-slate-400 text-[10px]">-</span>
                                                    <input 
                                                        type="number"
                                                        className="w-12 p-1 border rounded text-center bg-white dark:bg-slate-700 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500 text-[10px] sm:text-xs"
                                                        placeholder="End"
                                                        value={task.meta?.videoEndTime ?? ''}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value);
                                                            const end = isNaN(val) ? 0 : val;
                                                            const start = task.meta?.videoStartTime || 0;
                                                            updateTaskMeta(idx, { videoEndTime: end, videoDuration: Math.max(0, end - start) });
                                                        }}
                                                    />
                                                    <select
                                                        className="w-14 p-1 border rounded text-sm bg-white dark:bg-slate-900 dark:text-white text-center"
                                                        value={task.meta?.playbackSpeed || 2}
                                                        onChange={(e) => updateTaskMeta(idx, { playbackSpeed: parseFloat(e.target.value) })}
                                                    >
                                                        <option value="1">1x</option>
                                                        <option value="1.25">1.25x</option>
                                                        <option value="1.5">1.5x</option>
                                                        <option value="1.75">1.75x</option>
                                                        <option value="2">2x</option>
                                                        <option value="2.5">2.5x</option>
                                                        <option value="3">3x</option>
                                                    </select>
                                                    {task.meta?.videoDuration && task.meta?.playbackSpeed && (
                                                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 w-10 text-right">
                                                            ~{Math.ceil(task.meta.videoDuration / task.meta.playbackSpeed)}m
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <input 
                                                value={task.detail}
                                                onChange={e => updateTaskDetail(idx, e.target.value)}
                                                className="flex-1 bg-slate-100 dark:bg-slate-900 rounded px-2 py-1 text-sm"
                                            />
                                        )
                                    ) : (
                                        <div className="flex-1 flex justify-between items-center">
                                            <span className={`text-sm ${task.execution?.completed ? 'text-slate-800 dark:text-white' : 'text-slate-500'}`}>{task.detail}</span>
                                            {task.type === 'VIDEO' && task.meta?.videoDuration && task.meta?.playbackSpeed && (
                                                <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-500 dark:text-slate-400">
                                                    {task.meta.videoDuration}m @ {task.meta.playbackSpeed}x
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {isEditing && (
                                        <button onClick={() => removeTask(idx)} className="text-slate-400 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                                    )}
                                </div>
                            ))}
                            
                            {isEditing && (
                                <div className="flex gap-2 mt-2">
                                    <input 
                                        value={newTaskDetail}
                                        onChange={e => setNewTaskDetail(e.target.value)}
                                        placeholder="Add new task..."
                                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 py-2 text-sm"
                                        onKeyDown={e => e.key === 'Enter' && addTask()}
                                    />
                                    <button onClick={addTask} className="px-3 bg-indigo-100 text-indigo-600 rounded font-bold">+</button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Notes</h4>
                        {isEditing ? (
                            <textarea 
                                value={formData.actualNotes || ''}
                                onChange={e => setFormData({...formData, actualNotes: e.target.value})}
                                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                                rows={3}
                            />
                        ) : (
                            <p className="text-sm text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                {formData.actualNotes || 'No notes.'}
                            </p>
                        )}
                    </div>

                    {isEditing && incompleteCount > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl p-4">
                            <h4 className="text-xs font-bold text-amber-600 uppercase mb-3">Reschedule {incompleteCount} Remaining Tasks</h4>
                            <div className="space-y-3">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="reschedule" 
                                        checked={rescheduleMode === 'NEXT_BLOCK'} 
                                        onChange={() => setRescheduleMode('NEXT_BLOCK')}
                                        className="text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Move to Next Block</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="reschedule" 
                                        checked={rescheduleMode === 'NEW_BLOCK'} 
                                        onChange={() => setRescheduleMode('NEW_BLOCK')}
                                        className="text-amber-600 focus:ring-amber-500"
                                    />
                                    <div className="flex-1">
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Create New Block</span>
                                        {rescheduleMode === 'NEW_BLOCK' && (
                                            <div className="mt-2 flex items-center gap-2">
                                                <ClockIcon className="w-4 h-4 text-slate-400" />
                                                <input 
                                                    type="time" 
                                                    value={rescheduleStart}
                                                    onChange={e => setRescheduleStart(e.target.value)}
                                                    className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded