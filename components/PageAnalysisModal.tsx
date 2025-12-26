
import React, { useState, useMemo, useEffect } from 'react';
import { StudySession, getAdjustedDate, KnowledgeBaseEntry } from '../types';
import { 
    BookOpenIcon, ChevronLeftIcon, ClockIcon, FireIcon, 
    HistoryIcon, ChartBarIcon, PaperClipIcon, PhotoIcon, DocumentIcon,
    BarsArrowUpIcon, BarsArrowDownIcon
} from './Icons';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { PageBadge } from './PageBadge';

interface PageAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    sessions: StudySession[];
    knowledgeBase?: KnowledgeBaseEntry[];
    onViewPage?: (page: string) => void;
}

type SortOption = 'PAGE' | 'TOPIC' | 'REVISIONS' | 'TIME_SPENT' | 'SYSTEM';
type SortOrder = 'ASC' | 'DESC';

const PageAnalysisModal: React.FC<PageAnalysisModalProps> = ({ isOpen, onClose, sessions, knowledgeBase = [], onViewPage }) => {
    const [selectedSession, setSelectedSession] = useState<StudySession | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Sorting State
    const [sortBy, setSortBy] = useState<SortOption>('PAGE');
    const [sortOrder, setSortOrder] = useState<SortOrder>('ASC');

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

    // --- LIST VIEW LOGIC ---
    const filteredSessions = useMemo(() => {
        let result = sessions.filter(s => 
            s.topic.toLowerCase().includes(searchTerm.toLowerCase()) || 
            s.pageNumber.includes(searchTerm)
        );

        // Sorting logic
        result.sort((a, b) => {
            let cmp = 0;
            switch (sortBy) {
                case 'PAGE':
                    // Numeric sort for page numbers
                    const numA = parseInt(a.pageNumber);
                    const numB = parseInt(b.pageNumber);
                    if (!isNaN(numA) && !isNaN(numB)) {
                        cmp = numA - numB;
                    } else {
                        cmp = a.pageNumber.localeCompare(b.pageNumber, undefined, { numeric: true });
                    }
                    break;
                case 'TOPIC':
                    cmp = a.topic.localeCompare(b.topic);
                    break;
                case 'REVISIONS':
                    const revA = knowledgeBase.find(k => k.pageNumber === a.pageNumber)?.revisionCount || 0;
                    const revB = knowledgeBase.find(k => k.pageNumber === b.pageNumber)?.revisionCount || 0;
                    cmp = revA - revB;
                    break;
                case 'TIME_SPENT':
                    const timeA = a.history.reduce((acc, h) => acc + h.durationMinutes, 0);
                    const timeB = b.history.reduce((acc, h) => acc + h.durationMinutes, 0);
                    cmp = timeA - timeB;
                    break;
                case 'SYSTEM':
                    cmp = (a.system || '').localeCompare(b.system || '');
                    break;
            }
            return sortOrder === 'ASC' ? cmp : -cmp;
        });

        return result;
    }, [sessions, searchTerm, sortBy, sortOrder, knowledgeBase]);

    // --- DETAIL VIEW LOGIC ---
    const chartData = useMemo(() => {
        if (!selectedSession) return [];
        
        // Clone and reverse to get chronological order (assuming history is stored newest-first)
        const chronologicalHistory = [...selectedSession.history].reverse();
        
        return chronologicalHistory.map((log, index) => ({
            attempt: index + 1,
            date: new Date(log.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            duration: log.durationMinutes,
            type: log.type
        }));
    }, [selectedSession]);

    const toggleSortOrder = () => {
        setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col border border-slate-100 dark:border-slate-700 overflow-hidden animate-fade-in-up">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-between items-center flex-shrink-0">
                    <div className="flex items-center gap-3">
                        {selectedSession ? (
                            <button 
                                onClick={() => setSelectedSession(null)}
                                className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-all text-slate-500 dark:text-slate-400"
                            >
                                <ChevronLeftIcon className="w-5 h-5" />
                            </button>
                        ) : (
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 text-primary rounded-lg">
                                <BookOpenIcon className="w-5 h-5" />
                            </div>
                        )}
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                                {selectedSession ? selectedSession.topic : 'All Studied Pages'}
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {selectedSession ? `Page ${selectedSession.pageNumber} • ${selectedSession.category}` : `${sessions.length} Unique Pages Tracked`}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-xl px-2">&times;</button>
                </div>

                {/* CONTENT AREA */}
                <div className="flex-1 overflow-hidden flex">
                    
                    {/* MODE 1: LIST VIEW */}
                    {!selectedSession && (
                        <div className="flex-1 flex flex-col bg-slate-50/30 dark:bg-slate-900/50">
                            {/* Controls Bar */}
                            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
                                <input 
                                    type="text" 
                                    placeholder="Search pages or topics..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full md:w-auto flex-grow p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-600 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 transition-all outline-none text-sm"
                                />
                                
                                <div className="flex gap-2 items-center w-full md:w-auto">
                                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase whitespace-nowrap">Sort By:</span>
                                    <select 
                                        value={sortBy}
                                        onChange={e => setSortBy(e.target.value as SortOption)}
                                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium cursor-pointer outline-none focus:border-primary"
                                    >
                                        <option value="PAGE">Page Number</option>
                                        <option value="TOPIC">Topic Name</option>
                                        <option value="REVISIONS">Revision Count</option>
                                        <option value="TIME_SPENT">Total Time Spent</option>
                                        <option value="SYSTEM">System</option>
                                    </select>
                                    <button 
                                        onClick={toggleSortOrder}
                                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                                    >
                                        {sortOrder === 'ASC' ? <BarsArrowDownIcon className="w-4 h-4" /> : <BarsArrowUpIcon className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredSessions.map(session => {
                                        const kbEntry = knowledgeBase.find(k => k.pageNumber === session.pageNumber);
                                        const totalRevisions = kbEntry?.revisionCount || 0;
                                        const totalTime = session.history.reduce((acc, h) => acc + h.durationMinutes, 0);
                                        
                                        return (
                                            <div 
                                                key={session.id} 
                                                className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group relative cursor-pointer"
                                                onClick={() => setSelectedSession(session)}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <PageBadge 
                                                        pageNumber={session.pageNumber}
                                                        attachments={kbEntry?.attachments}
                                                        revisionCount={totalRevisions}
                                                        onClick={() => onViewPage && onViewPage(session.pageNumber)}
                                                    />
                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 border border-slate-100 dark:border-slate-700 px-2 py-0.5 rounded">{session.system || 'General'}</span>
                                                </div>
                                                <h3 className="font-bold text-slate-800 dark:text-white mb-3 truncate mt-1 group-hover:text-primary">{session.topic}</h3>
                                                
                                                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-50 dark:border-slate-700 pt-3">
                                                    <div className="flex items-center gap-1">
                                                        <HistoryIcon className="w-3 h-3" />
                                                        <span className="font-medium">{totalRevisions}</span> revs
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <ClockIcon className="w-3 h-3" />
                                                        <span className="font-medium">{totalTime}</span> min
                                                    </div>
                                                    {session.ankiTotal && (
                                                        <div className="flex items-center gap-1 text-amber-500 dark:text-amber-400 ml-auto">
                                                            <FireIcon className="w-3 h-3" />
                                                            <span className="font-bold">{session.ankiCovered}/{session.ankiTotal}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {filteredSessions.length === 0 && (
                                        <div className="col-span-full text-center py-12 text-slate-400 dark:text-slate-500 italic">
                                            No pages found. Try a different search.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MODE 2: DETAIL VIEW */}
                    {selectedSession && (
                        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-white dark:bg-slate-900">
                            
                            {/* LEFT: Graphs & Stats */}
                            <div className="flex-1 overflow-y-auto p-6 border-r border-slate-100 dark:border-slate-700 space-y-8">
                                
                                {/* Overview Cards */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50 text-center">
                                        <p className="text-xs text-blue-500 dark:text-blue-400 font-bold uppercase mb-1">Total Time</p>
                                        <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                                            {selectedSession.history.reduce((acc, h) => acc + h.durationMinutes, 0)}m
                                        </p>
                                    </div>
                                    <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/50 text-center">
                                        <p className="text-xs text-amber-500 dark:text-amber-400 font-bold uppercase mb-1">Revisions</p>
                                        <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
                                            {knowledgeBase.find(k => k.pageNumber === selectedSession.pageNumber)?.revisionCount || 0}
                                        </p>
                                    </div>
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 text-center">
                                        <p className="text-xs text-indigo-500 dark:text-indigo-400 font-bold uppercase mb-1">Last Studied</p>
                                        <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300 pt-1">
                                            {new Date(selectedSession.lastStudied).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>

                                {/* GRAPH AREA */}
                                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                                    <div className="flex items-center gap-2 mb-6">
                                        <ChartBarIcon className="w-5 h-5 text-primary" />
                                        <h3 className="font-bold text-slate-800 dark:text-white">Revision Duration Trend</h3>
                                    </div>
                                    <div className="h-64 w-full">
                                        <ResponsiveContainer width="100%" height="100%" minHeight={100}>
                                            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" strokeOpacity={0.1} />
                                                <XAxis 
                                                    dataKey="attempt" 
                                                    label={{ value: 'Attempt #', position: 'insideBottomRight', offset: -5, fontSize: 10, fill: '#94a3b8' }}
                                                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                                                    axisLine={{ stroke: '#334155', strokeOpacity: 0.2 }}
                                                />
                                                <YAxis 
                                                    label={{ value: 'Mins', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8' }} 
                                                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                                                    axisLine={{ stroke: '#334155', strokeOpacity: 0.2 }}
                                                />
                                                <Tooltip 
                                                    labelFormatter={(val) => `Attempt ${val}`}
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                />
                                                <Legend />
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="duration" 
                                                    stroke="#4f46e5" 
                                                    strokeWidth={3} 
                                                    dot={{ r: 4, fill: '#4f46e5' }} 
                                                    activeDot={{ r: 6 }}
                                                    name="Duration (Minutes)"
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <p className="text-xs text-slate-400 text-center mt-2 italic">
                                        Ideally, revision time should decrease over attempts as mastery increases.
                                    </p>
                                </div>

                                {/* Topics / Notes Area (Aggregated) */}
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                                    <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2 text-sm">Persistent Topic Notes</h4>
                                    <div className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                                        {selectedSession.notes || "No main notes added for this page."}
                                    </div>
                                </div>

                            </div>

                            {/* RIGHT: History List */}
                            <div className="w-full lg:w-96 bg-slate-50 dark:bg-slate-800 overflow-y-auto border-l border-slate-100 dark:border-slate-700 flex flex-col">
                                <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-10">
                                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        <HistoryIcon className="w-4 h-4 text-slate-400" />
                                        Revision History
                                    </h3>
                                </div>
                                <div className="p-4 space-y-4">
                                    {selectedSession.history.map((log, idx) => (
                                        <div key={log.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded uppercase">
                                                    {log.type === 'INITIAL' ? 'First Study' : `Revision #${selectedSession.history.length - idx - 1}`}
                                                </span>
                                                <span className="text-xs text-slate-400">
                                                    {new Date(log.date).toLocaleDateString()}
                                                </span>
                                            </div>
                                            
                                            <div className="flex items-center gap-2 mb-3">
                                                <ClockIcon className="w-4 h-4 text-indigo-500" />
                                                <span className="font-bold text-slate-700 dark:text-slate-300">{log.durationMinutes} minutes</span>
                                            </div>

                                            {log.notes && (
                                                <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700 italic mb-3">
                                                    "{log.notes}"
                                                </div>
                                            )}

                                            {/* Attachments Display */}
                                            {log.attachments && log.attachments.length > 0 && (
                                                <div className="border-t border-slate-100 dark:border-slate-700 pt-2 mt-2">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                                                        <PaperClipIcon className="w-3 h-3" /> Attachments
                                                    </p>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {log.attachments.map(att => (
                                                            <div key={att.id} className="relative group cursor-pointer" title={att.name}>
                                                                {att.type === 'IMAGE' ? (
                                                                    <div className="aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                                                                        <img src={att.data} alt={att.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                                    </div>
                                                                ) : (
                                                                    <div className="aspect-square rounded-lg border border-slate-200 dark:border-slate-700 bg-red-50 dark:bg-red-900/10 flex items-center justify-center text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                                                                        <DocumentIcon className="w-6 h-6" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default PageAnalysisModal;
