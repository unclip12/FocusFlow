

import React, { useState, useEffect } from 'react';
import { Block, BlockTask, KnowledgeBaseEntry, SYSTEMS, CATEGORIES } from '../types';
import { XMarkIcon, PlusIcon, TrashIcon, BookOpenIcon, StarIcon, QIcon, VideoIcon, ChevronDownIcon, CalendarIcon, ArrowPathIcon } from './Icons';

interface AddBlockModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (title: string, startTime: string, endTime: string, tasks: BlockTask[], date?: string) => void;
    initialStartTime?: string;
    initialDate?: string;
    knowledgeBase?: KnowledgeBaseEntry[];
    blockToEdit?: Block | null;
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

export const AddBlockModal: React.FC<AddBlockModalProps> = ({ isOpen, onClose, onSave, initialStartTime = '08:00', initialDate, knowledgeBase = [], blockToEdit }) => {
    const [title, setTitle] = useState('Study Block');
    const [startTime, setStartTime] = useState(initialStartTime);
    const [endTime, setEndTime] = useState('');
    const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
    const [tasks, setTasks] = useState<BlockTask[]>([]);
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

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
            if (blockToEdit) {
                setTitle(blockToEdit.title);
                setStartTime(blockToEdit.plannedStartTime);
                setEndTime(blockToEdit.plannedEndTime);
                setDate(blockToEdit.date);
                // Deep copy tasks to avoid mutating original object directly before save
                setTasks(blockToEdit.tasks ? JSON.parse(JSON.stringify(blockToEdit.tasks)) : []);
                setExpandedTaskId(null);
            } else {
                setTitle('Study Block');
                setStartTime(initialStartTime);
                setDate(initialDate || new Date().toISOString().split('T')[0]);
                // Default 30m
                const [h, m] = initialStartTime.split(':').map(Number);
                const d = new Date();
                d.setHours(h, m + 30);
                setEndTime(d.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'}));
                setTasks([]);
                setExpandedTaskId(null);
            }
        }
    }, [isOpen, initialStartTime, initialDate, blockToEdit]);

    const adjustEndTime = (minutes: number) => {
        if (!startTime) return;
        const [h, m] = startTime.split(':').map(Number);
        const d = new Date();
        d.setHours(h, m + minutes);
        setEndTime(d.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'}));
    };

    const addTask = (type: BlockTask['type']) => {
        const newTask: BlockTask = {
            id: generateId(),
            type,
            detail: '',
            completed: false,
            meta: {
                pageNumber: type === 'FA' ? undefined : undefined,
                count: type === 'ANKI' || type === 'QBANK' ? 0 : undefined,
                topic: '',
                system: '',
                subject: '',
                subtopics: [],
                url: '',
                videoDuration: undefined,
                videoStartTime: undefined,
                videoEndTime: undefined,
                playbackSpeed: 2 // Default to 2x
            }
        };
        setTasks([...tasks, newTask]);
        setExpandedTaskId(newTask.id); // Auto expand new task
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

    // Sync Logic
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

    const handleAddSubtopic = (taskId: string, subtopic: string) => {
        if (!subtopic.trim()) return;
        const task = tasks.find(t => t.id === taskId);
        if (task && task.meta) {
            const current = task.meta.subtopics || [];
            updateTaskMeta(taskId, { subtopics: [...current, subtopic] });
        }
    };

    const handleRemoveSubtopic = (taskId: string, index: number) => {
        const task = tasks.find(t => t.id === taskId);
        if (task && task.meta && task.meta.subtopics) {
            const newSubtopics = [...task.meta.subtopics];
            newSubtopics.splice(index, 1);
            updateTaskMeta(taskId, { subtopics: newSubtopics });
        }
    };

    const handleSave = () => {
        if (startTime && endTime) {
            onSave(title, startTime, endTime, tasks, date);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                    <div className="flex-1 mr-4">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">{blockToEdit ? 'Edit Block Title' : 'New Block Title'}</label>
                        <input 
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full bg-transparent text-xl font-bold text-slate-800 dark:text-white outline-none placeholder-slate-300"
                            placeholder="e.g. Morning Cardio Study"
                        />
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><XMarkIcon className="w-6 h-6 text-slate-400" /></button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-950/50">
                    
                    {/* Time Controls */}
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Time & Date</label>
                            
                            {/* Date Input */}
                            <div className="relative group">
                                 <input 
                                     type="date" 
                                     value={date} 
                                     onChange={(e) => setDate(e.target.value)}
                                     className="pl-8 pr-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                 />
                                 <CalendarIcon className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        </div>

                        <div className="flex items-center gap-8 mb-3">
                            <div className="flex-1">
                                <label className="text-[10px] text-slate-400 font-bold mb-1 block">Start</label>
                                <input 
                                    type="time" 
                                    value={startTime} 
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 font-bold text-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] text-slate-400 font-bold mb-1 block">End</label>
                                <input 
                                    type="time" 
                                    value={endTime} 
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 font-bold text-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {[15, 30, 45, 60, 90].map(min => (
                                <button 
                                    key={min} 
                                    onClick={() => adjustEndTime(min)}
                                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-300 transition-colors shadow-sm"
                                >
                                    +{min}m
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tasks */}
                    <div>
                        <div className="flex justify-between items-end mb-3">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tasks & Content</label>
                            <div className="flex gap-2">
                                <button onClick={() => addTask('FA')} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 shadow-sm transition-colors" title="Add First Aid Page">
                                    <BookOpenIcon className="w-4 h-4" />
                                </button>
                                <button onClick={() => addTask('VIDEO')} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm transition-colors" title="Add Video">
                                    <VideoIcon className="w-4 h-4" />
                                </button>
                                <button onClick={() => addTask('REVISION')} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/20 text-fuchsia-600 dark:text-fuchsia-400 shadow-sm transition-colors" title="Add Revision">
                                    <ArrowPathIcon className="w-4 h-4" />
                                </button>
                                <button onClick={() => addTask('ANKI')} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600 dark:text-amber-400 shadow-sm transition-colors" title="Add Flashcards">
                                    <StarIcon className="w-4 h-4" />
                                </button>
                                <button onClick={() => addTask('QBANK')} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 shadow-sm transition-colors" title="Add Questions">
                                    <QIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {tasks.map((task) => {
                                const isExpanded = expandedTaskId === task.id;
                                return (
                                    <div key={task.id} className={`bg-white dark:bg-slate-800 rounded-xl border transition-all ${isExpanded ? 'border-indigo-300 dark:border-indigo-700 shadow-md ring-1 ring-indigo-100 dark:ring-indigo-900' : 'border-slate-200 dark:border-slate-700 shadow-sm'}`}>
                                        {/* Task Header */}
                                        <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}>
                                            <span className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg ${
                                                task.type === 'FA' ? 'bg-indigo-100 text-indigo-600' : 
                                                task.type === 'VIDEO' ? 'bg-blue-100 text-blue-600' :
                                                task.type === 'ANKI' ? 'bg-amber-100 text-amber-600' :
                                                task.type === 'REVISION' ? 'bg-fuchsia-100 text-fuchsia-600' :
                                                'bg-emerald-100 text-emerald-600'
                                            }`}>
                                                {task.type === 'FA' && <BookOpenIcon className="w-4 h-4" />}
                                                {task.type === 'VIDEO' && <VideoIcon className="w-4 h-4" />}
                                                {task.type === 'ANKI' && <StarIcon className="w-4 h-4" />}
                                                {task.type === 'QBANK' && <QIcon className="w-4 h-4" />}
                                                {task.type === 'REVISION' && <ArrowPathIcon className="w-4 h-4" />}
                                                {task.type === 'OTHER' && <PlusIcon className="w-4 h-4" />}
                                            </span>
                                            
                                            <div className="flex-1">
                                                {isExpanded ? (
                                                    <div className="flex gap-2 items-center">
                                                        {task.type === 'FA' ? (
                                                            <input 
                                                                className="w-24 p-1 border rounded text-sm bg-white dark:bg-slate-900 dark:text-white font-bold"
                                                                placeholder="Page #"
                                                                value={task.detail}
                                                                onChange={(e) => updateTask(task.id, { detail: e.target.value })}
                                                                onBlur={(e) => handlePageBlur(task.id, e.target.value)}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        ) : task.type === 'VIDEO' ? (
                                                            <div className="flex flex-1 gap-2 items-center">
                                                                <input 
                                                                    className="flex-[2] p-1 border rounded px-2 bg-white dark:bg-slate-700 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                                                                    placeholder="Video Title"
                                                                    value={task.detail}
                                                                    onChange={(e) => updateTask(task.id, { detail: e.target.value })}
                                                                    onClick={(e) => e.stopPropagation()}
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
                                                                            updateTaskMeta(task.id, { videoStartTime: start, videoDuration: Math.max(0, end - start) });
                                                                        }}
                                                                        onClick={(e) => e.stopPropagation()}
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
                                                                            updateTaskMeta(task.id, { videoEndTime: end, videoDuration: Math.max(0, end - start) });
                                                                        }}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    />
                                                                    <select
                                                                        className="w-14 p-1 border rounded text-center bg-white dark:bg-slate-700 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                                                                        value={task.meta?.playbackSpeed || 2}
                                                                        onChange={(e) => updateTaskMeta(task.id, { playbackSpeed: parseFloat(e.target.value) })}
                                                                        onClick={(e) => e.stopPropagation()}
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
                                                        ) : task.type === 'REVISION' ? (
                                                            <div className="flex gap-2 items-center flex-1">
                                                                <input 
                                                                    className="flex-1 p-1 border rounded px-2 bg-white dark:bg-slate-700 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                                                                    placeholder="Revision Topic..."
                                                                    value={task.detail}
                                                                    onChange={(e) => updateTask(task.id, { detail: e.target.value })}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <input 
                                                                    className="w-20 p-1 border rounded text-center bg-white dark:bg-slate-900 dark:text-white font-bold"
                                                                    placeholder="Count"
                                                                    type="number"
                                                                    value={task.meta?.count || ''}
                                                                    onChange={(e) => {
                                                                        const val = parseInt(e.target.value);
                                                                        updateTask(task.id, { detail: `${val} items`, meta: { ...task.meta, count: isNaN(val) ? 0 : val } })
                                                                    }}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                                <span className="text-xs text-slate-400 font-bold uppercase">{task.type === 'ANKI' ? 'Cards' : 'Questions'}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-sm text-slate-800 dark:text-white">{task.type === 'FA' ? `Page ${task.detail || '?'}` : task.detail || 'New Task'}</span>
                                                        {task.meta?.topic && <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{task.meta.topic}</span>}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                <button onClick={(e) => { e.stopPropagation(); removeTask(task.id); }} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"><TrashIcon className="w-4 h-4"/></button>
                                            </div>
                                        </div>

                                        {/* Expanded Content */}
                                        {isExpanded && (
                                            <div className="p-3 pt-0 border-t border-slate-100 dark:border-slate-700 space-y-3 mt-1">
                                                {/* Topic */}
                                                <div>
                                                    <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block mt-2">Topic</label>
                                                    <input 
                                                        value={task.meta?.topic || ''}
                                                        onChange={e => updateTaskMeta(task.id, { topic: e.target.value })}
                                                        className="w-full p-2 rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm"
                                                        placeholder="Main Topic..."
                                                    />
                                                </div>

                                                {/* Video URL */}
                                                {task.type === 'VIDEO' && (
                                                    <div>
                                                        <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">URL</label>
                                                        <input 
                                                            value={task.meta?.url || ''}
                                                            onChange={e => updateTaskMeta(task.id, { url: e.target.value })}
                                                            className="w-full p-2 rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm text-blue-600"
                                                            placeholder="https://..."
                                                        />
                                                    </div>
                                                )}

                                                {/* System & Subject */}
                                                <div className="flex gap-2">
                                                    <div className="flex-1">
                                                        <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">System</label>
                                                        <select 
                                                            value={task.meta?.system || ''}
                                                            onChange={e => updateTaskMeta(task.id, { system: e.target.value })}
                                                            className="w-full p-2 rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm"
                                                        >
                                                            <option value="">Select...</option>
                                                            {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Subject</label>
                                                        <select 
                                                            value={task.meta?.subject || ''}
                                                            onChange={e => updateTaskMeta(task.id, { subject: e.target.value })}
                                                            className="w-full p-2 rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm"
                                                        >
                                                            <option value="">Select...</option>
                                                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Subtopics */}
                                                <div>
                                                    <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Subtopics</label>
                                                    <div className="flex flex-wrap gap-2 mb-2">
                                                        {(task.meta?.subtopics || []).map((sub, idx) => (
                                                            <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-xs font-medium border border-indigo-100 dark:border-indigo-800">
                                                                <span>{sub}</span>
                                                                <button onClick={() => handleRemoveSubtopic(task.id, idx)} className="hover:text-red-500">&times;</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <input 
                                                            className="flex-1 p-2 rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm"
                                                            placeholder="Add subtopic..."
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    handleAddSubtopic(task.id, e.currentTarget.value);
                                                                    e.currentTarget.value = '';
                                                                }
                                                            }}
                                                        />
                                                        <button 
                                                            className="px-3 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300 font-bold text-lg"
                                                            onClick={(e) => {
                                                                // Simplified: Just use enter key for this quick interaction.
                                                            }}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {tasks.length === 0 && <p className="text-center text-slate-400 text-sm italic py-4">No tasks added. Click buttons above.</p>}
                        </div>
                    </div>

                </div>

                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex gap-3 shrink-0 bg-white dark:bg-slate-900 rounded-b-2xl">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm">Cancel</button>
                    <button onClick={handleSave} disabled={!startTime || !endTime} className="flex-[2] py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg transition-colors text-sm disabled:opacity-50">{blockToEdit ? 'Update Block' : 'Create Block'}</button>
                </div>
            </div>
        </div>
    );
};