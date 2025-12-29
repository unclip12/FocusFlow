
import React, { useState, useMemo, useEffect } from 'react';
import { FMGEEntry, FMGELog, getAdjustedDate, RevisionSettings } from '../types';
import { BookOpenIcon, PlusIcon, TrashIcon, CheckCircleIcon, ClockIcon, FireIcon, ArrowPathIcon, CalendarIcon, PencilSquareIcon, ChevronLeftIcon, ChevronRightIcon } from './Icons';
import { FMGELogModal } from './FMGELogModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { calculateNextRevisionDate } from '../services/srsService';
import { getRevisionSettings } from '../services/firebase';

interface FMGEViewProps {
    fmgeData: FMGEEntry[];
    onUpdateFMGE: (entry: FMGEEntry) => void;
    onDeleteFMGE: (id: string) => void;
}

export const FMGEView: React.FC<FMGEViewProps> = ({ fmgeData, onUpdateFMGE, onDeleteFMGE }) => {
    // View State
    const [selectedDate, setSelectedDate] = useState(getAdjustedDate(new Date()));
    const [revisionTab, setRevisionTab] = useState<'DUE' | 'UPCOMING'>('DUE');
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [revisionSettings, setRevisionSettings] = useState<RevisionSettings>({ mode: 'balanced', targetCount: 7 });
    
    // Editing Logs
    const [logToEdit, setLogToEdit] = useState<{ entryId: string, log: FMGELog } | null>(null);
    
    // Deleting
    const [entryToDelete, setEntryToDelete] = useState<string | null>(null);

    useEffect(() => {
        getRevisionSettings().then(s => { if(s) setRevisionSettings(s); });
    }, []);

    const handleSaveLog = (data: any) => {
        // data: { logId?, originalEntryId?, subject, slideStart, slideEnd, date, startTime, endTime, qBankCount, notes }
        
        const now = new Date();
        const timestamp = data.date ? new Date(`${data.date}T${data.startTime}:00`).toISOString() : now.toISOString();
        
        // Calculate duration
        let duration = 60;
        if (data.startTime && data.endTime) {
            const s = new Date(`${data.date}T${data.startTime}:00`);
            const e = new Date(`${data.date}T${data.endTime}:00`);
            if (e < s) e.setDate(e.getDate() + 1);
            duration = Math.round((e.getTime() - s.getTime()) / 60000);
        }

        // Find existing entry or create new
        let entry: FMGEEntry | undefined;
        
        if (data.originalEntryId) {
            entry = fmgeData.find(e => e.id === data.originalEntryId);
        }
        
        if (!entry) {
            // Try find by subject/slides match
            entry = fmgeData.find(e => e.subject === data.subject && e.slideStart === data.slideStart && e.slideEnd === data.slideEnd);
        }

        if (entry) {
            // Update existing
            let newLogs = [...entry.logs];
            
            if (data.logId) {
                // Edit existing log
                newLogs = newLogs.map(l => l.id === data.logId ? {
                    ...l,
                    timestamp,
                    durationMinutes: duration,
                    slideStart: data.slideStart,
                    slideEnd: data.slideEnd,
                    qBankCount: data.qBankCount,
                    notes: data.notes
                } : l);
            } else {
                // Add new log
                const newLog: FMGELog = {
                    id: crypto.randomUUID(),
                    timestamp,
                    durationMinutes: duration,
                    type: 'REVISION', // Assuming standard study/revision flow
                    revisionIndex: entry.revisionCount + 1,
                    slideStart: data.slideStart,
                    slideEnd: data.slideEnd,
                    qBankCount: data.qBankCount,
                    notes: data.notes
                };
                newLogs.push(newLog);
            }
            
            // Recalculate Stats
            const sortedLogs = [...newLogs].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            const lastLog = sortedLogs[sortedLogs.length - 1];
            const revCount = sortedLogs.length - 1; // 0-based for first study
            
            // Calculate next revision
            const nextIndex = revCount + 1; // Next target
            const nextDate = calculateNextRevisionDate(new Date(lastLog.timestamp), nextIndex, revisionSettings);

            const updatedEntry: FMGEEntry = {
                ...entry,
                subject: data.subject, // Update subject if changed? usually subjects match.
                slideStart: data.slideStart,
                slideEnd: data.slideEnd,
                logs: newLogs,
                revisionCount: revCount,
                currentRevisionIndex: nextIndex,
                lastStudiedAt: lastLog.timestamp,
                nextRevisionAt: nextDate ? nextDate.toISOString() : null
            };
            
            onUpdateFMGE(updatedEntry);

        } else {
            // New Entry
            const newLog: FMGELog = {
                id: crypto.randomUUID(),
                timestamp,
                durationMinutes: duration,
                type: 'STUDY',
                revisionIndex: 0,
                slideStart: data.slideStart,
                slideEnd: data.slideEnd,
                qBankCount: data.qBankCount,
                notes: data.notes
            };
            
            const nextDate = calculateNextRevisionDate(new Date(timestamp), 1, revisionSettings); // First interval

            const newEntry: FMGEEntry = {
                id: crypto.randomUUID(),
                subject: data.subject,
                slideStart: data.slideStart,
                slideEnd: data.slideEnd,
                revisionCount: 0,
                currentRevisionIndex: 1, // Aiming for 1st revision
                lastStudiedAt: timestamp,
                nextRevisionAt: nextDate ? nextDate.toISOString() : null,
                logs: [newLog],
                notes: ''
            };
            onUpdateFMGE(newEntry);
        }
    };

    const handleDeleteLog = (data: any) => {
        if (data.originalEntryId && data.logId) {
            const entry = fmgeData.find(e => e.id === data.originalEntryId);
            if (entry) {
                const newLogs = entry.logs.filter(l => l.id !== data.logId);
                
                if (newLogs.length === 0) {
                    // If no logs left, delete the entire subject entry
                    onDeleteFMGE(entry.id);
                } else {
                    // Recalculate based on REMAINING logs
                    // 1. Sort remaining logs chronologically
                    const sortedLogs = [...newLogs].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                    
                    // 2. Identify new "Last Log"
                    const lastLog = sortedLogs[sortedLogs.length - 1];
                    
                    // 3. Recalculate Revision Count (Length - 1, since first is Study)
                    // Ensure it doesn't drop below 0
                    const revCount = Math.max(0, sortedLogs.length - 1);
                    
                    // 4. Determine Next Target (Current Revision Index)
                    const nextIndex = revCount + 1;
                    
                    // 5. Recalculate Next Due Date from the NEW last log's timestamp
                    const nextDate = calculateNextRevisionDate(new Date(lastLog.timestamp), nextIndex, revisionSettings);

                    const updatedEntry: FMGEEntry = {
                        ...entry,
                        logs: newLogs,
                        revisionCount: revCount,
                        currentRevisionIndex: nextIndex,
                        lastStudiedAt: lastLog.timestamp,
                        nextRevisionAt: nextDate ? nextDate.toISOString() : null
                    };
                    onUpdateFMGE(updatedEntry);
                }
            }
        }
    };

    // Filter logs for the selected date
    const dailyLogs = useMemo(() => {
        return fmgeData.flatMap(entry => 
            entry.logs
                .filter(log => getAdjustedDate(log.timestamp) === selectedDate)
                .map(log => ({ ...log, subject: entry.subject, entryId: entry.id }))
        ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [fmgeData, selectedDate]);

    const dueRevisions = useMemo(() => {
        const now = new Date();
        return fmgeData.filter(e => e.nextRevisionAt && new Date(e.nextRevisionAt) <= now)
            .sort((a,b) => new Date(a.nextRevisionAt!).getTime() - new Date(b.nextRevisionAt!).getTime());
    }, [fmgeData]);

    const upcomingRevisions = useMemo(() => {
        const now = new Date();
        return fmgeData.filter(e => e.nextRevisionAt && new Date(e.nextRevisionAt) > now)
            .sort((a,b) => new Date(a.nextRevisionAt!).getTime() - new Date(b.nextRevisionAt!).getTime());
    }, [fmgeData]);

    const handleDateChange = (offset: number) => {
        const d = new Date(selectedDate + 'T12:00:00');
        d.setDate(d.getDate() + offset);
        setSelectedDate(getAdjustedDate(d));
    };

    // Format date label for the switcher
    const dateLabel = useMemo(() => {
        const today = getAdjustedDate(new Date());
        const d = new Date(today + 'T12:00:00');
        d.setDate(d.getDate() - 1);
        const yesterday = getAdjustedDate(d);
        
        if (selectedDate === today) return "Today";
        if (selectedDate === yesterday) return "Yesterday";
        return new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }, [selectedDate]);

    return (
        <div className="animate-fade-in space-y-6 max-w-6xl mx-auto pb-20">
            
            <DeleteConfirmationModal 
                isOpen={!!entryToDelete}
                onClose={() => setEntryToDelete(null)}
                onConfirm={() => {
                    if (entryToDelete) {
                        onDeleteFMGE(entryToDelete);
                        setEntryToDelete(null);
                    }
                }}
                title="Delete Subject Entry?"
                message="This will delete all study history for this subject topic."
            />

            <FMGELogModal 
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setLogToEdit(null); }}
                onSave={handleSaveLog}
                initialData={logToEdit ? {
                    logId: logToEdit.log.id,
                    originalEntryId: logToEdit.entryId,
                    subject: dailyLogs.find(l => l.id === logToEdit.log.id)?.subject, // Fallback subject lookup
                    slideStart: logToEdit.log.slideStart,
                    slideEnd: logToEdit.log.slideEnd,
                    qBankCount: logToEdit.log.qBankCount,
                    notes: logToEdit.log.notes,
                    date: getAdjustedDate(new Date(logToEdit.log.timestamp)),
                    startTime: new Date(logToEdit.log.timestamp).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}),
                    endTime: new Date(new Date(logToEdit.log.timestamp).getTime() + (logToEdit.log.durationMinutes || 60)*60000).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'})
                } : undefined}
                onDelete={handleDeleteLog}
            />

            {/* Top Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-cyan-100/50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 rounded-xl backdrop-blur-sm">
                        <BookOpenIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">FMGE Prep</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Track slides and revisions</p>
                    </div>
                </div>
                <button 
                    onClick={() => { setLogToEdit(null); setIsModalOpen(true); }}
                    className="btn-3d bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-cyan-200 dark:shadow-none transition-all"
                >
                    <PlusIcon className="w-4 h-4" /> Log Study
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* LEFT COLUMN: ACTIVITY LOG */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5 text-slate-400" /> Activity Log
                        </h3>
                    </div>

                    {/* Date Switcher */}
                    <div className="flex justify-between items-center bg-white/60 dark:bg-slate-800/60 p-2 rounded-xl border border-white/40 dark:border-slate-700/50 backdrop-blur-sm shadow-sm">
                        <button onClick={() => handleDateChange(-1)} className="p-2 hover:bg-white/50 dark:hover:bg-slate-700/50 rounded-lg transition-colors text-slate-500">
                            <ChevronLeftIcon className="w-5 h-5" />
                        </button>
                        
                        <div className="flex flex-col items-center">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Viewing</span>
                            <div className="relative">
                                <span className="font-bold text-slate-800 dark:text-white text-sm">{dateLabel}</span>
                                <input 
                                    type="date" 
                                    value={selectedDate} 
                                    onChange={e => setSelectedDate(e.target.value)}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                            </div>
                        </div>

                        <button onClick={() => handleDateChange(1)} className="p-2 hover:bg-white/50 dark:hover:bg-slate-700/50 rounded-lg transition-colors text-slate-500">
                            <ChevronRightIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Logs List */}
                    <div className="space-y-3">
                        {dailyLogs.length > 0 ? dailyLogs.map(log => (
                            <div key={log.id} className="relative group bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 rounded-2xl p-4 hover:shadow-md transition-all cursor-pointer" onClick={() => { setLogToEdit({ entryId: log.entryId, log }); setIsModalOpen(true); }}>
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-white">{log.subject}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">Slides {log.slideStart}-{log.slideEnd}</p>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${log.type === 'STUDY' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                                        {log.type === 'STUDY' ? 'Study' : `Rev #${log.revisionIndex}`}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-2">
                                    <span className="flex items-center gap-1"><ClockIcon className="w-3 h-3" /> {log.durationMinutes}m</span>
                                    {log.qBankCount > 0 && <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold"><CheckCircleIcon className="w-3 h-3" /> {log.qBankCount} Qs</span>}
                                </div>
                                {log.notes && <p className="text-xs text-slate-400 italic mt-2 line-clamp-1">"{log.notes}"</p>}
                                
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <PencilSquareIcon className="w-4 h-4 text-slate-400" />
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                                <p className="text-slate-400 italic text-sm">No study logs for this date.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: REVISION HUB */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            <ArrowPathIcon className="w-5 h-5 text-slate-400" /> Revision Hub
                        </h3>
                    </div>

                    {/* Hub Tabs */}
                    <div className="flex bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-xl backdrop-blur-sm overflow-x-auto mb-4">
                        <button 
                            onClick={() => setRevisionTab('DUE')}
                            className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${revisionTab === 'DUE' ? 'bg-white dark:bg-slate-700 shadow-sm text-amber-600 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}
                        >
                            Due Now ({dueRevisions.length})
                        </button>
                        <button 
                            onClick={() => setRevisionTab('UPCOMING')}
                            className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${revisionTab === 'UPCOMING' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400'}`}
                        >
                            Upcoming
                        </button>
                    </div>

                    <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
                        {revisionTab === 'DUE' && (
                            dueRevisions.length > 0 ? dueRevisions.map(entry => (
                                <div key={entry.id} className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 flex justify-between items-center group relative">
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-slate-200">{entry.subject}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Slides {entry.slideStart}-{entry.slideEnd}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 rounded animate-pulse">
                                            DUE NOW
                                        </span>
                                        <span className="block text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-0.5">
                                                Rev #{entry.revisionCount + 1}
                                        </span>
                                        <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                            {new Date(entry.nextRevisionAt!).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <button 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                const mockLog: any = {
                                                    id: '',
                                                    slideStart: entry.slideStart,
                                                    slideEnd: entry.slideEnd,
                                                    qBankCount: 0,
                                                    notes: '',
                                                    timestamp: new Date().toISOString(),
                                                    durationMinutes: 60
                                                };
                                                setLogToEdit({ entryId: entry.id, log: mockLog });
                                                setIsModalOpen(true);
                                            }}
                                            className="text-xs font-bold text-cyan-600 hover:underline mt-1"
                                        >
                                            Log Revision
                                        </button>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-12 bg-white/40 dark:bg-slate-800/40 rounded-2xl">
                                    <CheckCircleIcon className="w-12 h-12 text-green-300 dark:text-green-800 mx-auto mb-3" />
                                    <p className="text-slate-400 italic text-sm">All caught up! No revisions due.</p>
                                </div>
                            )
                        )}

                        {revisionTab === 'UPCOMING' && (
                            upcomingRevisions.length > 0 ? upcomingRevisions.map(entry => (
                                <div key={entry.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 flex justify-between items-center group">
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-slate-200">{entry.subject}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Slides {entry.slideStart}-{entry.slideEnd}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <div className="text-right">
                                            <span className="block text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-0.5">
                                                Rev #{entry.revisionCount + 1}
                                            </span>
                                            <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                                {new Date(entry.nextRevisionAt!).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                setEntryToDelete(entry.id);
                                            }}
                                            className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Delete Entry"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-12 bg-white/40 dark:bg-slate-800/40 rounded-2xl">
                                    <p className="text-slate-400 italic text-sm">No upcoming revisions scheduled.</p>
                                </div>
                            )
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};
