
import React, { useState, useEffect } from 'react';
import { FMGE_SUBJECTS, getAdjustedDate, FMGESubject } from '../types';
import { XMarkIcon, BookOpenIcon, CheckCircleIcon, QIcon, TrashIcon, PlayCircleIcon } from './Icons';

interface FMGELogModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
    initialData?: any; // For editing
    onDelete?: (data: any) => void; // For deleting existing log
    masterData?: FMGESubject[]; // Context for smart filling
}

export const FMGELogModal: React.FC<FMGELogModalProps> = ({ isOpen, onClose, onSave, initialData, onDelete, masterData = [] }) => {
    const [mode, setMode] = useState<'SLIDES' | 'VIDEO' | 'QBANK'>('SLIDES');
    const [subject, setSubject] = useState(FMGE_SUBJECTS[0]);
    
    // Slide Mode State
    const [slideStart, setSlideStart] = useState<string>('');
    const [slideEnd, setSlideEnd] = useState<string>('');
    
    // Video Mode State
    const [selectedVideoId, setSelectedVideoId] = useState('');
    const [videoStart, setVideoStart] = useState<string>('0'); // In minutes
    const [videoEnd, setVideoEnd] = useState<string>(''); // In minutes

    // QBank Mode State
    const [selectedQBankId, setSelectedQBankId] = useState('');
    const [qBankInput, setQBankInput] = useState<string>('');
    
    // Common State
    const [date, setDate] = useState(getAdjustedDate(new Date()));
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            
            if (initialData) {
                // Populate for Edit
                setSubject(initialData.subject || FMGE_SUBJECTS[0]);
                setDate(initialData.date || getAdjustedDate(new Date()));
                setStartTime(initialData.startTime || '');
                setEndTime(initialData.endTime || '');
                setNotes(initialData.notes || '');

                if (initialData.videoId) {
                    setMode('VIDEO');
                    setSelectedVideoId(initialData.videoId);
                    setVideoStart(initialData.videoProgressStart?.toString() || '0');
                    setVideoEnd(initialData.videoProgressEnd?.toString() || '');
                } else if (initialData.qbankId) {
                    setMode('QBANK');
                    setSelectedQBankId(initialData.qbankId);
                    setQBankInput(initialData.qBankCount?.toString() || '');
                } else {
                    setMode('SLIDES');
                    setSlideStart(initialData.slideStart?.toString() || '');
                    setSlideEnd(initialData.slideEnd?.toString() || '');
                }
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
                setQBankInput('');
                setNotes('');
                setMode('SLIDES');
                setSelectedVideoId('');
                setSelectedQBankId('');
                setVideoStart('0');
                setVideoEnd('');
            }
        } else {
            document.body.style.overflow = '';
        }
    }, [isOpen, initialData]);

    // SMART AUTO-FILL LOGIC
    useEffect(() => {
        if (isOpen && !initialData && mode === 'VIDEO' && subject && !selectedVideoId) {
            const subjData = masterData.find(s => s.name === subject);
            if (subjData && subjData.videos && subjData.videos.length > 0) {
                const nextVideo = subjData.videos.find(v => !v.isCompleted) || subjData.videos[0];
                setSelectedVideoId(nextVideo.id);
            }
        }
        if (isOpen && !initialData && mode === 'QBANK' && subject && !selectedQBankId) {
            const subjData = masterData.find(s => s.name === subject);
            if (subjData && subjData.qbanks && subjData.qbanks.length > 0) {
                setSelectedQBankId(subjData.qbanks[0].id);
            }
        }
    }, [isOpen, initialData, mode, subject, masterData]);

    useEffect(() => {
        if (isOpen && !initialData && mode === 'VIDEO' && selectedVideoId) {
            const subjData = masterData.find(s => s.name === subject);
            const video = subjData?.videos.find(v => v.id === selectedVideoId);
            if (video) {
                setVideoStart(video.watchedMinutes.toString());
                const remaining = video.totalDurationMinutes - video.watchedMinutes;
                if (remaining <= 60 && remaining > 0) {
                    setVideoEnd(video.totalDurationMinutes.toString());
                } else {
                    setVideoEnd('');
                }
            }
        }
    }, [selectedVideoId, subject]);

    const handleSave = () => {
        const data: any = {
            logId: initialData?.logId,
            originalEntryId: initialData?.originalEntryId,
            subject,
            date,
            startTime,
            endTime,
            notes
        };

        if (mode === 'SLIDES') {
            if (!slideStart || !slideEnd) {
                alert("Please enter valid slide numbers.");
                return;
            }
            data.slideStart = parseInt(slideStart);
            data.slideEnd = parseInt(slideEnd);
            data.qBankCount = 0;
        } else if (mode === 'VIDEO') {
            if (!selectedVideoId) {
                alert("Please select a video.");
                return;
            }
            data.videoId = selectedVideoId;
            data.videoProgressStart = parseInt(videoStart) || 0;
            data.videoProgressEnd = parseInt(videoEnd) || 0;
            const subjData = masterData.find(s => s.name === subject);
            const video = subjData?.videos.find(v => v.id === selectedVideoId);
            data.videoTitle = video?.title || 'Unknown Video';
            data.qBankCount = 0;
        } else {
            if (!selectedQBankId) {
                alert("Please select a QBank.");
                return;
            }
            data.qbankId = selectedQBankId;
            data.qBankCount = parseInt(qBankInput) || 0;
        }

        onSave(data);
        onClose();
    };

    const handleDelete = () => {
        if (onDelete && initialData) {
            if (confirm("Are you sure you want to delete this study record?")) {
                onDelete(initialData);
                onClose();
            }
        }
    };

    const currentSubjectData = masterData.find(s => s.name === subject);

    const formatMins = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h}h ${m}m`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[95vh]">
                
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0 bg-white/20 dark:bg-black/20 backdrop-blur-md rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${mode === 'VIDEO' ? 'bg-blue-100 text-blue-600' : mode === 'QBANK' ? 'bg-emerald-100 text-emerald-600' : 'bg-cyan-100 text-cyan-600'}`}>
                            {mode === 'VIDEO' ? <PlayCircleIcon className="w-5 h-5" /> : mode === 'QBANK' ? <QIcon className="w-5 h-5" /> : <BookOpenIcon className="w-5 h-5" />}
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">{initialData ? 'Edit Log' : 'Log FMGE Study'}</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                        <XMarkIcon className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50 dark:bg-slate-950/50">
                    
                    {/* Mode Switcher */}
                    <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl">
                        <button onClick={() => setMode('SLIDES')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${mode === 'SLIDES' ? 'bg-white dark:bg-slate-700 shadow-sm text-cyan-700 dark:text-cyan-300' : 'text-slate-500'}`}>Slides</button>
                        <button onClick={() => setMode('VIDEO')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${mode === 'VIDEO' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-700 dark:text-blue-300' : 'text-slate-500'}`}>Video</button>
                        <button onClick={() => setMode('QBANK')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${mode === 'QBANK' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-700 dark:text-emerald-300' : 'text-slate-500'}`}>QBank</button>
                    </div>

                    {/* Subject Selection */}
                    <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Subject</label>
                        <select 
                            value={subject} 
                            onChange={e => {
                                setSubject(e.target.value);
                                setSelectedVideoId(''); 
                                setSelectedQBankId('');
                            }}
                            className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            {FMGE_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {/* Dynamic Content */}
                    {mode === 'SLIDES' && (
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm animate-fade-in">
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 block">Slides Range</label>
                            <div className="flex items-center gap-2">
                                <input type="number" value={slideStart} onChange={e => setSlideStart(e.target.value)} placeholder="Start" className="flex-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border-none font-bold text-center outline-none focus:ring-2 focus:ring-indigo-500" />
                                <span className="text-slate-300">-</span>
                                <input type="number" value={slideEnd} onChange={e => setSlideEnd(e.target.value)} placeholder="End" className="flex-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border-none font-bold text-center outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                        </div>
                    )}

                    {mode === 'VIDEO' && (
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm animate-fade-in space-y-4">
                            <div>
                                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 block">Select Video</label>
                                <select 
                                    value={selectedVideoId} 
                                    onChange={e => setSelectedVideoId(e.target.value)}
                                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border-none text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">-- Choose Video --</option>
                                    {currentSubjectData?.videos?.map(v => (
                                        <option key={v.id} value={v.id}>
                                            {v.title} ({formatMins(v.watchedMinutes)} / {formatMins(v.totalDurationMinutes)}) {v.isCompleted ? '✅' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {selectedVideoId && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 uppercase">From</span>
                                        <input type="number" value={videoStart} onChange={e => setVideoStart(e.target.value)} className="w-full p-3 pl-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-none font-bold text-center outline-none focus:ring-2 focus:ring-blue-500" />
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 uppercase">To</span>
                                        <input type="number" value={videoEnd} onChange={e => setVideoEnd(e.target.value)} className="w-full p-3 pl-8 rounded-xl bg-slate-50 dark:bg-slate-900 border-none font-bold text-center outline-none focus:ring-2 focus:ring-blue-500" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {mode === 'QBANK' && (
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm animate-fade-in space-y-4">
                            <div>
                                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 block">Select QBank</label>
                                <select 
                                    value={selectedQBankId} 
                                    onChange={e => setSelectedQBankId(e.target.value)}
                                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border-none text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="">-- Choose QBank --</option>
                                    {currentSubjectData?.qbanks?.map(q => (
                                        <option key={q.id} value={q.id}>
                                            {q.title} ({q.completedQuestions} / {q.totalQuestions} Qs)
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="relative">
                                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 block">Questions Completed</label>
                                <input 
                                    type="number" 
                                    value={qBankInput} 
                                    onChange={e => setQBankInput(e.target.value)} 
                                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border-none font-bold text-center outline-none focus:ring-2 focus:ring-emerald-500"
                                    placeholder="Count"
                                />
                            </div>
                        </div>
                    )}

                    {/* Time & Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div>
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Date</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Start</label>
                                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold" />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">End</label>
                                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold" />
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Session Notes</label>
                        <textarea 
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-24 shadow-inner"
                            placeholder="Observations..."
                        />
                    </div>

                </div>

                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex gap-3 shrink-0 bg-white dark:bg-slate-900 rounded-b-2xl">
                    {initialData && (
                        <button onClick={handleDelete} className="p-3 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"><TrashIcon className="w-5 h-5" /></button>
                    )}
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm">Cancel</button>
                    <button onClick={handleSave} className="flex-[2] py-3 rounded-xl text-white font-bold shadow-lg transition-all text-sm flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30">
                        <CheckCircleIcon className="w-4 h-4" /> {initialData ? 'Update' : 'Log Study'}
                    </button>
                </div>
            </div>
        </div>
    );
};
