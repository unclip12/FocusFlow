
import React, { useState, useEffect } from 'react';
import { FMGESubject, FMGEVideoResource, FMGEQBankResource, FMGE_SUBJECTS } from '../types';
import { XMarkIcon, PlusIcon, TrashIcon, CheckCircleIcon, PlayCircleIcon, QIcon } from './Icons';

interface FMGEDataEditorProps {
    isOpen: boolean;
    onClose: () => void;
    subjects: FMGESubject[];
    onSaveSubject: (subject: FMGESubject) => void;
}

const generateId = () => crypto.randomUUID();

export const FMGEDataEditor: React.FC<FMGEDataEditorProps> = ({ isOpen, onClose, subjects, onSaveSubject }) => {
    const [selectedSubjectName, setSelectedSubjectName] = useState(FMGE_SUBJECTS[0]);
    const [currentSubject, setCurrentSubject] = useState<FMGESubject | null>(null);
    
    // Video Form State
    const [videoTitle, setVideoTitle] = useState('');
    const [videoHours, setVideoHours] = useState('');
    const [videoMinutes, setVideoMinutes] = useState('');
    
    // QBank Form State
    const [qbankTitle, setQbankTitle] = useState('');
    const [qbankTotal, setQbankTotal] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadSubject(selectedSubjectName);
        }
    }, [isOpen, selectedSubjectName, subjects]);

    const loadSubject = (name: string) => {
        const existing = subjects.find(s => s.name === name);
        if (existing) {
            setCurrentSubject(JSON.parse(JSON.stringify(existing)));
        } else {
            // Create new template
            setCurrentSubject({
                id: generateId(),
                name,
                totalQuestions: 0,
                completedQuestions: 0,
                qbanks: [],
                videos: []
            });
        }
    };

    const handleAddVideo = () => {
        if (!videoTitle || (!videoHours && !videoMinutes)) return;
        if (!currentSubject) return;

        const h = parseInt(videoHours) || 0;
        const m = parseInt(videoMinutes) || 0;
        const totalMinutes = h * 60 + m;

        const newVideo: FMGEVideoResource = {
            id: generateId(),
            title: videoTitle,
            totalDurationMinutes: totalMinutes,
            watchedMinutes: 0,
            isCompleted: false
        };

        const updatedSubject = {
            ...currentSubject,
            videos: [...(currentSubject.videos || []), newVideo]
        };
        
        setCurrentSubject(updatedSubject);
        onSaveSubject(updatedSubject);
        
        setVideoTitle('');
        setVideoHours('');
        setVideoMinutes('');
    };

    const handleAddQBank = () => {
        if (!qbankTitle || !qbankTotal) return;
        if (!currentSubject) return;

        const newQBank: FMGEQBankResource = {
            id: generateId(),
            title: qbankTitle,
            totalQuestions: parseInt(qbankTotal) || 0,
            completedQuestions: 0
        };

        const updatedSubject = {
            ...currentSubject,
            qbanks: [...(currentSubject.qbanks || []), newQBank]
        };
        
        setCurrentSubject(updatedSubject);
        onSaveSubject(updatedSubject);
        
        setQbankTitle('');
        setQbankTotal('');
    };

    const handleRemoveVideo = (videoId: string) => {
        if (!currentSubject) return;
        const updatedSubject = {
            ...currentSubject,
            videos: currentSubject.videos.filter(v => v.id !== videoId)
        };
        setCurrentSubject(updatedSubject);
        onSaveSubject(updatedSubject);
    };

    const handleRemoveQBank = (qbankId: string) => {
        if (!currentSubject) return;
        const updatedSubject = {
            ...currentSubject,
            qbanks: currentSubject.qbanks.filter(q => q.id !== qbankId)
        };
        setCurrentSubject(updatedSubject);
        onSaveSubject(updatedSubject);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl w-full max-w-4xl rounded-3xl shadow-2xl border border-white/20 dark:border-slate-700/50 flex flex-col max-h-[90vh] overflow-hidden card-3d">
                <div className="p-6 border-b border-white/10 dark:border-slate-800/50 flex justify-between items-center shrink-0">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Configure Subjects</h3>
                    <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors">
                        <XMarkIcon className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                    {/* Sidebar: Subject List - Using Glassy Theme */}
                    <div className="w-full md:w-64 border-r border-white/10 dark:border-slate-800/50 overflow-y-auto bg-white/20 dark:bg-black/20 backdrop-blur-md">
                        <div className="p-2 space-y-1">
                            {FMGE_SUBJECTS.map(subj => {
                                const data = subjects.find(s => s.name === subj);
                                const vidCount = data?.videos?.length || 0;
                                const qCount = data?.qbanks?.length || 0;
                                return (
                                    <button
                                        key={subj}
                                        onClick={() => setSelectedSubjectName(subj)}
                                        className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex justify-between items-center ${selectedSubjectName === subj ? 'bg-indigo-600/90 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-white/40 dark:hover:bg-slate-800/40'}`}
                                    >
                                        <span>{subj}</span>
                                        <div className="flex gap-1">
                                            {vidCount > 0 && <span className={`text-[9px] px-1.5 rounded-full ${selectedSubjectName === subj ? 'bg-white/20' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-600'}`}>{vidCount}V</span>}
                                            {qCount > 0 && <span className={`text-[9px] px-1.5 rounded-full ${selectedSubjectName === subj ? 'bg-white/20' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600'}`}>{qCount}Q</span>}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                        <div className="mb-6">
                            <h4 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{selectedSubjectName}</h4>
                            <p className="text-xs text-slate-500 font-medium">Define your target videos and question banks for this subject.</p>
                        </div>

                        {/* QBank Section */}
                        <div className="mb-10">
                            <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <QIcon className="w-4 h-4" /> Question Banks
                            </h5>
                            
                            <div className="space-y-3 mb-4">
                                {currentSubject?.qbanks && currentSubject.qbanks.length > 0 ? currentSubject.qbanks.map((q) => (
                                    <div key={q.id} className="flex justify-between items-center p-4 bg-white/40 dark:bg-slate-800/40 border border-white/20 dark:border-slate-700/30 rounded-2xl shadow-sm backdrop-blur-sm group">
                                        <div>
                                            <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{q.title}</div>
                                            <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mt-0.5">{q.totalQuestions} Total Questions</div>
                                        </div>
                                        <button onClick={() => handleRemoveQBank(q.id)} className="text-slate-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"><TrashIcon className="w-4 h-4" /></button>
                                    </div>
                                )) : <p className="text-sm text-slate-400 italic py-2">No question banks added yet.</p>}
                            </div>

                            {/* Add QBank Form */}
                            <div className="p-4 bg-emerald-50/30 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100/50 dark:border-emerald-800/30">
                                <div className="space-y-3">
                                    <input 
                                        placeholder="QBank Name (e.g. Marrow, Prepladder)" 
                                        value={qbankTitle}
                                        onChange={e => setQbankTitle(e.target.value)}
                                        className="w-full p-2.5 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 outline-none focus:ring-2 focus:ring-emerald-500/50"
                                    />
                                    <div className="flex gap-2 items-center">
                                        <div className="flex-1 relative">
                                            <input 
                                                type="number" 
                                                placeholder="Total Qs" 
                                                value={qbankTotal}
                                                onChange={e => setQbankTotal(e.target.value)}
                                                className="w-full p-2.5 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 outline-none focus:ring-2 focus:ring-emerald-500/50 text-center font-bold"
                                            />
                                        </div>
                                        <button 
                                            onClick={handleAddQBank}
                                            disabled={!qbankTitle || !qbankTotal}
                                            className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-emerald-700 transition-all disabled:opacity-50"
                                        >
                                            Add QBank
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Videos Section */}
                        <div>
                            <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <PlayCircleIcon className="w-4 h-4" /> Lecture Videos
                            </h5>
                            
                            <div className="space-y-3 mb-4">
                                {currentSubject?.videos && currentSubject.videos.length > 0 ? currentSubject.videos.map((video) => {
                                    const hours = Math.floor(video.totalDurationMinutes / 60);
                                    const mins = video.totalDurationMinutes % 60;
                                    return (
                                        <div key={video.id} className="flex justify-between items-center p-4 bg-white/40 dark:bg-slate-800/40 border border-white/20 dark:border-slate-700/30 rounded-2xl shadow-sm backdrop-blur-sm group">
                                            <div>
                                                <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{video.title}</div>
                                                <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide mt-0.5">{hours}h {mins}m Duration</div>
                                            </div>
                                            <button onClick={() => handleRemoveVideo(video.id)} className="text-slate-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"><TrashIcon className="w-4 h-4" /></button>
                                        </div>
                                    );
                                }) : <p className="text-sm text-slate-400 italic py-2">No videos added yet.</p>}
                            </div>

                            {/* Add Video Form */}
                            <div className="p-4 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-800/30">
                                <div className="space-y-3">
                                    <input 
                                        placeholder="Video Title (e.g. Video 1 - Basics)" 
                                        value={videoTitle}
                                        onChange={e => setVideoTitle(e.target.value)}
                                        className="w-full p-2.5 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    />
                                    <div className="flex gap-2 items-center">
                                        <input 
                                            type="number" 
                                            placeholder="Hrs" 
                                            value={videoHours}
                                            onChange={e => setVideoHours(e.target.value)}
                                            className="w-20 p-2.5 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 text-center outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        />
                                        <span className="text-slate-400 font-bold">:</span>
                                        <input 
                                            type="number" 
                                            placeholder="Mins" 
                                            value={videoMinutes}
                                            onChange={e => setVideoMinutes(e.target.value)}
                                            className="w-20 p-2.5 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 text-center outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        />
                                        <button 
                                            onClick={handleAddVideo}
                                            disabled={!videoTitle || (!videoHours && !videoMinutes)}
                                            className="ml-auto px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
                                        >
                                            Add Video
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
