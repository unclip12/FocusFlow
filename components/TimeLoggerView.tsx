import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TimeLogEntry, TimeLogCategory, getAdjustedDate, KnowledgeBaseEntry } from '../types';
import { getTimeLogsForTimeline, saveTimeLog, deleteTimeLog, backfillTimeLogs, getTimeLogsForMonth } from '../services/timeLogService';
import { parseTimeLogRequest } from '../services/geminiService';
import { ClockIcon, MoonIcon, TvIcon, MapPinIcon, FireIcon, TrashIcon, ListCheckIcon, CoffeeIcon, PlusCircleIcon, PlusIcon, VideoIcon, BookOpenIcon, PaperAirplaneIcon, PencilSquareIcon, CheckCircleIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from './Icons';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

// Visual Theme Config
const CATEGORY_THEMES: Record<string, { bg: string, border: string, text: string, icon: any }> = {
    'STUDY': { bg: 'bg-indigo-100', border: 'border-indigo-500', text: 'text-indigo-700', icon: BookOpenIcon },
    'REVISION': { bg: 'bg-sky-100', border: 'border-sky-500', text: 'text-sky-700', icon: ListCheckIcon },
    'ANKI': { bg: 'bg-amber-100', border: 'border-amber-500', text: 'text-amber-700', icon: FireIcon },
    'QBANK': { bg: 'bg-emerald-100', border: 'border-emerald-500', text: 'text-emerald-700', icon: CheckCircleIcon },
    'VIDEO': { bg: 'bg-violet-100', border: 'border-violet-500', text: 'text-violet-700', icon: VideoIcon },
    'BREAK': { bg: 'bg-teal-100', border: 'border-teal-500', text: 'text-teal-700', icon: CoffeeIcon },
    'SLEEP': { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-700', icon: MoonIcon },
    'LIFE': { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-700', icon: MapPinIcon },
    'ENTERTAINMENT': { bg: 'bg-pink-100', border: 'border-pink-500', text: 'text-pink-700', icon: TvIcon },
    'OTHER': { bg: 'bg-slate-100', border: 'border-slate-500', text: 'text-slate-700', icon: ClockIcon },
};

const GAP_THRESHOLD_MINS = 5; 

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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
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
                                type="date" 
                                value={formData.startTime ? new Date(formData.startTime).toISOString().split('T')[0] : ''}
                                onChange={e => {
                                    const newDateStr = e.target.value;
                                    const oldDate = new Date(formData.startTime!);
                                    const newDate = new Date(newDateStr + "T00:00:00");
                                    newDate.setHours(oldDate.getHours(), oldDate.getMinutes(), oldDate.getSeconds(), oldDate.getMilliseconds());
                                    setFormData({...formData, startTime: newDate.toISOString()});
                                }}
                                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm"
                            />
                            <input 
                                type="time" 
                                value={formData.startTime ? new Date(formData.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', hour12:false}) : ''}
                                onChange={e => {
                                    const oldDate = new Date(formData.startTime!);
                                    const [h, m] = e.target.value.split(':').map(Number);
                                    oldDate.setHours(h, m, 0, 0);
                                    setFormData({...formData, startTime: oldDate.toISOString()});
                                }}
                                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase">End</label>
                            <input 
                                type="date" 
                                value={formData.endTime ? new Date(formData.endTime).toISOString().split('T')[0] : ''}
                                onChange={e => {
                                    const newDateStr = e.target.value;
                                    const oldDate = new Date(formData.endTime!);
                                    const newDate = new Date(newDateStr + "T00:00:00");
                                    newDate.setHours(oldDate.getHours(), oldDate.getMinutes(), oldDate.getSeconds(), oldDate.getMilliseconds());
                                    setFormData({...formData, endTime: newDate.toISOString()});
                                }}
                                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm"
                            />
                            <input 
                                type="time" 
                                value={formData.endTime ? new Date(formData.endTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', hour12:false}) : ''}
                                onChange={e => {
                                    const oldDate = new Date(formData.endTime!);
                                    const [h, m] = e.target.value.split(':').map(Number);
                                    oldDate.setHours(h, m, 0, 0);
                                    setFormData({...formData, endTime: oldDate.toISOString()});
                                }}
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
            const month = chartDate.getMonth() + 1; // 1-based month
            try {
                const logs = await getTimeLogsForMonth(year, month);
                
                const dataMap = new Map<string, number>();
                logs.forEach(log => {
                    const current = dataMap.get(log.category) || 0;
                    dataMap.set(log.category, current + log.durationMinutes);
                });
    
                const formattedData = Array.from(dataMap.entries()).map(([name, value]) => ({
                    name,
                    hours: value / 60,
                })).sort((a,b) => b.hours - a.hours);
    
                setChartData(formattedData);
            } catch (error) {
                console.error("Failed to load chart data:", error);
                setChartData([]);
            } finally {
                setLoadingChart(false);
            }
        };

        loadChartData();
    }, [chartDate]);
    
    const changeMonth = (offset: number) => {
        setChartDate(prev => {
            const newDate = new Date(prev);
            newDate.setDate(1); // Set to 1st to avoid month skipping issues
            newDate.setMonth(newDate.getMonth() + offset);
            return newDate;
        });
    };

    const COLORS: Record<string, string> = {
        'STUDY': '#6366f1',
        'REVISION': '#38bdf8',
        'ANKI': '#f59e0b',
        'QBANK': '#10b981',
        'VIDEO': '#8b5cf6',
        'BREAK': '#14b8a6',
        'SLEEP': '#3b82f6',
        'LIFE': '#f97316',
        'ENTERTAINMENT': '#ec4899',
        'NOTE_TAKING': '#f43f5e',
        'OUTING': '#a855f7',
        'PERSONAL': '#84cc16',
        'OTHER': '#64748b'
    };

    return (
        <div className="mt-8 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-700 dark:text-slate-200">Monthly Summary</h3>
                <div className="flex items-center gap-2">
                    <button onClick={() => changeMonth(-1)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronLeftIcon className="w-5 h-5 text-slate-500"/></button>
                    <span className="text-sm font-bold text-slate-500 w-28 text-center">
                        {chartDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={() => changeMonth(1)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronRightIcon className="w-5 h-5 text-slate-500"/></button>
                </div>
            </div>
            <div className="h-64">
                {loadingChart ? <div className="flex items-center justify-center h-full text-slate-400">Loading chart...</div> :
                chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                            <XAxis type="number" tick={{ fontSize: 10 }} unit="h" />
                            <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} interval={0} />
                            <Tooltip 
                                formatter={(value) => `${(value as number).toFixed(1)} hours`} 
                                cursor={{fill: 'rgba(239, 246, 255, 0.5)'}}
                                contentStyle={{
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: 'rgba(255, 255, 255, 0.9)',
                                    backdropFilter: 'blur(4px)',
                                    fontSize: '12px'
                                }}
                            />
                            <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#8884d8'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : <div className="flex items-center justify-center h-full text-slate-400">No data for this month.</div>
                }
            </div>
        </div>
    );
};


export const TimeLoggerView: React.FC<TimeLoggerViewProps> = ({ knowledgeBase = [], onViewPage }) => {
    const [logs, setLogs] = useState<TimeLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [chatInput, setChatInput] = useState('');
    
    const [logToDelete, setLogToDelete] = useState<string | null>(null);
    const [editingLog, setEditingLog] = useState<TimeLogEntry | null>(null);
    
    const [selectedDate, setSelectedDate] = useState(getAdjustedDate(new Date()));
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-refresh on mount and date change
    useEffect(() => {
        loadData(selectedDate);
    }, [selectedDate, knowledgeBase]);

    // Scroll to bottom on initial load
    useEffect(() => {
        if (!loading && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs.length, loading]);

    const loadData = async (date: string) => {
        setLoading(true);
        await backfillTimeLogs(knowledgeBase, date);
        const allLogs = await getTimeLogsForTimeline(date);
        
        const calendarDayStart = new Date(date + 'T00:00:00').getTime();
        const calendarDayEnd = new Date(date + 'T23:59:59.999').getTime();

        const timelineLogs = allLogs.filter(log => {
            const logStart = new Date(log.startTime).getTime();
            const logEnd = new Date(log.endTime).getTime();
            
            // Overlap check
            return logStart <= calendarDayEnd && logEnd >= calendarDayStart;
        });

        timelineLogs.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

        setLogs(timelineLogs);
        setLoading(false);
    };

    const handleDateChange = (offset: number) => {
        const d = new Date(selectedDate + 'T12:00:00'); // Use noon to avoid timezone day shifts
        d.setDate(d.getDate() + offset);
        setSelectedDate(getAdjustedDate(d));
    };

    const handleChatSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!chatInput.trim()) return;

        const originalInput = chatInput;
        setChatInput('');

        const parsed = await parseTimeLogRequest(originalInput, new Date().toISOString());
        
        if (parsed) {
            const dateForLog = getAdjustedDate(new Date(parsed.startTime));

            if (dateForLog !== selectedDate) {
                if (confirm(`This log is for ${dateForLog}. Switch view to that day?`)) {
                    setSelectedDate(dateForLog);
                }
            }

            let pageNumber: string | undefined;
            const pgMatch = originalInput.toLowerCase().match(/(?:pg|page|p\.?)\s*(\d+)/);
            if (pgMatch) {
                pageNumber = pgMatch[1];
            }

            const newLog: TimeLogEntry = {
                id: generateId(),
                date: dateForLog,
                startTime: parsed.startTime,
                endTime: parsed.endTime,
                durationMinutes: parsed.durationMinutes,
                activity: parsed.activity,
                category: parsed.category,
                source: 'CHAT',
                pageNumber: pageNumber
            };
            
            await saveTimeLog(newLog);
            
            if (dateForLog === selectedDate) {
                const updatedLogs = [...logs, newLog].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
                setLogs(updatedLogs);
            }
        } else {
            alert("Sorry, I couldn't understand that. Please try a format like '10am-12pm study cardio' or '30 mins break'.");
            setChatInput(originalInput);
        }
    };

    const handleEditSave = async (updatedLog: TimeLogEntry) => {
        await saveTimeLog(updatedLog);
        setLogs(prev => prev.map(l => l.id === updatedLog.id ? updatedLog : l).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
        setEditingLog(null);
    };

    const executeDelete = async () => {
        if (logToDelete) {
            await deleteTimeLog(logToDelete);
            setLogs(prev => prev.filter(l => l.id !== logToDelete));
            setLogToDelete(null);
        }
    };

    // Stats
    const totalMinutes = logs.reduce((acc, l) => acc + l.durationMinutes, 0);
    const studyMinutes = logs.filter(l => ['STUDY', 'REVISION', 'ANKI', 'QBANK', 'VIDEO'].includes(l.category)).reduce((acc, l) => acc + l.durationMinutes, 0);
    const sleepMinutes = logs.filter(l => l.category === 'SLEEP').reduce((acc, l) => acc + l.durationMinutes, 0);
    const totalWakingMinutes = totalMinutes - sleepMinutes;
    const focusScore = totalWakingMinutes > 0 ? Math.round((studyMinutes / totalWakingMinutes) * 100) : 0;


    // --- RENDER HELPERS ---

    const renderTimeline = () => {
        if (logs.length === 0) return null;

        const timelineItems: React.ReactNode[] = [];
        const now = new Date();
        const isToday = selectedDate === getAdjustedDate(now);

        for (let i = 0; i < logs.length; i++) {
            const log = logs[i];
            const prevLog = i > 0 ? logs[i-1] : null;
            
            // Gap Calculation
            if (prevLog) {
                const prevEnd = new Date(prevLog.endTime);
                const currStart = new Date(log.startTime);
                const gapMins = (currStart.getTime() - prevEnd.getTime()) / 60000;

                if (gapMins > GAP_THRESHOLD_MINS) {
                    timelineItems.push(
                        <div key={`gap-${log.id}`} className="flex items-center my-1 pl-[4.5rem] group relative">
                            {/* Dotted Line */}
                            <div className="absolute left-[3.5rem] top-0 bottom-0 w-0.5 border-l-2 border-dotted border-slate-300 dark:border-slate-600"></div>
                            
                            <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-2 flex items-center justify-between hover:bg-white dark:hover:bg-slate-800 transition-colors">
                                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider">Free Time • {Math.round(gapMins)}m</span>
                                <button 
                                    onClick={() => {
                                        // Pre-fill gap time
                                        const startStr = prevEnd.toLocaleTimeString([], {hour:'numeric', minute:'2-digit', hour12:true});
                                        const endStr = currStart.toLocaleTimeString([], {hour:'numeric', minute:'2-digit', hour12:true});
                                        setChatInput(`${startStr} - ${endStr} `);
                                    }}
                                    className="p-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full hover:scale-110 transition-transform"
                                >
                                    <PlusIcon className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    );
                }
            }

            // Render Log
            const theme = CATEGORY_THEMES[log.category] || CATEGORY_THEMES['OTHER'];
            const Icon = theme.icon;
            const durationStr = log.durationMinutes >= 60 
                ? `${Math.floor(log.durationMinutes/60)}h ${log.durationMinutes%60}m` 
                : `${Math.round(log.durationMinutes)}m`;
            
            const calendarDayStart = new Date(selectedDate + 'T00:00:00');
            const logStart = new Date(log.startTime);
            const isContinuation = logStart < calendarDayStart;

            const displayStartTime = isContinuation ? calendarDayStart : logStart;
            const startTimeStr = displayStartTime.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'});

            const originalStartTimeStr = logStart.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'});
            const endTimeStr = new Date(log.endTime).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'});

            timelineItems.push(
                <div key={log.id} className="flex group relative mb-2">
                    {/* Left Time */}
                    <div className="w-14 flex-shrink-0 text-right text-[10px] font-bold text-slate-400 pt-4 mr-4">
                        {startTimeStr}
                    </div>

                    {/* Center Track */}
                    <div className="absolute left-[3.5rem] top-0 bottom-[-0.5rem] w-0.5 bg-slate-200 dark:bg-slate-700 -z-10 group-last:bottom-auto group-last:h-full"></div>
                    
                    {/* Capsule Node */}
                    <div className={`w-8 h-8 rounded-full ${theme.bg} border-2 ${theme.border} flex items-center justify-center z-10 shrink-0 mt-1 shadow-sm`}>
                        <Icon className={`w-4 h-4 ${theme.text}`} />
                    </div>

                    {/* Card */}
                    <div className="flex-1 ml-3 min-w-0">
                        <div className={`bg-white dark:bg-slate-800 rounded-2xl p-3 shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all relative group/card`}>
                            <div className="flex justify-between items-start">
                                <div className="min-w-0">
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-white truncate leading-tight">{log.activity}</h4>
                                     <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${theme.bg} ${theme.text} mt-1 inline-block`}>{log.category}</span>
                                        {isContinuation && (
                                            <div className="text-[9px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 inline-block mt-1">
                                                Continued
                                            </div>
                                        )}
                                        {log.pageNumber && (
                                            <span className="text-[9px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 cursor-pointer hover:text-indigo-500 mt-1" onClick={() => onViewPage?.(String(log.pageNumber))}>
                                                PG {log.pageNumber}
                                            </span>
                                        )}
                                     </div>
                                </div>
                                
                                {/* Actions */}
                                <div className="flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                    <button onClick={() => setEditingLog(log)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-indigo-500">
                                        <PencilSquareIcon className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => setLogToDelete(log.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-slate-400 hover:text-red-500">
                                        <TrashIcon className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-50 dark:border-slate-700/50 text-[10px] text-slate-400">
                                <span>{originalStartTimeStr} – {endTimeStr}</span>
                                <span className="font-mono font-bold text-slate-500 dark:text-slate-400">{durationStr}</span>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        return timelineItems;
    };

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col relative pb-24">
            <DeleteConfirmationModal 
                isOpen={!!logToDelete}
                onClose={() => setLogToDelete(null)}
                onConfirm={executeDelete}
                title="Delete Log?"
            />
            
            <EditLogModal 
                isOpen={!!editingLog}
                log={editingLog}
                onClose={() => setEditingLog(null)}
                onSave={handleEditSave}
            />

            {/* Top Summary Bar */}
            <div className="flex gap-2 px-2 mb-4 overflow-x-auto no-scrollbar shrink-0">
                <div className="flex-1 min-w-[100px] bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Total Logged</span>
                    <span className="text-xl font-black text-slate-800 dark:text-white">{Math.round(totalMinutes/60)}h {totalMinutes%60}m</span>
                </div>
                <div className="flex-1 min-w-[100px] bg-indigo-50 dark:bg-indigo-900/10 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase">Study Time</span>
                    <span className="text-xl font-black text-indigo-700 dark:text-indigo-300">{Math.round(studyMinutes/60)}h {studyMinutes%60}m</span>
                </div>
                <div className="flex-1 min-w-[100px] bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase">Focus Score</span>
                    <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">{focusScore}%</span>
                </div>
            </div>

            {/* Date Picker */}
            <div className="flex justify-between items-center px-4 mb-2">
                <h3 className="font-bold text-slate-700 dark:text-slate-200">Timeline</h3>
                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
                    <button onClick={() => handleDateChange(-1)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <ChevronLeftIcon className="w-5 h-5 text-slate-500" />
                    </button>
                    <input 
                        type="date" 
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-500 dark:text-slate-400 border-none outline-none focus:ring-0 p-1 text-center"
                    />
                    <button onClick={() => handleDateChange(1)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <ChevronRightIcon className="w-5 h-5 text-slate-500" />
                    </button>
                </div>
            </div>

            {/* Timeline Scroll Area */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar relative" ref={scrollRef}>
                {loading ? (
                    <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 dark:text-slate-600">
                        <ClockIcon className="w-12 h-12 mb-2 opacity-50" />
                        <p className="text-sm font-medium">No logs for this day.</p>
                        <p className="text-xs mt-1">Type below to add one.</p>
                    </div>
                ) : (
                    <div className="pb-8 pl-2">
                        {renderTimeline()}
                    </div>
                )}
                
                {!loading && <MonthlySummaryChart />}

            </div>

            {/* Chat Input Area - Fixed Bottom */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-50 to-transparent dark:from-slate-900 pb-6">
                <form onSubmit={handleChatSubmit} className="relative shadow-xl shadow-indigo-500/10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center p-1.5 transition-all focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
                    <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="e.g. 5-6pm Study Cardio..."
                        className="flex-1 bg-transparent border-none focus:ring-0 text-slate-800 dark:text-white text-sm px-3 py-2 placeholder-slate-400 font-medium"
                    />
                    <button 
                        type="submit"
                        disabled={!chatInput.trim()}
                        className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-50 disabled:shadow-none disabled:bg-slate-300 flex items-center justify-center"
                    >
                        <PaperAirplaneIcon className="w-4 h-4 transform rotate-90" />
                    </button>
                </form>
            </div>
        </div>
    );
};