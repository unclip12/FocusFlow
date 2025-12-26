
import React, { useState, useEffect, useMemo } from 'react';
import { StudyEntry, getAdjustedDate, FMGESubject, FMGEVideoResource, DEFAULT_OBG_VIDEOS } from '../types';
import { getStudyEntries, getAllStudyEntries, saveStudyEntry, deleteStudyEntry, getFMGEMasterData, saveFMGEMasterData } from '../services/firebase';
import { PlusIcon, TrashIcon, CheckCircleIcon, ClockIcon, PencilSquareIcon, ChevronLeftIcon, ChevronRightIcon, TableCellsIcon, ArrowPathIcon, XMarkIcon, PlayCircleIcon, BookOpenIcon, VideoIcon, PlayIcon, PauseIcon, CalendarIcon } from './Icons';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

const generateId = () => crypto.randomUUID();

export const StudyTrackerView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'DAILY' | 'HISTORY' | 'CURRICULUM'>('CURRICULUM');
    const [entries, setEntries] = useState<StudyEntry[]>([]);
    const [selectedDate, setSelectedDate] = useState(getAdjustedDate(new Date()));
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    
    // Curriculum State
    const [subjects, setSubjects] = useState<FMGESubject[]>([]);
    
    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [taskName, setTaskName] = useState('');
    const [time, setTime] = useState('');
    const [progress, setProgress] = useState(0);
    const [revision, setRevision] = useState(false);
    
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    useEffect(() => {
        if (activeTab === 'DAILY') {
            loadEntries();
        } else if (activeTab === 'HISTORY') {
            loadAllHistory();
        } else {
            loadCurriculum();
        }
    }, [selectedDate, activeTab]);

    const loadEntries = async () => {
        setIsLoading(true);
        try {
            const data = await getStudyEntries(selectedDate);
            setEntries(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const loadAllHistory = async () => {
        setIsLoading(true);
        try {
            const data = await getAllStudyEntries();
            setEntries(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const loadCurriculum = async () => {
        setIsLoading(true);
        try {
            const data = await getFMGEMasterData();
            // Check if OBG exists, if not seed it
            let updatedData = [...data];
            const obg = updatedData.find(s => s.name === 'OBG');
            if (!obg) {
                const newObg: FMGESubject = {
                    id: generateId(),
                    name: 'OBG',
                    totalQuestions: 0,
                    completedQuestions: 0,
                    qbanks: [],
                    videos: DEFAULT_OBG_VIDEOS.map(v => ({ ...v, id: generateId() }))
                };
                await saveFMGEMasterData(newObg);
                updatedData.push(newObg);
            }
            setSubjects(updatedData);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleVideoComplete = async (subjectId: string, videoId: string) => {
        const subj = subjects.find(s => s.id === subjectId);
        if (!subj) return;

        const updatedVideos = subj.videos.map(v => {
            if (v.id === videoId) {
                const newStatus = !v.isCompleted;
                return { 
                    ...v, 
                    isCompleted: newStatus,
                    watchedMinutes: newStatus ? v.totalDurationMinutes : 0 
                };
            }
            return v;
        });

        const updatedSubject = { ...subj, videos: updatedVideos };
        setSubjects(prev => prev.map(s => s.id === subjectId ? updatedSubject : s));
        await saveFMGEMasterData(updatedSubject);
    };

    const handleOpenAdd = () => {
        setEditingId(null);
        setTaskName('');
        const now = new Date();
        setTime(now.toTimeString().slice(0, 5));
        setProgress(0);
        setRevision(false);
        setIsFormOpen(true);
    };

    const handleEdit = (entry: StudyEntry) => {
        setEditingId(entry.id);
        setTaskName(entry.taskName);
        setTime(entry.time);
        setProgress(entry.progress);
        setRevision(entry.revision);
        setIsFormOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const entry: StudyEntry = {
            id: editingId || generateId(),
            date: selectedDate, // For daily logs this is correct. For history edits, we might want to preserve original date, but let's stick to current selector for simplicity or add date picker in modal if needed.
            time,
            taskName,
            progress,
            revision
        };
        
        await saveStudyEntry(entry);
        if (activeTab === 'HISTORY') loadAllHistory();
        else loadEntries();
        setIsFormOpen(false);
    };

    const handleDelete = async () => {
        if (itemToDelete) {
            await deleteStudyEntry(itemToDelete);
            setEntries(prev => prev.filter(e => e.id !== itemToDelete));
            setItemToDelete(null);
        }
    };

    const handleDateChange = (offset: number) => {
        const d = new Date(selectedDate + 'T12:00:00');
        d.setDate(d.getDate() + offset);
        setSelectedDate(getAdjustedDate(d));
    };

    return (
        <div className="animate-fade-in space-y-6 pb-24 max-w-6xl mx-auto px-1">
            <DeleteConfirmationModal 
                isOpen={!!itemToDelete}
                onClose={() => setItemToDelete(null)}
                onConfirm={handleDelete}
                title="Delete Entry?"
                message="Are you sure you want to remove this log entry?"
            />

            {/* Form Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl w-full max-w-md rounded-[32px] shadow-2xl border border-white/20 dark:border-slate-700/50 p-8 animate-scale-up card-3d">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                                {editingId ? 'Edit Entry' : 'Log Task'}
                            </h3>
                            <button onClick={() => setIsFormOpen(false)} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full"><XMarkIcon className="w-6 h-6 text-slate-400" /></button>
                        </div>
                        
                        <form onSubmit={handleSave} className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Task Name</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={taskName} 
                                    onChange={e => setTaskName(e.target.value)}
                                    className="w-full p-4 rounded-2xl bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                                    placeholder="e.g. Pathology Chapter 2"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Start Time</label>
                                    <input 
                                        type="time" 
                                        required 
                                        value={time} 
                                        onChange={e => setTime(e.target.value)}
                                        className="w-full p-4 rounded-2xl bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Progress (%)</label>
                                    <input 
                                        type="number" 
                                        min="0" max="100"
                                        required 
                                        value={progress} 
                                        onChange={e => setProgress(parseInt(e.target.value) || 0)}
                                        className="w-full p-4 rounded-2xl bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner font-black"
                                    />
                                </div>
                            </div>
                            
                            <label className="flex items-center gap-3 cursor-pointer p-4 rounded-2xl hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all border border-transparent hover:border-indigo-100 dark:hover:border-indigo-800 group">
                                <input 
                                    type="checkbox" 
                                    checked={revision} 
                                    onChange={e => setRevision(e.target.checked)}
                                    className="w-6 h-6 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-transform group-active:scale-90"
                                />
                                <span className="font-bold text-slate-700 dark:text-slate-200">Needs Follow-up Revision</span>
                            </label>

                            <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-200 dark:shadow-none transition-all btn-3d uppercase tracking-widest text-xs">
                                {editingId ? 'Update Entry' : 'Save Session'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-indigo-100/50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 rounded-[20px] backdrop-blur-md card-3d">
                        <TableCellsIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Study Tracker</h2>
                        <div className="flex gap-4 mt-1">
                             <button onClick={() => setActiveTab('DAILY')} className={`text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === 'DAILY' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>Daily Log</button>
                             <button onClick={() => setActiveTab('HISTORY')} className={`text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === 'HISTORY' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>Full History</button>
                             <button onClick={() => setActiveTab('CURRICULUM')} className={`text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === 'CURRICULUM' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>Curriculum</button>
                        </div>
                    </div>
                </div>
                {(activeTab === 'DAILY' || activeTab === 'HISTORY') && (
                    <button 
                        onClick={handleOpenAdd}
                        className="btn-3d flex items-center justify-center gap-3 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-sm shadow-xl shadow-indigo-500/20"
                    >
                        <PlusIcon className="w-5 h-5" /> New Entry
                    </button>
                )}
            </div>

            {activeTab === 'DAILY' && (
                <div className="flex justify-between items-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-3 rounded-3xl border border-white/20 dark:border-slate-800 shadow-glass card-3d">
                    <button onClick={() => handleDateChange(-1)} className="p-3 rounded-2xl hover:bg-white/60 dark:hover:bg-slate-800/60 shadow-sm transition-all active:scale-90"><ChevronLeftIcon className="w-6 h-6 text-slate-500" /></button>
                    <div className="relative cursor-pointer px-10 py-1 flex flex-col items-center group">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest opacity-80 group-hover:text-indigo-500 transition-colors">Select Date</span>
                        <h2 className="text-xl font-black text-slate-800 dark:text-white text-center tracking-tight">
                            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </h2>
                        <input 
                            type="date" 
                            value={selectedDate} 
                            onChange={e => setSelectedDate(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            style={{ zIndex: 10 }}
                        />
                    </div>
                    <button onClick={() => handleDateChange(1)} className="p-3 rounded-2xl hover:bg-white/60 dark:hover:bg-slate-800/60 shadow-sm transition-all active:scale-90"><ChevronRightIcon className="w-6 h-6 text-slate-500" /></button>
                </div>
            )}

            {(activeTab === 'DAILY' || activeTab === 'HISTORY') ? (
                <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-[40px] border border-white/20 dark:border-slate-800 overflow-hidden shadow-glass card-3d">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[700px]">
                            <thead>
                                <tr className="bg-white/20 dark:bg-black/10 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] border-b border-white/10 dark:border-slate-800/50">
                                    {activeTab === 'HISTORY' && <th className="p-6 pl-10">Date</th>}
                                    <th className={`p-6 ${activeTab === 'DAILY' ? 'pl-10' : ''}`}>Time</th>
                                    <th className="p-6">Task Description</th>
                                    <th className="p-6">Progress</th>
                                    <th className="p-6 text-center">Revision</th>
                                    <th className="p-6 pr-10 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 dark:divide-slate-800/30">
                                {isLoading ? (
                                    <tr><td colSpan={activeTab === 'HISTORY' ? 6 : 5} className="p-32 text-center text-slate-400 animate-pulse font-black uppercase tracking-widest text-xs">Syncing neural logs...</td></tr>
                                ) : entries.length === 0 ? (
                                    <tr>
                                        <td colSpan={activeTab === 'HISTORY' ? 6 : 5} className="p-32 text-center">
                                            <div className="flex flex-col items-center opacity-20">
                                                <TableCellsIcon className="w-16 h-16 mb-4" />
                                                <p className="text-slate-400 italic font-bold">Log is empty.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : entries.map(entry => (
                                    <tr key={entry.id} className="hover:bg-white/40 dark:hover:bg-slate-800/20 transition-colors group">
                                        {activeTab === 'HISTORY' && (
                                            <td className="p-6 pl-10 font-mono text-xs font-bold text-slate-500">
                                                {new Date(entry.date + 'T12:00:00').toLocaleDateString()}
                                            </td>
                                        )}
                                        <td className={`p-6 ${activeTab === 'DAILY' ? 'pl-10' : ''}`}>
                                            <div className="flex items-center gap-3 text-sm font-black text-slate-700 dark:text-slate-300 font-mono">
                                                <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                                                {entry.time}
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <span className="font-black text-slate-800 dark:text-white text-lg tracking-tight leading-none block">{entry.taskName}</span>
                                        </td>
                                        <td className="p-6 min-w-[200px]">
                                            <div className="flex items-center gap-4">
                                                <div className="flex-1 h-3 bg-white/40 dark:bg-black/20 rounded-full overflow-hidden shadow-inner border border-white/20 dark:border-white/5">
                                                    <div 
                                                        className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 rounded-full transition-all duration-1000 shadow-sm"
                                                        style={{ width: `${entry.progress}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 w-10 text-right">{entry.progress}%</span>
                                            </div>
                                        </td>
                                        <td className="p-6 text-center">
                                            {entry.revision ? (
                                                <span className="inline-flex items-center gap-2 bg-amber-50/50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-200/50 dark:border-amber-800/50 animate-pulse">
                                                    <ArrowPathIcon className="w-4 h-4" /> REVISE
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">MASTERED</span>
                                            )}
                                        </td>
                                        <td className="p-6 pr-10 text-right">
                                            <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-4 group-hover:translate-x-0">
                                                <button onClick={() => handleEdit(entry)} className="p-3 bg-white/80 dark:bg-slate-800/80 rounded-2xl border border-white/50 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-all shadow-sm">
                                                    <PencilSquareIcon className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => setItemToDelete(entry.id)} className="p-3 bg-white/80 dark:bg-slate-800/80 rounded-2xl border border-white/50 dark:border-slate-700 text-slate-500 hover:text-red-500 hover:border-red-300 transition-all shadow-sm">
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* CURRICULUM VIEW (Mimics the user image) */
                <div className="space-y-12">
                    {subjects.map(subject => {
                        const totalMins = subject.videos.reduce((acc, v) => acc + v.totalDurationMinutes, 0);
                        const watchedMins = subject.videos.reduce((acc, v) => acc + v.watchedMinutes, 0);
                        const progress = totalMins > 0 ? Math.round((watchedMins / totalMins) * 100) : 0;
                        
                        return (
                            <div key={subject.id} className="animate-fade-in-up">
                                <div className="flex justify-between items-end mb-6 px-4">
                                    <div>
                                        <h3 className="text-4xl font-black text-slate-800 dark:text-white tracking-tight">{subject.name}</h3>
                                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">{subject.videos.length} Videos Available</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-4xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">{progress}%</div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Mastery</p>
                                    </div>
                                </div>

                                <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-[40px] border border-white/20 dark:border-slate-800 overflow-hidden shadow-glass card-3d p-4 sm:p-8 space-y-6">
                                    {subject.videos.map((video, idx) => (
                                        <div key={video.id} className="group flex items-center gap-6 p-4 rounded-[24px] hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all duration-300">
                                            {/* Serial Number & Thumbnail Placeholder */}
                                            <div className="relative flex-shrink-0">
                                                <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-slate-200 dark:border-slate-700 font-bold text-slate-400 text-sm shadow-inner">
                                                    {117 + idx}
                                                </div>
                                                <div className="absolute -top-1 -right-1 w-6 h-6 bg-white dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-black text-slate-400">
                                                    #{idx+1}
                                                </div>
                                            </div>

                                            <div className="flex-grow min-w-0">
                                                <h4 className={`text-lg font-black tracking-tight leading-tight mb-1 truncate ${video.isCompleted ? 'text-slate-400 line-through decoration-2' : 'text-slate-800 dark:text-white'}`}>
                                                    {video.title}
                                                </h4>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                                                        <ClockIcon className="w-3 h-3" /> {video.totalDurationMinutes} Mins
                                                    </span>
                                                    {video.watchedMinutes > 0 && !video.isCompleted && (
                                                        <span className="text-xs font-bold text-amber-500 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full border border-amber-100 dark:border-amber-800">
                                                            {video.totalDurationMinutes - video.watchedMinutes} Mins Left
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <button 
                                                onClick={() => toggleVideoComplete(subject.id, video.id)}
                                                className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-md transform group-active:scale-90 ${
                                                    video.isCompleted 
                                                    ? 'bg-green-500 text-white shadow-green-500/20' 
                                                    : video.watchedMinutes > 0
                                                        ? 'bg-amber-400 text-white shadow-amber-400/20'
                                                        : 'bg-blue-600 text-white shadow-blue-600/20'
                                                }`}
                                            >
                                                {video.isCompleted ? (
                                                    <CheckCircleIcon className="w-6 h-6" />
                                                ) : video.watchedMinutes > 0 ? (
                                                    <PauseIcon className="w-6 h-6" />
                                                ) : (
                                                    <PlayIcon className="w-6 h-6 pl-1" />
                                                )}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {subjects.length === 0 && (
                        <div className="p-32 text-center opacity-20">
                            <BookOpenIcon className="w-16 h-16 mx-auto mb-4" />
                            <p className="font-black uppercase tracking-widest text-xs">No curriculum subjects loaded</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};