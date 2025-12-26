
import React, { useState, useMemo, useEffect } from 'react';
import { FMGEEntry, FMGELog, getAdjustedDate, RevisionSettings, FMGESubject, DEFAULT_OBG_VIDEOS } from '../types';
import { BookOpenIcon, PlusIcon, TrashIcon, CheckCircleIcon, ClockIcon, FireIcon, ArrowPathIcon, CalendarIcon, PencilSquareIcon, ChevronLeftIcon, ChevronRightIcon, AdjustmentsHorizontalIcon, VideoIcon, QIcon } from './Icons';
import { FMGELogModal } from './FMGELogModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { FMGEDataEditor } from './FMGEDataEditor';
import { calculateNextRevisionDate } from '../services/srsService';
import { getRevisionSettings, getFMGEMasterData, saveFMGEMasterData } from '../services/firebase';

interface FMGEViewProps {
    fmgeData: FMGEEntry[];
    onUpdateFMGE: (entry: FMGEEntry) => void;
    onDeleteFMGE: (id: string) => void;
}

export const FMGEView: React.FC<FMGEViewProps> = ({ fmgeData, onUpdateFMGE, onDeleteFMGE }) => {
    // View State
    const [selectedDate, setSelectedDate] = useState(getAdjustedDate(new Date()));
    const [revisionTab, setRevisionTab] = useState<'DUE' | 'UPCOMING'>('DUE');
    
    // Master Data (Subjects/Videos)
    const [masterData, setMasterData] = useState<FMGESubject[]>([]);
    
    // Modal State
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [revisionSettings, setRevisionSettings] = useState<RevisionSettings>({ mode: 'balanced', targetCount: 7 });
    
    // Editing Logs
    const [logToEdit, setLogToEdit] = useState<{ entryId: string, log: FMGELog } | null>(null);
    
    // Deleting
    const [entryToDelete, setEntryToDelete] = useState<string | null>(null);

    useEffect(() => {
        getRevisionSettings().then(s => { if(s) setRevisionSettings(s); });
        loadMasterData();
    }, []);

    const loadMasterData = async () => {
        let data = await getFMGEMasterData();
        
        // Auto-seed OBG if missing
        if (!data.find(s => s.name === 'OBG')) {
            const newObg: FMGESubject = {
                id: crypto.randomUUID(),
                name: 'OBG',
                totalQuestions: 0,
                completedQuestions: 0,
                qbanks: [],
                videos: DEFAULT_OBG_VIDEOS.map(v => ({ ...v, id: crypto.randomUUID() }))
            };
            await saveFMGEMasterData(newObg);
            data = [...data, newObg];
        }
        
        setMasterData(data);
    };

    const handleSaveMasterData = async (subject: FMGESubject) => {
        await saveFMGEMasterData(subject);
        setMasterData(prev => {
            const idx = prev.findIndex(p => p.id === subject.id);
            if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = subject;
                return copy;
            }
            return [...prev, subject];
        });
    };

    const handleSaveLog = async (data: any) => {
        const now = new Date();
        const timestamp = data.date ? new Date(`${data.date}T${data.startTime}:00`).toISOString() : now.toISOString();
        
        let duration = 60;
        if (data.startTime && data.endTime) {
            const s = new Date(`${data.date}T${data.startTime}:00`);
            const e = new Date(`${data.date}T${data.endTime}:00`);
            if (e < s) e.setDate(e.getDate() + 1);
            duration = Math.round((e.getTime() - s.getTime()) / 60000);
        }

        // 1. UPDATE MASTER DATA IF VIDEO
        if (data.videoId) {
            const subjIdx = masterData.findIndex(s => s.name === data.subject);
            if (subjIdx !== -1) {
                const subject = masterData[subjIdx];
                const vidIdx = subject.videos.findIndex(v => v.id === data.videoId);
                if (vidIdx !== -1) {
                    const video = subject.videos[vidIdx];
                    const newWatched = Math.max(video.watchedMinutes, data.videoProgressEnd);
                    const isCompleted = newWatched >= (video.totalDurationMinutes * 0.95);
                    const updatedVideo = { ...video, watchedMinutes: newWatched, isCompleted };
                    const updatedSubject = { ...subject };
                    updatedSubject.videos = [...subject.videos];
                    updatedSubject.videos[vidIdx] = updatedVideo;
                    const newMaster = [...masterData];
                    newMaster[subjIdx] = updatedSubject;
                    setMasterData(newMaster);
                    await saveFMGEMasterData(updatedSubject);
                }
            }
        }
        
        // 2. UPDATE MASTER DATA IF QBANK
        if (data.qbankId) {
             const subjIdx = masterData.findIndex(s => s.name === data.subject);
             if (subjIdx !== -1) {
                 const subject = masterData[subjIdx];
                 const qIdx = subject.qbanks.findIndex(q => q.id === data.qbankId);
                 if (qIdx !== -1) {
                     const qbank = subject.qbanks[qIdx];
                     const updatedQBank = { ...qbank, completedQuestions: (qbank.completedQuestions || 0) + data.qBankCount };
                     const updatedSubject = { ...subject };
                     updatedSubject.qbanks = [...subject.qbanks];
                     updatedSubject.qbanks[qIdx] = updatedQBank;
                     const newMaster = [...masterData];
                     newMaster[subjIdx] = updatedSubject;
                     setMasterData(newMaster);
                     await saveFMGEMasterData(updatedSubject);
                 }
             }
        }

        // 3. CREATE/UPDATE LOG ENTRY
        let entry: FMGEEntry | undefined;
        if (data.originalEntryId) entry = fmgeData.find(e => e.id === data.originalEntryId);
        
        if (!entry) {
            if (data.videoId) entry = fmgeData.find(e => e.subject === data.subject && e.logs.some(l => l.videoId === data.videoId));
            else if (data.qbankId) entry = fmgeData.find(e => e.subject === data.subject && e.logs.some(l => l.qbankId === data.qbankId));
            else entry = fmgeData.find(e => e.subject === data.subject && e.slideStart === data.slideStart && e.slideEnd === data.slideEnd);
        }

        if (entry) {
            let newLogs = [...entry.logs];
            const logPayload: FMGELog = {
                id: data.logId || crypto.randomUUID(),
                timestamp,
                durationMinutes: duration,
                type: 'REVISION',
                revisionIndex: entry.revisionCount + 1,
                slideStart: data.slideStart,
                slideEnd: data.slideEnd,
                qBankCount: data.qBankCount,
                notes: data.notes,
                videoId: data.videoId,
                videoTitle: data.videoTitle,
                videoProgressStart: data.videoProgressStart,
                videoProgressEnd: data.videoProgressEnd,
                qbankId: data.qbankId
            };
            if (data.logId) newLogs = newLogs.map(l => l.id === data.logId ? logPayload : l);
            else newLogs.push(logPayload);
            const sortedLogs = [...newLogs].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            const lastLog = sortedLogs[sortedLogs.length - 1];
            const revCount = sortedLogs.length - 1; 
            const nextIndex = revCount + 1; 
            const nextDate = calculateNextRevisionDate(new Date(lastLog.timestamp), nextIndex, revisionSettings);
            const updatedEntry: FMGEEntry = {
                ...entry,
                subject: data.subject,
                slideStart: data.slideStart || entry.slideStart,
                slideEnd: data.slideEnd || entry.slideEnd,
                logs: newLogs,
                revisionCount: revCount,
                currentRevisionIndex: nextIndex,
                lastStudiedAt: lastLog.timestamp,
                nextRevisionAt: nextDate ? nextDate.toISOString() : null
            };
            onUpdateFMGE(updatedEntry);
        } else {
            const newLog: FMGELog = {
                id: crypto.randomUUID(),
                timestamp,
                durationMinutes: duration,
                type: 'STUDY',
                revisionIndex: 0,
                slideStart: data.slideStart,
                slideEnd: data.slideEnd,
                qBankCount: data.qBankCount,
                notes: data.notes,
                videoId: data.videoId,
                videoTitle: data.videoTitle,
                videoProgressStart: data.videoProgressStart,
                videoProgressEnd: data.videoProgressEnd,
                qbankId: data.qbankId
            };
            const nextDate = calculateNextRevisionDate(new Date(timestamp), 1, revisionSettings); 
            const newEntry: FMGEEntry = {
                id: crypto.randomUUID(),
                subject: data.subject,
                slideStart: data.slideStart || 0,
                slideEnd: data.slideEnd || 0,
                revisionCount: 0,
                currentRevisionIndex: 1, 
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
                    onDeleteFMGE(entry.id);
                } else {
                    const sortedLogs = [...newLogs].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                    const lastLog = sortedLogs[sortedLogs.length - 1];
                    const revCount = Math.max(0, sortedLogs.length - 1);
                    const nextIndex = revCount + 1;
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

    const getProgressStats = (subject: FMGESubject) => {
        const totalV = subject.videos?.length || 0;
        const doneV = subject.videos?.filter(v => v.isCompleted).length || 0;
        const vPerc = totalV > 0 ? (doneV / totalV) * 100 : 0;
        
        const qTotal = subject.qbanks?.reduce((acc, q) => acc + q.totalQuestions, 0) || 0;
        const qDone = subject.qbanks?.reduce((acc, q) => acc + q.completedQuestions, 0) || 0;
        const qPerc = qTotal > 0 ? (qDone / qTotal) * 100 : 0;
        
        return { doneV, totalV, vPerc, qPerc, qDone, qTotal };
    };

    const activeSubjects = masterData.filter(s => (s.videos && s.videos.length > 0) || (s.qbanks && s.qbanks.length > 0));

    return (
        <div className="animate-fade-in space-y-6 max-w-6xl mx-auto pb-20">
            <DeleteConfirmationModal isOpen={!!entryToDelete} onClose={() => setEntryToDelete(null)} onConfirm={() => { if (entryToDelete) { onDeleteFMGE(entryToDelete); setEntryToDelete(null); } }} title="Delete Subject Entry?" />
            <FMGELogModal isOpen={isLogModalOpen} onClose={() => { setIsLogModalOpen(false); setLogToEdit(null); }} onSave={handleSaveLog} initialData={logToEdit ? { logId: logToEdit.log.id, originalEntryId: logToEdit.entryId, subject: dailyLogs.find(l => l.id === logToEdit.log.id)?.subject, slideStart: logToEdit.log.slideStart, slideEnd: logToEdit.log.slideEnd, videoId: logToEdit.log.videoId, videoTitle: logToEdit.log.videoTitle, videoProgressStart: logToEdit.log.videoProgressStart, videoProgressEnd: logToEdit.log.videoProgressEnd, qBankCount: logToEdit.log.qBankCount, qbankId: logToEdit.log.qbankId, date: getAdjustedDate(new Date(logToEdit.log.timestamp)), startTime: new Date(logToEdit.log.timestamp).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}), endTime: new Date(new Date(logToEdit.log.timestamp).getTime() + (logToEdit.log.durationMinutes || 60)*60000).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}) } : undefined} onDelete={handleDeleteLog} masterData={masterData} />
            <FMGEDataEditor isOpen={isConfigModalOpen} onClose={() => setIsConfigModalOpen(false)} subjects={masterData} onSaveSubject={handleSaveMasterData} />
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-cyan-100/50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 rounded-xl backdrop-blur-sm card-3d">
                        <BookOpenIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">FMGE Prep</h2>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Mastering the Fundamentals</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsConfigModalOpen(true)} className="btn-3d p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl" title="Configure Subjects"><AdjustmentsHorizontalIcon className="w-5 h-5" /></button>
                    <button onClick={() => { setLogToEdit(null); setIsLogModalOpen(true); }} className="btn-3d bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg"><PlusIcon className="w-4 h-4" /> Log Study</button>
                </div>
            </div>
            {activeSubjects.length > 0 && (
                <div className="overflow-x-auto pb-4 snap-x hide-scrollbar">
                    <div className="flex gap-4 w-max px-1">
                        {activeSubjects.map(subj => {
                            const stats = getProgressStats(subj);
                            return (
                                <div key={subj.id} className="snap-start w-64 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 rounded-3xl p-5 shadow-sm card-3d flex flex-col gap-4">
                                    <h4 className="font-black text-slate-800 dark:text-white truncate">{subj.name}</h4>
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between text-[10px] text-slate-500 font-black uppercase mb-1.5">
                                                <span className="flex items-center gap-1"><VideoIcon className="w-3 h-3"/> Videos</span>
                                                <span>{stats.doneV} / {stats.totalV}</span>
                                            </div>
                                            <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${stats.vPerc}%` }}></div></div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[10px] text-slate-500 font-black uppercase mb-1.5">
                                                <span className="flex items-center gap-1"><QIcon className="w-3 h-3"/> QBanks</span>
                                                <span>{stats.qDone} / {stats.qTotal}</span>
                                            </div>
                                            <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${stats.qPerc}%` }}></div></div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-white/60 dark:bg-slate-800/60 p-2 rounded-2xl border border-white/40 dark:border-slate-700/50 backdrop-blur-sm shadow-sm card-3d">
                        <button onClick={() => handleDateChange(-1)} className="p-2 hover:bg-white/50 rounded-lg transition-colors text-slate-500"><ChevronLeftIcon className="w-6 h-6" /></button>
                        <div className="relative cursor-pointer text-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Study Log</span>
                            <span className="font-black text-slate-800 dark:text-white text-base">{new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span>
                            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer"/>
                        </div>
                        <button onClick={() => handleDateChange(1)} className="p-2 hover:bg-white/50 rounded-lg transition-colors text-slate-500"><ChevronRightIcon className="w-6 h-6" /></button>
                    </div>
                    <div className="space-y-3">
                        {dailyLogs.length > 0 ? dailyLogs.map(log => (
                            <div key={log.id} className="relative group bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 rounded-3xl p-5 hover:shadow-md transition-all cursor-pointer card-3d" onClick={() => { setLogToEdit({ entryId: log.entryId, log }); setIsLogModalOpen(true); }}>
                                <div className="flex justify-between items-start mb-3">
                                    <div><h4 className="font-black text-slate-800 dark:text-white text-lg">{log.subject}</h4>
                                        {log.videoId ? <p className="text-xs text-blue-600 font-bold mt-1 flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800 w-fit"><VideoIcon className="w-3.5 h-3.5" />{log.videoTitle || 'Lecture'}</p>
                                        : log.qbankId ? <p className="text-xs text-emerald-600 font-bold mt-1 flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800 w-fit"><QIcon className="w-3.5 h-3.5" />QBank Log</p>
                                        : <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full w-fit">Slides {log.slideStart}-{log.slideEnd}</p>}
                                    </div>
                                    <span className={`text-[9px] font-black px-2 py-1 rounded-full border tracking-widest ${log.type === 'STUDY' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{log.type === 'STUDY' ? 'INITIAL' : `REV #${log.revisionIndex}`}</span>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                                    <div className="flex items-center gap-1.5"><ClockIcon className="w-4 h-4 text-indigo-400" />{log.durationMinutes} min</div>
                                    {log.qBankCount > 0 && <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><QIcon className="w-4 h-4" />{log.qBankCount} Qs</div>}
                                </div>
                                {log.notes && <p className="text-xs text-slate-400 italic mt-3 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800">"{log.notes}"</p>}
                            </div>
                        )) : <div className="text-center py-16 bg-white/20 dark:bg-black/10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[32px]"><p className="text-slate-400 italic font-medium">Clear sky. No logs today.</p></div>}
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="flex justify-between items-center bg-white/40 dark:bg-slate-900/40 p-1 rounded-2xl border border-white/20 dark:border-slate-800 shadow-inner">
                        <button onClick={() => setRevisionTab('DUE')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${revisionTab === 'DUE' ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-md scale-105 z-10' : 'text-slate-400 hover:text-slate-600'}`}>Due Now ({dueRevisions.length})</button>
                        <button onClick={() => setRevisionTab('UPCOMING')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${revisionTab === 'UPCOMING' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-md scale-105 z-10' : 'text-slate-400 hover:text-slate-600'}`}>Upcoming</button>
                    </div>
                    <div className="space-y-4 max-h-[700px] overflow-y-auto custom-scrollbar pr-1">
                        {revisionTab === 'DUE' && (dueRevisions.length > 0 ? dueRevisions.map(entry => (
                             <div key={entry.id} className="p-5 rounded-3xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 backdrop-blur-md card-3d flex justify-between items-center group relative">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400 rounded-l-3xl"></div>
                                <div><h4 className="font-black text-slate-800 dark:text-white text-lg">{entry.subject}</h4>
                                    <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest mt-1">Slides {entry.slideStart}-{entry.slideEnd}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full animate-pulse border border-amber-200">DUE NOW</span>
                                    <button onClick={(e) => { e.stopPropagation(); const mockLog: any = { id: '', slideStart: entry.slideStart, slideEnd: entry.slideEnd, qBankCount: 0, notes: '', timestamp: new Date().toISOString(), durationMinutes: 60 }; setLogToEdit({ entryId: entry.id, log: mockLog }); setIsLogModalOpen(true); }} className="text-xs font-black text-cyan-600 uppercase tracking-wider hover:underline">Log Revision</button>
                                </div>
                            </div>
                        )) : <div className="text-center py-20 opacity-40"><CheckCircleIcon className="w-16 h-16 mx-auto mb-4 text-green-400" /><p className="font-bold">Fully Optimized. No Revisions Due.</p></div>)}
                    </div>
                </div>
            </div>
        </div>
    );
};