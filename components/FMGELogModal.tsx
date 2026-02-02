
import React, { useState, useEffect } from 'react';
import { FMGE_SUBJECTS, getAdjustedDate } from '../types';
import { XMarkIcon, BookOpenIcon, CheckCircleIcon, QIcon, TrashIcon } from './Icons';

interface FMGELogModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
    initialData?: any; // For editing
    onDelete?: (data: any) => void; // For deleting existing log
}

export const FMGELogModal: React.FC<FMGELogModalProps> = ({ isOpen, onClose, onSave, initialData, onDelete }) => {
    const [subject, setSubject] = useState(FMGE_SUBJECTS[0]);
    const [slideStart, setSlideStart] = useState<string>('');
    const [slideEnd, setSlideEnd] = useState<string>('');
    const [date, setDate] = useState(getAdjustedDate(new Date()));
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [qBankCount, setQBankCount] = useState<string>('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            
            if (initialData) {
                // Populate for Edit
                setSubject(initialData.subject || FMGE_SUBJECTS[0]);
                setSlideStart(initialData.slideStart?.toString() || '');
                setSlideEnd(initialData.slideEnd?.toString() || '');
                setDate(initialData.date || getAdjustedDate(new Date()));
                setStartTime(initialData.startTime || '');
                setEndTime(initialData.endTime || '');
                setQBankCount(initialData.qBankCount?.toString() || '');
                setNotes(initialData.notes || '');
            } else {
                // Defaults for New
                const now = new Date();
                setDate(getAdjustedDate(now));
                const end = new Date();
                const start = new Date(end.getTime() - 60 * 60000); // Default 1h
                setStartTime(start.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'}));
                setEndTime(end.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'}));
                
                setSubject(FMGE_SUBJECTS[0]);
                setSlideStart('');
                setSlideEnd('');
                setQBankCount('');
                setNotes('');
            }
        } else {
            document.body.style.overflow = '';
        }
    }, [isOpen, initialData]);

    const totalSlides = (slideStart && slideEnd) ? (parseInt(slideEnd) - parseInt(slideStart) + 1) : 0;

    const handleSave = () => {
        if (!slideStart || !slideEnd) {
            alert("Please enter valid slide numbers.");
            return;
        }
        onSave({
            logId: initialData?.logId, // Pass back ID if editing
            originalEntryId: initialData?.originalEntryId, // Pass back parent ID if editing
            subject,
            slideStart: parseInt(slideStart),
            slideEnd: parseInt(slideEnd),
            date,
            startTime,
            endTime,
            qBankCount: parseInt(qBankCount) || 0,
            notes
        });
        onClose();
    };

    const handleDelete = () => {
        if (onDelete && initialData) {
            if (confirm("Are you sure you want to delete this study record? This will revert your revision status to the previous level.")) {
                onDelete(initialData);
                onClose();
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[95vh]">
                
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0 bg-cyan-50/50 dark:bg-cyan-900/20 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400">
                            <BookOpenIcon className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">{initialData ? 'Edit FMGE Log' : 'Log FMGE Study'}</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/50 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <XMarkIcon className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50 dark:bg-slate-950/50">
                    
                    {/* Subject Selection */}
                    <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Subject</label>
                        <select 
                            value={subject} 
                            onChange={e => setSubject(e.target.value)}
                            className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                            {FMGE_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {/* Slides */}
                    <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Slides Range</label>
                        <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                value={slideStart} 
                                onChange={e => setSlideStart(e.target.value)} 
                                placeholder="Start"
                                className="flex-1 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-center outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                            <span className="text-slate-400">-</span>
                            <input 
                                type="number" 
                                value={slideEnd} 
                                onChange={e => setSlideEnd(e.target.value)} 
                                placeholder="End"
                                className="flex-1 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-center outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>
                        {totalSlides > 0 && (
                            <p className="text-xs text-cyan-600 dark:text-cyan-400 font-bold mt-1 text-right">Total: {totalSlides} Slides</p>
                        )}
                    </div>

                    {/* Time & Date */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Date</label>
                                <input 
                                    type="date"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    className="w-full p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">QBank Count</label>
                                <div className="relative">
                                    <input 
                                        type="number"
                                        value={qBankCount}
                                        onChange={e => setQBankCount(e.target.value)}
                                        className="w-full p-2.5 pl-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none focus:ring-2 focus:ring-cyan-500"
                                        placeholder="0"
                                    />
                                    <QIcon className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Start Time</label>
                                <input 
                                    type="time"
                                    value={startTime}
                                    onChange={e => setStartTime(e.target.value)}
                                    className="w-full p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">End Time</label>
                                <input 
                                    type="time"
                                    value={endTime}
                                    onChange={e => setEndTime(e.target.value)}
                                    className="w-full p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Session Notes</label>
                        <textarea 
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-cyan-500 resize-none h-24"
                            placeholder="Topics covered, questions difficult, etc..."
                        />
                    </div>

                </div>

                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex gap-3 shrink-0 bg-white dark:bg-slate-900 rounded-b-2xl">
                    {initialData && (
                        <button 
                            type="button"
                            onClick={handleDelete} 
                            className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors" 
                            title="Delete Log"
                        >
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    )}
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm">Cancel</button>
                    <button 
                        onClick={handleSave} 
                        className="flex-[2] py-3 rounded-xl text-white font-bold shadow-lg transition-colors text-sm flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 shadow-cyan-200 dark:shadow-none"
                    >
                        <CheckCircleIcon className="w-4 h-4" /> {initialData ? 'Update Study' : 'Save Study'}
                    </button>
                </div>
            </div>
        </div>
    );
};
