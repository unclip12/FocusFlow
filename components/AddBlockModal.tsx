
import React, { useState, useEffect } from 'react';
import { BlockTask, KnowledgeBaseEntry, SYSTEMS, CATEGORIES } from '../types';
import { XMarkIcon, PlusIcon, TrashIcon, BookOpenIcon, FireIcon, CheckCircleIcon, VideoIcon, ChevronDownIcon } from './Icons';

interface AddBlockModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (title: string, startTime: string, endTime: string, tasks: BlockTask[]) => void;
    initialStartTime?: string;
    knowledgeBase?: KnowledgeBaseEntry[];
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

export const AddBlockModal: React.FC<AddBlockModalProps> = ({ isOpen, onClose, onSave, initialStartTime = '08:00', knowledgeBase = [] }) => {
    const [title, setTitle] = useState('Study Block');
    const [startTime, setStartTime] = useState(initialStartTime);
    const [endTime, setEndTime] = useState('');
    const [tasks, setTasks] = useState<BlockTask[]>([]);
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setTitle('Study Block');
            setStartTime(initialStartTime);
            // Default 60m
            const [h, m] = initialStartTime.split(':').map(Number);
            const d = new Date();
            d.setHours(h, m + 60);
            setEndTime(d.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'}));
            setTasks([]);
            setExpandedTaskId(null);
        }
    }, [isOpen, initialStartTime]);

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
                url: ''
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
            onSave(title, startTime, endTime, tasks);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                    <div className="flex-1 mr-4">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Block Title</label>
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
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Time Window</label>
                        <div className="flex items-center gap-3 mb-3">
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
                                <button onClick={() => addTask('ANKI')} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600 dark:text-amber-400 shadow-sm transition-colors" title="Add Flashcards">
                                    <FireIcon className="w-4 h-4" />
                                </button>
                                <button onClick={() => addTask('QBANK')} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 shadow-sm transition-colors" title="Add Questions">
                                    <CheckCircleIcon className="w-4 h-4" />
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
                                                'bg-emerald-100 text-emerald-600'
                                            }`}>
                                                {task.type === 'FA' && <BookOpenIcon className="w-4 h-4" />}
                                                {task.type === 'VIDEO' && <VideoIcon className="w-4 h-4" />}
                                                {task.type === 'ANKI' && <FireIcon className="w-4 h-4" />}
                                                {task.type === 'QBANK' && <CheckCircleIcon className="w-4 h-4" />}
                                                {task.type === 'OTHER' && <PlusIcon className="w-4 h-4" />}
                                            </span>
                                            
                                            <div className="flex-1">
                                                {isExpanded ? (
                                                    <div className="flex gap-2">
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
                                                            <input 
                                                                className="flex-1 p-1 border rounded text-sm bg-white dark:bg-slate-900 dark:text-white font-bold"
                                                                placeholder="Video Title"
                                                                value={task.detail}
                                                                onChange={(e) => updateTask(task.id, { detail: e.target.value })}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <input 
                                                                    className="w-20 p-1 border rounded text-sm bg-white dark:bg-slate-900 dark:text-white font-bold"
                                                                    placeholder="Count"
                                                                    type="number"
                                                                    value={task.meta?.count || ''}
                                                                    onChange={(e) => {
                                                                        const val = parseInt(e.target.value);
                                                                        updateTask(task.id, { detail: `${val} items`, meta: { ...task.meta, count: val } })
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
                                                                // Getting value from sibling input is tricky in React without ref/state,
                                                                // relying on Enter key for now or better state management if button needed.
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

                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex gap-3 shrink-0">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm">Cancel</button>
                    <button onClick={handleSave} disabled={!startTime || !endTime} className="flex-[2] py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg transition-colors text-sm disabled:opacity-50">Create Block</button>
                </div>
            </div>
        </div>
    );
};
