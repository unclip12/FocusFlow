
import React, { useState, useEffect, useMemo } from 'react';
import { StudyEntry, getAdjustedDate } from '../types';
import { getStudyEntries, saveStudyEntry, deleteStudyEntry } from '../services/firebase';
import { PlusIcon, TrashIcon, CheckCircleIcon, ClockIcon, CalendarIcon, PencilSquareIcon, ChevronLeftIcon, ChevronRightIcon, TableCellsIcon, ArrowPathIcon, XMarkIcon } from './Icons';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

const generateId = () => crypto.randomUUID();

export const StudyTrackerView: React.FC = () => {
    const [entries, setEntries] = useState<StudyEntry[]>([]);
    const [selectedDate, setSelectedDate] = useState(getAdjustedDate(new Date()));
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    
    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [taskName, setTaskName] = useState('');
    const [time, setTime] = useState('');
    const [progress, setProgress] = useState(0);
    const [revision, setRevision] = useState(false);
    
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    useEffect(() => {
        loadEntries();
    }, [selectedDate]);

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
            date: selectedDate,
            time,
            taskName,
            progress,
            revision
        };
        
        await saveStudyEntry(entry);
        await loadEntries();
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
        <div className="animate-fade-in space-y-6 pb-24">
            <DeleteConfirmationModal 
                isOpen={!!itemToDelete}
                onClose={() => setItemToDelete(null)}
                onConfirm={handleDelete}
                title="Delete Entry?"
                message="Are you sure you want to remove this log entry?"
            />

            {/* Quick Form Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 animate-scale-up">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                                {editingId ? 'Edit Entry' : 'Log Task'}
                            </h3>
                            <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600"><XMarkIcon className="w-6 h-6" /></button>
                        </div>
                        
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Task Name</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={taskName} 
                                    onChange={e => setTaskName(e.target.value)}
                                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                                    placeholder="e.g. Pathology Chapter 2"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Time</label>
                                    <input 
                                        type="time" 
                                        required 
                                        value={time} 
                                        onChange={e => setTime(e.target.value)}
                                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Progress (%)</label>
                                    <input 
                                        type="number" 
                                        min="0" max="100"
                                        required 
                                        value={progress} 
                                        onChange={e => setProgress(parseInt(e.target.value) || 0)}
                                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                                    />
                                </div>
                            </div>
                            
                            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                                <input 
                                    type="checkbox" 
                                    checked={revision} 
                                    onChange={e => setRevision(e.target.checked)}
                                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Requires Revision?</span>
                            </label>

                            <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all btn-3d">
                                {editingId ? 'Update Entry' : 'Save Entry'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl backdrop-blur-sm">
                        <TableCellsIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Study Tracker</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Detailed task logging by date and time.</p>
                    </div>
                </div>
                <button 
                    onClick={handleOpenAdd}
                    className="btn-3d flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 dark:shadow-none"
                >
                    <PlusIcon className="w-5 h-5" /> Add Log Entry
                </button>
            </div>

            {/* Date Swiper */}
            <div className="flex justify-between items-center bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-2 rounded-2xl border border-white/40 dark:border-slate-700/50 shadow-sm card-3d">
                <button onClick={() => handleDateChange(-1)} className="p-2 rounded-xl hover:bg-white/80 dark:hover:bg-slate-700/80 shadow-sm transition-all active:scale-90"><ChevronLeftIcon className="w-6 h-6 text-slate-500" /></button>
                <div className="relative cursor-pointer px-6 py-1 flex flex-col items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Logs for</span>
                    <h2 className="text-lg font-black text-slate-800 dark:text-white text-center">
                        {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </h2>
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={e => setSelectedDate(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                </div>
                <button onClick={() => handleDateChange(1)} className="p-2 rounded-xl hover:bg-white/80 dark:hover:bg-slate-700/80 shadow-sm transition-all active:scale-90"><ChevronRightIcon className="w-6 h-6 text-slate-500" /></button>
            </div>

            {/* Table View */}
            <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-3xl border border-white/30 dark:border-slate-800 overflow-hidden shadow-glass card-3d">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                                <th className="p-5">Time</th>
                                <th className="p-5">Task Name</th>
                                <th className="p-5">Progress</th>
                                <th className="p-5 text-center">Revision</th>
                                <th className="p-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {isLoading ? (
                                <tr><td colSpan={5} className="p-20 text-center text-slate-400 animate-pulse font-bold">Accessing logs...</td></tr>
                            ) : entries.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center">
                                        <div className="flex flex-col items-center opacity-40">
                                            <TableCellsIcon className="w-12 h-12 mb-2" />
                                            <p className="text-slate-400 italic">No entries for this date.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : entries.map(entry => (
                                <tr key={entry.id} className="hover:bg-white/50 dark:hover:bg-slate-800/30 transition-colors group">
                                    <td className="p-5 font-mono text-sm font-bold text-slate-600 dark:text-slate-400">
                                        <div className="flex items-center gap-2">
                                            <ClockIcon className="w-4 h-4 opacity-30" />
                                            {entry.time}
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <span className="font-bold text-slate-800 dark:text-white text-base leading-tight">{entry.taskName}</span>
                                    </td>
                                    <td className="p-5 min-w-[180px]">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner border border-slate-200/50 dark:border-slate-700/50">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-1000 shadow-sm"
                                                    style={{ width: `${entry.progress}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-xs font-black text-slate-500 w-10">{entry.progress}%</span>
                                        </div>
                                    </td>
                                    <td className="p-5 text-center">
                                        {entry.revision ? (
                                            <span className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-amber-200/50 dark:border-amber-800/50 animate-pulse">
                                                <ArrowPathIcon className="w-3.5 h-3.5" /> YES
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest">NO</span>
                                        )}
                                    </td>
                                    <td className="p-5 text-right">
                                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(entry)} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm">
                                                <PencilSquareIcon className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setItemToDelete(entry.id)} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 hover:border-red-200 transition-all shadow-sm">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
