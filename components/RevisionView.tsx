

import React, { useState, useMemo } from 'react';
import { StudySession, getAdjustedDate, KnowledgeBaseEntry } from '../types';
import { ArrowPathIcon, CheckCircleIcon, ChevronRightIcon, BookOpenIcon, BarsArrowUpIcon, BarsArrowDownIcon } from './Icons';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine 
} from 'recharts';
import SessionRow from './SessionRow';
import { PageBadge } from './PageBadge';

interface RevisionViewProps {
  sessions: StudySession[];
  knowledgeBase: KnowledgeBaseEntry[];
  onEditSession: (s: StudySession) => void;
  onLogRevision: (s: StudySession) => void;
  onDeleteSession: (id: string) => void;
  onViewPage: (page: string) => void;
}

type SortOption = 'TIME' | 'PAGE' | 'TOPIC' | 'SYSTEM';
type SortOrder = 'ASC' | 'DESC';

const RevisionView: React.FC<RevisionViewProps> = ({ sessions, knowledgeBase, onEditSession, onLogRevision, onDeleteSession, onViewPage }) => {
  const [activeTab, setActiveTab] = useState<'DUE' | 'UPCOMING' | 'HISTORY'>('DUE');
  const [sortBy, setSortBy] = useState<SortOption>('TIME');
  const [sortOrder, setSortOrder] = useState<SortOrder>('ASC');

  // --- METRICS CALCULATION ---
  const now = new Date();

  // Total Historical Revisions (Sum of all revision logs across all sessions)
  const totalRevisionsCount = useMemo(() => {
      return sessions.reduce((acc, s) => acc + s.history.filter(h => h.type === 'REVISION').length, 0);
  }, [sessions]);

  // Base Lists (Unsorted)
  const rawDueSessions = useMemo(() => {
      return sessions.filter(s => s.nextRevisionDate && new Date(s.nextRevisionDate) <= now);
  }, [sessions, now]);

  const rawUpcomingSessions = useMemo(() => {
      return sessions.filter(s => s.nextRevisionDate && new Date(s.nextRevisionDate) > now);
  }, [sessions, now]);

  const rawHistoryLogs = useMemo(() => {
      return sessions.flatMap(s => 
          s.history
            .filter(h => h.type === 'REVISION')
            .map(h => ({ 
                ...h, 
                topic: s.topic, 
                pageNumber: s.pageNumber, 
                system: s.system, 
                category: s.category 
            }))
      );
  }, [sessions]);

  // --- SORTING LOGIC ---
  const sortSessions = (list: StudySession[]) => {
      return [...list].sort((a, b) => {
          let cmp = 0;
          switch (sortBy) {
              case 'TIME':
                  // Default for sessions is Next Revision Date
                  cmp = (new Date(a.nextRevisionDate!).getTime() || 0) - (new Date(b.nextRevisionDate!).getTime() || 0);
                  break;
              case 'PAGE':
                  cmp = a.pageNumber.localeCompare(b.pageNumber, undefined, { numeric: true });
                  break;
              case 'TOPIC':
                  cmp = a.topic.localeCompare(b.topic);
                  break;
              case 'SYSTEM':
                  cmp = (a.system || '').localeCompare(b.system || '');
                  break;
          }
          return sortOrder === 'ASC' ? cmp : -cmp;
      });
  };

  const sortHistory = (list: typeof rawHistoryLogs) => {
      return [...list].sort((a, b) => {
          let cmp = 0;
          switch (sortBy) {
              case 'TIME':
                  // Default for history is Log Start Time
                  cmp = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
                  break;
              case 'PAGE':
                  cmp = a.pageNumber.localeCompare(b.pageNumber, undefined, { numeric: true });
                  break;
              case 'TOPIC':
                  cmp = a.topic.localeCompare(b.topic);
                  break;
              case 'SYSTEM':
                  cmp = (a.system || '').localeCompare(b.system || '');
                  break;
          }
          return sortOrder === 'ASC' ? cmp : -cmp;
      });
  };

  const dueSessions = useMemo(() => sortSessions(rawDueSessions), [rawDueSessions, sortBy, sortOrder]);
  const upcomingSessions = useMemo(() => sortSessions(rawUpcomingSessions), [rawUpcomingSessions, sortBy, sortOrder]);
  const historyLogs = useMemo(() => sortHistory(rawHistoryLogs), [rawHistoryLogs, sortBy, sortOrder]);

  // Current Page Due (First in the due list)
  const currentPageDue = useMemo(() => {
      const sortedByTime = [...rawDueSessions].sort((a,b) => new Date(a.nextRevisionDate!).getTime() - new Date(b.nextRevisionDate!).getTime());
      return sortedByTime.length > 0 ? sortedByTime[0] : null;
  }, [rawDueSessions]);

  // --- DYNAMIC GRAPH DATA GENERATION ---
  const graphData = useMemo(() => {
      if (sessions.length === 0) return [];

      // 1. Find Min Date (Earliest Log)
      let minTime = new Date().getTime();
      sessions.forEach(s => {
          s.history.forEach(h => {
              const t = new Date(h.startTime).getTime();
              if (t < minTime) minTime = t;
          });
      });

      // 2. Find Max Date (Latest Due)
      let maxTime = new Date().getTime() + (14 * 24 * 60 * 60 * 1000); // Default at least T+14
      sessions.forEach(s => {
          if (s.nextRevisionDate) {
              const t = new Date(s.nextRevisionDate).getTime();
              if (t > maxTime) maxTime = t;
          }
      });

      // Buffer dates slightly
      const startDate = new Date(minTime);
      startDate.setDate(startDate.getDate() - 1);
      const endDate = new Date(maxTime);
      
      // Normalize to midnight
      startDate.setHours(0,0,0,0);
      endDate.setHours(0,0,0,0);

      const data = [];
      const iter = new Date(startDate);
      const todayStr = getAdjustedDate(new Date());

      while (iter <= endDate) {
          const dateStr = getAdjustedDate(iter);
          
          let count = 0;
          let type = 'future';

          // Logic:
          // Past: Revisions completed on that day
          // Today: Revisions due today (rawDueSessions)
          // Future: Revisions due on that day

          const iterMidnight = new Date(iter);
          iterMidnight.setHours(0,0,0,0);
          const todayMidnight = new Date();
          todayMidnight.setHours(0,0,0,0);

          if (iterMidnight < todayMidnight) {
              type = 'past';
              count = sessions.reduce((acc, s) => {
                  return acc + s.history.filter(h => getAdjustedDate(h.startTime) === dateStr && h.type === 'REVISION').length;
              }, 0);
          } else if (dateStr === todayStr) {
              type = 'today';
              count = rawDueSessions.length;
          } else {
              type = 'future';
              count = sessions.filter(s => {
                  if (!s.nextRevisionDate) return false;
                  return getAdjustedDate(new Date(s.nextRevisionDate)) === dateStr;
              }).length;
          }

          data.push({
              day: iter.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              rawDate: new Date(iter),
              count,
              type
          });

          // Increment day
          iter.setDate(iter.getDate() + 1);
      }
      
      return data;
  }, [sessions, rawDueSessions]);

  // Calculate chart width for scrolling
  const chartWidth = Math.max(1000, graphData.length * 50); // Min 1000px or 50px per bar

  return (
    <div className="animate-fade-in space-y-8">
        
        {/* Header Section with Scrollable Graph */}
        <div className="bg-white dark:bg-dark-surface rounded-2xl border border-slate-200 dark:border-dark-border p-6 shadow-sm">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <ArrowPathIcon className="w-6 h-6 text-primary" />
                        Revision Hub
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Forecast & History</p>
                </div>
                <div className="flex gap-4 text-sm">
                     <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-900/50 text-center hidden sm:block">
                         <span className="block text-xs font-bold text-indigo-400 uppercase">Total Revised</span>
                         <span className="block text-xl font-bold text-indigo-700 dark:text-indigo-300">{totalRevisionsCount}</span>
                     </div>
                     <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-900/50 text-center">
                         <span className="block text-xs font-bold text-amber-400 uppercase">Due Now</span>
                         <span className="block text-xl font-bold text-amber-700 dark:text-amber-400">{rawDueSessions.length}</span>
                     </div>
                </div>
            </div>

            {/* Scrollable Graph Container */}
            <div className="mt-4">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-4">Full Timeline</h3>
                <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
                    <div style={{ width: `${chartWidth}px`, height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={graphData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" strokeOpacity={0.1} />
                                <XAxis 
                                    dataKey="day" 
                                    tick={{ fontSize: 10, fill: '#94a3b8' }} 
                                    axisLine={false} 
                                    tickLine={false} 
                                    interval={0} 
                                    angle={-45}
                                    textAnchor="end"
                                />
                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <Tooltip 
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
                                />
                                <ReferenceLine x={graphData.find(d => d.type === 'today')?.day} stroke="#f59e0b" strokeDasharray="3 3" label="Today" />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={30}>
                                    {graphData.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={
                                                entry.type === 'past' ? '#cbd5e1' : 
                                                entry.type === 'today' ? '#f59e0b' : 
                                                '#6366f1'
                                            } 
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>

        {/* Priority Card */}
        {currentPageDue && (
            <div className="p-4 bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-800 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                        <PageBadge 
                        pageNumber={currentPageDue.pageNumber}
                        revisionCount={currentPageDue.history.filter(h => h.type === 'REVISION').length}
                        attachments={knowledgeBase.find(k => k.pageNumber === currentPageDue.pageNumber)?.attachments}
                        onClick={() => onViewPage(currentPageDue.pageNumber)}
                        />
                    <div>
                        <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-0.5">Priority Revision</p>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">{currentPageDue.topic}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Due since {new Date(currentPageDue.nextRevisionDate!).toLocaleString()}</p>
                    </div>
                </div>
                <button 
                    onClick={() => onLogRevision(currentPageDue)}
                    className="px-4 py-2 bg-amber-500 text-white font-bold rounded-lg shadow-md hover:bg-amber-600 transition-all flex items-center gap-2"
                >
                    Revise Now <ChevronRightIcon className="w-4 h-4" />
                </button>
            </div>
        )}

        {/* Tabs & List */}
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 dark:border-dark-border mb-4 gap-4">
                <div className="flex overflow-x-auto max-w-full">
                    <button 
                        onClick={() => setActiveTab('DUE')}
                        className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'DUE' ? 'border-amber-500 text-amber-600 dark:text-amber-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        Due Now ({rawDueSessions.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('UPCOMING')}
                        className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'UPCOMING' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        Upcoming ({rawUpcomingSessions.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('HISTORY')}
                        className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'HISTORY' ? 'border-green-500 text-green-600 dark:text-green-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        Past Logs
                    </button>
                </div>

                {/* SORT CONTROLS */}
                <div className="flex items-center gap-2 pb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase hidden sm:inline">Sort By:</span>
                    <select 
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                        <option value="TIME">Time / Date</option>
                        <option value="PAGE">Page Number</option>
                        <option value="TOPIC">Alphabetical</option>
                        <option value="SYSTEM">System</option>
                    </select>
                    <button 
                        onClick={() => setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        title={sortOrder === 'ASC' ? "Ascending" : "Descending"}
                    >
                        {sortOrder === 'ASC' ? <BarsArrowDownIcon className="w-4 h-4" /> : <BarsArrowUpIcon className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                {activeTab === 'DUE' && (
                    dueSessions.length > 0 ? (
                        dueSessions.map(session => (
                            <SessionRow 
                                key={session.id}
                                session={session}
                                knowledgeBase={knowledgeBase}
                                onDelete={onDeleteSession}
                                onEdit={onEditSession}
                                onLogRevision={onLogRevision}
                                onViewPage={onViewPage}
                            />
                        ))
                    ) : (
                        <div className="p-8 text-center bg-white dark:bg-dark-surface rounded-xl border border-slate-200 dark:border-dark-border border-dashed">
                            <CheckCircleIcon className="w-10 h-10 text-green-300 dark:text-green-600 mx-auto mb-3" />
                            <p className="text-slate-500 dark:text-slate-400">No revisions due right now. You're all caught up!</p>
                        </div>
                    )
                )}

                {activeTab === 'UPCOMING' && (
                    upcomingSessions.length > 0 ? (
                        upcomingSessions.map(session => (
                            <div key={session.id} className="bg-white dark:bg-dark-surface p-4 rounded-xl border border-slate-200 dark:border-dark-border flex justify-between items-center hover:shadow-sm transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg flex flex-col items-center justify-center border border-indigo-100 dark:border-indigo-900/50">
                                        <span className="text-[10px] font-bold uppercase">Due</span>
                                        <span className="text-sm font-bold">
                                            {new Date(session.nextRevisionDate!).getDate()}
                                        </span>
                                        <span className="text-[8px] font-bold uppercase">
                                            {new Date(session.nextRevisionDate!).toLocaleDateString('en-US', { month: 'short' })}
                                        </span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-slate-200">{session.topic}</h4>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/50 hover:text-indigo-600" onClick={() => onViewPage(session.pageNumber)}>
                                                Pg {session.pageNumber}
                                            </span>
                                            <span>{session.category}</span>
                                            {session.system && <span>• {session.system}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="block text-xs font-bold text-slate-400 uppercase">Due Time</span>
                                    <span className="text-sm font-mono text-slate-600 dark:text-slate-300">
                                        {new Date(session.nextRevisionDate!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-8 text-center bg-white dark:bg-dark-surface rounded-xl border border-slate-200 dark:border-dark-border border-dashed">
                            <p className="text-slate-500 dark:text-slate-400">No upcoming revisions scheduled.</p>
                        </div>
                    )
                )}

                {activeTab === 'HISTORY' && (
                     <div className="bg-white dark:bg-dark-surface rounded-xl border border-slate-200 dark:border-dark-border overflow-hidden">
                         {historyLogs.length > 0 ? (
                             historyLogs
                                .slice(0, 50) // Limit to 50 for performance
                                .map((log, idx) => (
                                    <div key={`${log.id}-${idx}`} className="p-4 border-b border-slate-100 dark:border-slate-700 last:border-0 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-full">
                                                <ArrowPathIcon className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{log.topic}</p>
                                                <div className="flex gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                    <span>{new Date(log.startTime).toLocaleDateString()} {new Date(log.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                                    <span>• {log.durationMinutes} min</span>
                                                    {log.system && <span>• {log.system}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <span 
                                            onClick={() => onViewPage(log.pageNumber)}
                                            className="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-1 rounded cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/50 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                                        >
                                            Pg {log.pageNumber}
                                        </span>
                                    </div>
                                ))
                         ) : (
                             <div className="p-8 text-center">
                                 <p className="text-slate-500 dark:text-slate-400 text-sm">No revision history found.</p>
                             </div>
                         )}
                     </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default RevisionView;
