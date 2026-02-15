
import React, { useState, useEffect } from 'react';
import { getMentorMemoryData, saveMentorMemoryData } from '../services/firebase';
import { MentorMemory, BacklogItem } from '../types';
import { BrainIcon, PencilSquareIcon, CheckCircleIcon, XMarkIcon, TrashIcon, FireIcon, ExclamationCircleIcon } from './Icons';

interface AIMemoryViewProps {
    displayName: string;
    onUpdateDisplayName: (name: string) => void;
}

export const AIMemoryView: React.FC<AIMemoryViewProps> = ({ displayName, onUpdateDisplayName }) => {
    const [memory, setMemory] = useState<MentorMemory | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    
    // Edit Form State
    const [editForm, setEditForm] = useState<MentorMemory>({});
    const [localName, setLocalName] = useState(displayName);

    useEffect(() => {
        loadMemory();
    }, []);

    useEffect(() => {
        setLocalName(displayName);
    }, [displayName]);

    const loadMemory = async () => {
        setLoading(true);
        try {
            const data = await getMentorMemoryData();
            if (data) {
                setMemory(data);
                setEditForm(data);
            } else {
                // Initialize default
                const defaultMem: MentorMemory = {
                    preferredTone: 'strict',
                    examTarget: 'FMGE',
                    backlog: []
                };
                setMemory(defaultMem);
                setEditForm(defaultMem);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        if (localName.trim() !== displayName) {
            onUpdateDisplayName(localName.trim());
        }
        await saveMentorMemoryData(editForm);
        setMemory(editForm);
        setIsEditing(false);
        setLoading(false);
    };

    const handleClearBacklog = async () => {
        if (confirm("STRICT WARNING: Clearing the backlog tells the AI you have completely dropped these tasks. Are you sure?")) {
            const updated = { ...memory, backlog: [] };
            await saveMentorMemoryData(updated);
            setMemory(updated);
            setEditForm(updated as MentorMemory);
        }
    };

    const removeBacklogItem = async (id: string) => {
        if (!memory?.backlog) return;
        const updatedBacklog = memory.backlog.filter(b => b.id !== id);
        const updatedMem = { ...memory, backlog: updatedBacklog };
        await saveMentorMemoryData(updatedMem);
        setMemory(updatedMem);
        setEditForm(updatedMem as MentorMemory);
    };

    if (loading && !memory) {
        return <div className="p-8 flex justify-center text-slate-400 animate-pulse">Accessing Neural Memory...</div>;
    }

    return (
        <div className="animate-fade-in space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-100/50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl backdrop-blur-sm">
                        <BrainIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">My AI Memory</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">What the Mentor knows about you</p>
                    </div>
                </div>
                {!isEditing ? (
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/80 transition-colors font-bold text-xs backdrop-blur-sm"
                    >
                        <PencilSquareIcon className="w-4 h-4" /> Edit Profile
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={() => setIsEditing(false)} className="p-2 text-slate-400 hover:text-slate-600"><XMarkIcon className="w-5 h-5" /></button>
                        <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold text-xs shadow-md">
                            <CheckCircleIcon className="w-4 h-4" /> Save
                        </button>
                    </div>
                )}
            </div>

            {/* PROFILE CARD */}
            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-slate-700/50 p-6 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Core Profile</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Your Name</label>
                        {isEditing ? (
                             <input 
                                type="text" 
                                value={localName || ''} 
                                onChange={e => setLocalName(e.target.value)}
                                className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm"
                            />
                        ) : (
                             <p className="text-lg font-medium text-slate-900 dark:text-white">{displayName || 'Not set'}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Exam Target</label>
                        {isEditing ? (
                            <input 
                                type="text" 
                                value={editForm.examTarget || ''} 
                                onChange={e => setEditForm({...editForm, examTarget: e.target.value})}
                                className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm"
                            />
                        ) : (
                            <p className="text-lg font-medium text-slate-900 dark:text-white">{memory?.examTarget || 'Not set'}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Exam Date</label>
                        {isEditing ? (
                            <input 
                                type="date" 
                                value={editForm.examDate || ''} 
                                onChange={e => setEditForm({...editForm, examDate: e.target.value})}
                                className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm"
                            />
                        ) : (
                            <p className="text-lg font-medium text-slate-900 dark:text-white">{memory?.examDate || 'Not set'}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Mentor Tone</label>
                        {isEditing ? (
                            <select 
                                value={editForm.preferredTone || 'strict'} 
                                onChange={e => setEditForm({...editForm, preferredTone: e.target.value as any})}
                                className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm"
                            >
                                <option value="strict">Strict Coach</option>
                                <option value="encouraging">Encouraging Friend</option>
                                <option value="balanced">Balanced</option>
                            </select>
                        ) : (
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${memory?.preferredTone === 'strict' ? 'bg-red-100/50 text-red-700' : 'bg-green-100/50 text-green-700'} backdrop-blur-sm`}>
                                {memory?.preferredTone || 'Strict'}
                            </span>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Learning Style Note</label>
                        {isEditing ? (
                            <input 
                                type="text" 
                                value={editForm.learningStyle || ''} 
                                onChange={e => setEditForm({...editForm, learningStyle: e.target.value})}
                                className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm"
                                placeholder="e.g. Visual learner, hates reading text"
                            />
                        ) : (
                            <p className="text-sm text-slate-600 dark:text-slate-400 italic">{memory?.learningStyle || 'No specific style noted.'}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* BACKLOG SECTION - FIXED: Softened red border */}
            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-amber-100/40 dark:border-amber-900/20 p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                        <ExclamationCircleIcon className="w-5 h-5" />
                        <h3 className="text-sm font-bold uppercase tracking-widest">Critical Backlog</h3>
                    </div>
                    {memory?.backlog && memory.backlog.length > 0 && (
                        <button onClick={handleClearBacklog} className="text-xs text-amber-600 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400 font-bold">Clear All</button>
                    )}
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    Items listed here will be forcefully prioritized by the AI Mentor until cleared.
                </div>

                {memory?.backlog && memory.backlog.length > 0 ? (
                    <div className="space-y-3">
                        {memory.backlog.map((item, idx) => (
                            <div key={idx} className="flex items-start justify-between p-3 bg-amber-50/30 dark:bg-amber-900/10 border border-amber-100/40 dark:border-amber-900/20 rounded-xl backdrop-blur-sm">
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{item.task}</p>
                                    <div className="flex gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        <span className="flex items-center gap-1"><FireIcon className="w-3 h-3 text-amber-500" /> {item.estimatedMinutes}m</span>
                                        <span>Originally Due: {item.dateOriginal}</span>
                                    </div>
                                </div>
                                <button onClick={() => removeBacklogItem(item.id)} className="p-2 text-slate-400 hover:text-green-500" title="Mark Handled">
                                    <CheckCircleIcon className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-xl">
                        <p className="text-slate-400 text-sm">No backlog items. Excellent work!</p>
                    </div>
                )}
            </div>

            {/* RAW NOTES */}
            <div className="bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">AI Observations</h3>
                {isEditing ? (
                    <textarea 
                        value={editForm.notes || ''}
                        onChange={e => setEditForm({...editForm, notes: e.target.value})}
                        className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-900/50 text-sm h-32 backdrop-blur-sm"
                        placeholder="General notes regarding behavior..."
                    />
                ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{memory?.notes || 'No observations yet.'}</p>
                )}
            </div>
        </div>
    );
};
