
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TimeLogEntry, TimeLogCategory, getAdjustedDate, KnowledgeBaseEntry } from '../types';
import { getTimeLogs, saveTimeLog, deleteTimeLog, getTimeLogsForMonth } from '../services/timeLogService';
import { parseTimeLogRequest } from '../services/geminiService';
import { ClockIcon, MoonIcon, TvIcon, MapPinIcon, StarIcon, QIcon, FireIcon, TrashIcon, ListCheckIcon, CoffeeIcon, PlusIcon, VideoIcon, BookOpenIcon, PaperAirplaneIcon, PencilSquareIcon, CheckCircleIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, ChartBarIcon } from './Icons';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

// Visual Theme Config
const CATEGORY_THEMES: Record<string, { bg: string, border: string, text: string, icon: any }> = {
    'STUDY': { bg: 'bg-indigo-100', border: 'border-indigo-500', text: 'text-indigo-700', icon: BookOpenIcon },
    'REVISION': { bg: 'bg-sky-100', border: 'border-sky-500', text: 'text-sky-700', icon: ListCheckIcon },
    'ANKI': { bg: 'bg-amber-100', border: 'border-amber-500', text: 'text-amber-700', icon: StarIcon },
    'QBANK': { bg: 'bg-emerald-100', border: 'border-emerald-500', text: 'text-emerald-700', icon: QIcon },
    'VIDEO': { bg: 'bg-violet-100', border: 'border-violet-500', text: 'text-violet-700', icon: VideoIcon },
    'BREAK': { bg: 'bg-teal-100', border: 'border-teal-500', text: 'text-teal-700', icon: CoffeeIcon },
    'SLEEP': { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-700', icon: MoonIcon },
    'LIFE': { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-700', icon: MapPinIcon },
    'ENTERTAINMENT': { bg: 'bg-pink-100', border: 'border-pink-500', text: 'text-pink-700', icon: TvIcon },
    'OTHER': { bg: 'bg-slate-100', border: 'border-slate-500', text: 'text-slate-700', icon: ClockIcon },
};

interface TimeLoggerViewProps {
    knowledgeBase?: KnowledgeBaseEntry[];
    onViewPage?: (page: string) => void;
}

interface EditModalProps {
    isOpen: boolean;
    log: TimeLogEntry | null;
    onClose: () => void;
    onSave: (log: TimeLogEntry) => void;
}

const EditLogModal: React.FC<EditModalProps> = ({ isOpen, log, onClose, onSave }) => {
    const [formData, setFormData] = useState<Partial<TimeLogEntry>>({});

    useEffect(() => {
        if (log) setFormData(log);
    }, [log]);

    if (!isOpen || !log) return null;

    const handleSave = () => {
        if (formData.startTime && formData.endTime && formData.activity) {
            const start = new Date(formData.startTime);
            const end = new Date(formData.endTime);
            const duration = Math.round((end.getTime() - start.getTime()) / 60000);
            
            onSave({
                ...log,
                ...formData,
                date: getAdjustedDate(start),
                durationMinutes: duration,
                startTime: formData.startTime,
                endTime: formData.endTime,
                activity: formData.activity!
            } as TimeLogEntry);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 animate-fade-in-up">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Edit Log Entry</h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Activity</label>
                        <input 
                            type="text" 
                            value={formData.activity || ''} 
                            onChange={e => setFormData({...formData, activity: e.target.value})}
                            className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase">Start</label>
                            <input 
                                type="datetime-local" 
                                value={formData.startTime ? new Date(formData.startTime).toISOString().slice(0, 16) : ''}
                                onChange={e => setFormData({...formData, startTime: new Date(e.target.value).toISOString()})}
                                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase">End</label>
                            <input 
                                type="datetime-local" 
                                value={formData.endTime ? new Date(formData.endTime).toISOString().slice(0, 16) : ''}
                                onChange={e => setFormData({...formData, endTime: new Date(e.target.value).toISOString()})}
                                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                        <select 
                            value={formData.category}
                            onChange={e => setFormData({...formData, category: e.target.value as any})}
                            className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm"
                        >
                            {Object.keys(CATEGORY_THEMES).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300">Cancel</button>
                    <button onClick={handleSave} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">Save</button>
                </div>
            </div>
        </div>
    );
};

const MonthlySummaryChart = () => {
    const [chartDate, setChartDate] = useState(new Date());
    const [chartData, setChartData] = useState<any[]>([]);
    const [loadingChart, setLoadingChart] = useState(true);

    useEffect(() => {
        const loadChartData = async () => {
            setLoadingChart(true);
            const year = chartDate.getFullYear();
            const month = chartDate.getMonth() + 1;
            try {
                const logs = await getTimeLogsForMonth(year, month);
                
                const dataMap = new Map<number, number>();
                const daysInMonth = new Date(year, month, 0).getDate();
                
                for(let i=1; i<=daysInMonth; i++) dataMap.set(i, 0);

                logs.forEach(log => {
                    if (log.category === 'STUDY' || log.category === 'REVISION' || log.category === 'ANKI' || log.category === 'QBANK') {
                        const d = new Date(log.startTime).getDate();
                        const dur = log.durationMinutes || 0;
                        dataMap.set(d, (dataMap.get(d) || 0) + dur);
                    }
                });

                const data = Array.from(dataMap.entries()).map(([day, mins]) => ({
                    name: String(day),
                    minutes: Math.round(mins / 60 * 10) / 10
                }));
                
                setChartData(data);
            } catch (e) {
                console.error("Chart error", e);
            } finally {
                setLoadingChart(false);
            }
        };
        loadChartData();
    }, [chartDate]);

    const prevMonth = () => {
        const d = new Date(chartDate);
        d.setMonth(d.getMonth() - 1);
        setChartDate(d);
    }

    const nextMonth = () => {
        const d = new Date(chartDate);
        d.setMonth(d.getMonth() + 1);
        setChartDate(d);
    }

    return (
        <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 p-4 rounded-xl mb-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <button onClick={prevMonth} className="p-1 hover:bg-white/50 dark:hover:bg-slate-700/50 rounded backdrop-blur-sm"><ChevronLeftIcon className="w-4 h-4 text-slate-500" /></button>
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{chartDate.toLocaleString('default', { month: 'long', year: 'numeric' })} Study Hours</h3>
                <button onClick={nextMonth} className="p-1 hover:bg-white/50 dark:hover:bg-slate-700/50 rounded backdrop-blur-sm"><ChevronRightIcon className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="h-48 w-full min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={2} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                        <Bar dataKey="minutes" fill="#6366f1" radius={[2, 2, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export const TimeLoggerView: React.FC<TimeLoggerViewProps> = ({ knowledgeBase, onViewPage }) => {
    const [logs, setLogs] = useState<TimeLogEntry[]>([]);
    const [selectedDate, setSelectedDate] = useState(getAdjustedDate(new Date()));
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    
    const [editingLog, setEditingLog] = useState<TimeLogEntry | null>(null);
    const [logToDelete, setLogToDelete] = useState<string | null>(null);

    useEffect(() => {
        loadLogs();
    }, [selectedDate]);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const data = await getTimeLogs(selectedDate);
            setLogs(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleAddLog = async () => {
        if (!input.trim()) return;
        setProcessing(true);
        
        try {
            const nowISO = new Date().toISOString();
            const result = await parseTimeLogRequest(input, nowISO);
            
            if (result) {
                const newLog: TimeLogEntry = {
                    id: generateId(),
                    date: getAdjustedDate(new Date(result.startTime)),
                    startTime: result.startTime,
                    endTime: result.endTime,
                    durationMinutes: result.durationMinutes,
                    category: result.category,
                    activity: result.activity,
                    source: 'MANUAL'
                };
                
                await saveTimeLog(newLog);
                if (newLog.date === selectedDate) {
                    setLogs(prev => [...prev, newLog].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
                }
                setInput('');
            } else {
                alert("Could not understand time log. Try 'Studied Cardio for 1 hour'.");
            }
        } catch (e) {
            console.error("Log parsing failed", e);
            alert("Failed to process log.");
        } finally {
            setProcessing(false);
        }
    };

    const handleDelete = async () => {
        if (logToDelete) {
            await deleteTimeLog(logToDelete);
            setLogs(prev => prev.filter(l => l.id !== logToDelete));
            setLogToDelete(null);
        }
    };

    const handleUpdate = async (updatedLog: TimeLogEntry) => {
        await saveTimeLog(updatedLog);
        setLogs(prev => prev.map(l => l.id === updatedLog.id ? updatedLog : l).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
    };

    const totalDuration = logs.reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
    const hours = Math.floor(totalDuration / 60);
    const mins = totalDuration % 60;

    return (
        <div className="animate-fade-in max-w-4xl mx-auto pb-20">
            <DeleteConfirmationModal 
                isOpen={!!logToDelete}
                onClose={() => setLogToDelete(null)}
                onConfirm={handleDelete}
                title="Delete Log?"
            />
            
            <EditLogModal 
                isOpen={!!editingLog}
                log={editingLog}
                onClose={() => setEditingLog(null)}
                onSave={handleUpdate}
            />

            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-100/50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl backdrop-blur-sm">
                        <ClockIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Time Logger</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Track where your time goes.</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Today</p>
                    <p className="text-2xl font-black text-slate-800 dark:text-white">{hours}h {mins}m</p>
                </div>
            </div>

            <MonthlySummaryChart />

            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 rounded-2xl p-4 mb-6 shadow-sm">
                <div className="flex gap-2 mb-4">
                    <input 
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddLog()}
                        placeholder="e.g. 'Slept for 8 hours', 'Studied Cardio 30 mins'"
                        className="flex-1 p-3 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm backdrop-blur-sm"
                        disabled={processing}
                    />
                    <button 
                        onClick={handleAddLog}
                        disabled={processing || !input.trim()}
                        className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition-all"
                    >
                        {processing ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <PaperAirplaneIcon className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            <div className="flex justify-between items-center mb-4 bg-slate-50/50 dark:bg-slate-800/50 p-2 rounded-2xl border border-white/40 dark:border-slate-700/50 backdrop-blur-sm">
                <button onClick={() => {
                    const d = new Date(selectedDate + 'T12:00:00');
                    d.setDate(d.getDate() - 1);
                    setSelectedDate(getAdjustedDate(d));
                }} className="p-2 hover:bg-white/50 dark:hover:bg-slate-700/50 rounded-full transition-colors"><ChevronLeftIcon className="w-5 h-5 text-slate-500" /></button>
                
                <div className="relative group cursor-pointer">
                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">
                        {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </h3>
                    <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>

                <button onClick={() => {
                    const d = new Date(selectedDate + 'T12:00:00');
                    d.setDate(d.getDate() + 1);
                    setSelectedDate(getAdjustedDate(d));
                }} className="p-2 hover:bg-white/50 dark:hover:bg-slate-700/50 rounded-full transition-colors"><ChevronRightIcon className="w-5 h-5 text-slate-500" /></button>
            </div>

            <div className="space-y-3">
                {logs.length > 0 ? logs.map(log => {
                    const theme = CATEGORY_THEMES[log.category] || CATEGORY_THEMES.OTHER;
                    return (
                        <div key={log.id} className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-xl p-4 border border-white/30 dark:border-slate-700 flex items-center justify-between group shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${theme.bg} ${theme.text}`}>
                                    <theme.icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-white text-sm">{log.activity}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">
                                        {new Date(log.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                                        {new Date(log.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                                        ({log.durationMinutes}m)
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setEditingLog(log)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><PencilSquareIcon className="w-4 h-4" /></button>
                                <button onClick={() => setLogToDelete(log.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="text-center py-12 text-slate-400 italic">No logs for this date.</div>
                )}
            </div>
        </div>
    );
};
