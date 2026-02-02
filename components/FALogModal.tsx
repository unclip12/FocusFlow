

import React, { useState, useEffect } from 'react';
import { KnowledgeBaseEntry, TrackableItem, getAdjustedDate, FALogData } from '../types';
import { XMarkIcon, BookOpenIcon, ClockIcon, PlusIcon, CheckCircleIcon, TrashIcon, HistoryIcon, ArrowPathIcon } from './Icons';

interface FALogModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: FALogData) => void;
    knowledgeBase: KnowledgeBaseEntry[];
    initialData?: FALogData | null; // If editing
    mode?: 'STUDY' | 'REVISION';
    onDeletePastLog?: (logId: string, pageNumber: string) => void;
    onStateChange?: (data: FALogData) => void; // New prop for reporting state
}

export const FALogModal: React.FC<FALogModalProps> = ({ isOpen, onClose, onSave, knowledgeBase, initialData, mode = 'STUDY', onDeletePastLog, onStateChange }) => {
    const [pageNumber, setPageNumber] = useState('');
    const [date, setDate] = useState(getAdjustedDate(new Date()));
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [notes, setNotes] = useState('');
    
    // Topic Management
    const [availableTopics, setAvailableTopics] = useState<string[]>([]);
    const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
    const [newTopicInput, setNewTopicInput] = useState('');

    // Context for Revision/Smart Mode
    const [existingEntry, setExistingEntry] = useState<KnowledgeBaseEntry | null>(null);
    const [detectedMode, setDetectedMode] = useState<'STUDY' | 'REVISION'>(mode);

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

    // Initialize Data (from initialData or defaults)
    // FIX: Dependency array contains ONLY [isOpen]. This prevents infinite loops when onStateChange updates parent state.
    useEffect(() => {
        if (isOpen) {
            setDetectedMode(mode); 
            
            if (initialData) {
                // Data passed in (either edit data OR draft data from persistence)
                setPageNumber(initialData.pageNumber);
                setDate(initialData.date || getAdjustedDate(new Date()));
                
                // Fallback if times are empty/invalid in draft
                if (initialData.startTime && initialData.endTime) {
                    setStartTime(initialData.startTime);
                    setEndTime(initialData.endTime);
                } else {
                    const end = new Date();
                    const start = new Date(end.getTime() - 60 * 60000);
                    setStartTime(start.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'}));
                    setEndTime(end.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'}));
                }

                setNotes(initialData.notes);
                
                const entry = knowledgeBase.find(k => k.pageNumber === initialData.pageNumber);
                const dbTopics = entry?.topics?.map(t => t.name) || [];
                const allTopics = Array.from(new Set([...dbTopics, ...initialData.selectedTopics]));
                setAvailableTopics(allTopics);
                setSelectedTopics(new Set(initialData.selectedTopics));
                setExistingEntry(entry || null);

            } else {
                // Clean New Mode
                const now = new Date();
                setPageNumber('');
                setDate(getAdjustedDate(now));
                
                const end = new Date();
                const start = new Date(end.getTime() - 60 * 60000); // Default 60m
                
                setStartTime(start.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'}));
                setEndTime(end.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'}));
                
                setNotes('');
                setAvailableTopics([]);
                setSelectedTopics(new Set());
                setExistingEntry(null);
            }
            setNewTopicInput('');
        }
    }, [isOpen]); 

    // Report changes to parent for persistence
    useEffect(() => {
        if (onStateChange && isOpen) {
            const currentData: FALogData = {
                logId: initialData?.logId,
                pageNumber,
                date,
                startTime,
                endTime,
                notes,
                selectedTopics: Array.from(selectedTopics)
            };
            onStateChange(currentData);
        }
    }, [pageNumber, date, startTime, endTime, notes, selectedTopics, isOpen]);

    // Watch Page Number for "Smart Mode" and Context Loading
    useEffect(() => {
        if (pageNumber) {
            const entry = knowledgeBase.find(k => k.pageNumber === pageNumber);
            
            if (entry) {
                setExistingEntry(entry);
                
                const hasHistory = entry.logs && entry.logs.length > 0;

                // Only switch mode automatically if NOT loading from initialData (user might have changed it)
                // Check if current mode matches what we expect, but don't force override if user set it manually in UI
                if (!initialData) {
                    if (hasHistory) {
                        setDetectedMode('REVISION');
                    } else {
                        setDetectedMode('STUDY');
                    }
                }

                // Load topics
                const dbTopics = entry.topics.map(t => t.name);
                // If we have initialData (draft or edit), we merge topics. If new page entry, just load DB topics.
                if (!initialData || initialData.pageNumber !== pageNumber) { // If user changed page number mid-edit
                     setAvailableTopics(dbTopics);
                     // Only clear selected if we genuinely switched pages from what was in draft
                     if (initialData && initialData.pageNumber !== pageNumber) {
                         setSelectedTopics(new Set()); 
                     }
                } else {
                    // Draft exists and matches page
                    const merged = Array.from(new Set([...dbTopics, ...availableTopics]));
                    setAvailableTopics(merged);
                }
            } else {
                setExistingEntry(null);
                // Reset mode if we typed a new page number not in DB
                if (!initialData) {
                    setDetectedMode('STUDY');
                    setAvailableTopics([]);
                }
            }
        }
    }, [pageNumber, knowledgeBase]); 

    const handleToggleTopic = (topic: string) => {
        const newSet = new Set(selectedTopics);
        if (newSet.has(topic)) {
            newSet.delete(topic);
        } else {
            newSet.add(topic);
        }
        setSelectedTopics(newSet);
    };

    const handleAddCustomTopic = () => {
        if (!newTopicInput.trim()) return;
        const val = newTopicInput.trim();
        
        if (!availableTopics.includes(val)) {
            setAvailableTopics(prev => [...prev, val]);
        }
        setSelectedTopics(prev => new Set(prev).add(val));
        setNewTopicInput('');
    };

    const handleSave = () => {
        if (!pageNumber) {
            alert("Please enter a page number");
            return;
        }
        
        onSave({
            logId: initialData?.logId,
            pageNumber,
            date,
            startTime,
            endTime,
            notes,
            selectedTopics: Array.from(selectedTopics)
        });
        onClose();
    };

    const handleDeleteLog = (logId: string) => {
        if (onDeletePastLog && pageNumber) {
            onDeletePastLog(logId, pageNumber);
        }
    };

    const getPastLogs = () => {
        if (!existingEntry) return [];
        return [...existingEntry.logs]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    };

    const getUpcomingTopics = () => {
        if (!existingEntry) return [];
        return existingEntry.topics
            .filter(t => t.nextRevisionAt && new Date(t.nextRevisionAt) <= new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000)) // Due within week
            .sort((a, b) => new Date(a.nextRevisionAt!).getTime() - new Date(b.nextRevisionAt!).getTime());
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[95vh]">
                
                {/* Header */}
                <div className={`p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0 ${detectedMode === 'REVISION' ? 'bg-amber-50/50 dark:bg-amber-900/20' : 'bg-indigo-50/50 dark:bg-indigo-900/20'} rounded-t-2xl`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${detectedMode === 'REVISION' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>
                            {detectedMode === 'REVISION' ? <ArrowPathIcon className="w-5 h-5" /> : <BookOpenIcon className="w-5 h-5" />}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                                {initialData?.logId ? 'Edit Session' : (detectedMode === 'REVISION' ? 'Log Revision' : 'Log New Study')}
                            </h3>
                            <div className="flex gap-2 mt-1">
                                <button 
                                    onClick={() => setDetectedMode('STUDY')}
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${detectedMode === 'STUDY' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-400'}`}
                                >
                                    Study Mode
                                </button>
                                <button 
                                    onClick={() => setDetectedMode('REVISION')}
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${detectedMode === 'REVISION' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-amber-400'}`}
                                >
                                    Revision Mode
                                </button>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/50 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <XMarkIcon className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950/50">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* LEFT: Input Form */}
                        <div className="space-y-6">
                            {/* Page Number Input */}
                            <div>
                                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Page Number</label>
                                <input 
                                    type="text"
                                    value={pageNumber}
                                    onChange={e => setPageNumber(e.target.value.replace(/\D/g, ''))}
                                    className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-2xl text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 tracking-widest"
                                    placeholder="000"
                                    autoFocus={!initialData}
                                />
                            </div>

                            {/* Time & Date */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Date</label>
                                    <input 
                                        type="date"
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
                                        className="w-full p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Start</label>
                                        <input 
                                            type="time"
                                            value={startTime}
                                            onChange={e => setStartTime(e.target.value)}
                                            className="w-full p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">End</label>
                                        <input 
                                            type="time"
                                            value={endTime}
                                            onChange={e => setEndTime(e.target.value)}
                                            className="w-full p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Subtopics Selection */}
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-3 block">
                                    Subtopics Covered (Affects Revision)
                                </label>
                                
                                {availableTopics.length > 0 ? (
                                    <div className="space-y-2 mb-4 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                        {availableTopics.map((topic, idx) => (
                                            <label key={idx} className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all ${selectedTopics.has(topic) ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800' : 'bg-slate-50 dark:bg-slate-700/30 border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                                                <input 
                                                    type="checkbox"
                                                    checked={selectedTopics.has(topic)}
                                                    onChange={() => handleToggleTopic(topic)}
                                                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                                />
                                                <span className={`text-sm font-medium ${selectedTopics.has(topic) ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-600 dark:text-slate-400'}`}>{topic}</span>
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-slate-400 text-xs italic border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-lg mb-4">
                                        {pageNumber ? "No subtopics found. Add new ones below." : "Enter a page number to load topics."}
                                    </div>
                                )}

                                {/* Add New Subtopic */}
                                <div className="flex gap-2">
                                    <input 
                                        type="text"
                                        value={newTopicInput}
                                        onChange={e => setNewTopicInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCustomTopic())}
                                        placeholder="Add topic (e.g. Kidney Stones)"
                                        className="flex-1 p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-xs focus:outline-none focus:border-indigo-500"
                                    />
                                    <button 
                                        onClick={handleAddCustomTopic}
                                        disabled={!newTopicInput.trim()}
                                        className="p-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 disabled:opacity-50 transition-colors"
                                    >
                                        <PlusIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: Context Panel (History/Upcoming) */}
                        <div className="space-y-6">
                            {existingEntry ? (
                                <>
                                    {/* Past Sessions */}
                                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm relative">
                                        <div className="flex items-center gap-2 mb-3 text-slate-500 dark:text-slate-400">
                                            <HistoryIcon className="w-4 h-4" />
                                            <h4 className="text-xs font-bold uppercase tracking-wider">Past Logs (Pg {pageNumber})</h4>
                                        </div>
                                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                            {getPastLogs().map(log => (
                                                <div key={log.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 dark:bg-slate-700/50 rounded border border-slate-100 dark:border-slate-700 group">
                                                    <div>
                                                        <span className="font-bold text-slate-700 dark:text-slate-300 block">
                                                            {new Date(log.timestamp).toLocaleDateString()}
                                                        </span>
                                                        <span className="text-slate-500 dark:text-slate-400 font-mono">
                                                            {log.durationMinutes}m • {log.type === 'STUDY' ? 'Study' : `Rev #${log.revisionIndex}`}
                                                        </span>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleDeleteLog(log.id)} 
                                                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                        title="Delete Log"
                                                    >
                                                        <TrashIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                            {existingEntry.logs.length === 0 && <p className="text-xs text-slate-400 italic">No past logs found. Page is fresh.</p>}
                                        </div>
                                    </div>

                                    {/* Upcoming Due */}
                                    <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-900/30 p-4 shadow-sm">
                                        <div className="flex items-center gap-2 mb-3 text-amber-600 dark:text-amber-500">
                                            <ArrowPathIcon className="w-4 h-4" />
                                            <h4 className="text-xs font-bold uppercase tracking-wider">Upcoming Due (Topics)</h4>
                                        </div>
                                        <div className="space-y-2">
                                            {getUpcomingTopics().length > 0 ? getUpcomingTopics().slice(0, 3).map(topic => (
                                                <div key={topic.id} className="flex justify-between items-center text-xs p-2 bg-white dark:bg-slate-800 rounded border border-amber-100 dark:border-amber-900/50 cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors" onClick={() => handleToggleTopic(topic.name)}>
                                                    <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[60%]">
                                                        {topic.name}
                                                    </span>
                                                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                                                        {new Date(topic.nextRevisionAt!).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            )) : <p className="text-xs text-slate-400 italic">No topics due this week.</p>}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="h-full flex items-center justify-center text-center p-8 border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-2xl">
                                    <div>
                                        <BookOpenIcon className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                                        <p className="text-sm text-slate-400 dark:text-slate-500">Enter a valid page number to see history and revision context.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Session Notes</label>
                        <textarea 
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-24"
                            placeholder="Any specific observations..."
                        />
                    </div>

                </div>

                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex gap-3 shrink-0 bg-white dark:bg-slate-900 rounded-b-2xl">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm">Cancel</button>
                    <button 
                        onClick={handleSave} 
                        className={`flex-[2] py-3 rounded-xl text-white font-bold shadow-lg transition-colors text-sm flex items-center justify-center gap-2 ${detectedMode === 'REVISION' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200 dark:shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none'}`}
                    >
                        <CheckCircleIcon className="w-4 h-4" /> {detectedMode === 'REVISION' ? 'Log Revision' : 'Log New Study'}
                    </button>
                </div>
            </div>
        </div>
    );
};
