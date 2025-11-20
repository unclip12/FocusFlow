import React, { useMemo } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { StudySession, StudyPlanItem, getAdjustedDate } from '../types';
import { ClockIcon, BookOpenIcon, FireIcon, CheckCircleIcon, ChartBarIcon, HistoryIcon, ChevronRightIcon } from './Icons';

interface StatsCardProps {
  sessions: StudySession[];
  studyPlan?: StudyPlanItem[];
  onNavigateToPlanner: () => void;
  onViewAllPages: () => void;
  onNavigateToRevision: () => void;
}

const COLORS = {
  amber: '#f59e0b',
  green: '#10b981',
  blue: '#3b82f6',
  slate: '#94a3b8',
  indigo: '#6366f1',
  purple: '#8b5cf6',
  pink: '#ec4899'
};

const CircularProgress = ({ value, total, label, color, icon }: { value: number, total: number, label: string, color: string, icon: React.ReactNode }) => {
    const percentage = total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0;
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="flex flex-col items-center transform scale-90 sm:scale-100">
            <div className="relative w-24 h-24 flex items-center justify-center">
                {/* Background Circle */}
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                    <circle
                        cx="40"
                        cy="40"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        className="text-slate-100 dark:text-slate-700"
                    />
                    {/* Progress Circle */}
                    <circle
                        cx="40"
                        cy="40"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className={`${color} transition-all duration-1000 ease-out`}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className={`mb-1 ${color.replace('text-', 'text-opacity-80 ')}`}>{icon}</div>
                    <span className="text-lg font-bold text-slate-700 dark:text-slate-200 leading-none">{value}</span>
                    <span className="text-[10px] text-slate-400 font-medium">/ {total}</span>
                </div>
            </div>
            <span className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</span>
        </div>
    );
};

const StatsCard: React.FC<StatsCardProps> = ({ sessions, studyPlan = [], onNavigateToPlanner, onViewAllPages, onNavigateToRevision }) => {
  
  // 1. Knowledge State Data (Pie Chart)
  const statusData = useMemo(() => {
    const dueNow = sessions.filter(s => s.nextRevisionDate && new Date(s.nextRevisionDate) <= new Date()).length;
    const mastered = sessions.filter(s => !s.nextRevisionDate && s.currentIntervalIndex > 0).length;
    const learning = sessions.filter(s => s.nextRevisionDate && new Date(s.nextRevisionDate) > new Date()).length;
    const ankiPending = sessions.filter(s => !s.ankiDone).length;

    const result = [
      { name: 'Due', value: dueNow, color: COLORS.amber },
      { name: 'Mastered', value: mastered, color: COLORS.green },
      { name: 'Learning', value: learning, color: COLORS.blue },
      { name: 'Pending Cards', value: ankiPending, color: COLORS.slate },
    ];
    return result.filter(item => item.value > 0);
  }, [sessions]);

  // 2. Daily Activity Data (Bar Chart - Last 7 Days)
  const dailyActivityData = useMemo(() => {
    const today = new Date();
    // Create array of last 7 dates
    const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - 6 + i);
        return d;
    });

    return last7Days.map(date => {
        const dateStr = date.toISOString().split('T')[0];
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        
        let minutes = 0;
        sessions.forEach(s => {
            s.history.forEach(h => {
                if (h.date.startsWith(dateStr)) {
                    minutes += h.durationMinutes;
                }
            });
        });

        return {
            day: dayName,
            hours: parseFloat((minutes / 60).toFixed(1))
        };
    });
  }, [sessions]);

  // 3. Subject Breakdown (Bar Chart - Top 5)
  const subjectData = useMemo(() => {
    const map = new Map<string, number>();
    sessions.forEach(s => {
        const totalMin = s.history.reduce((acc, h) => acc + h.durationMinutes, 0);
        const cat = s.category || 'Other';
        map.set(cat, (map.get(cat) || 0) + totalMin);
    });

    return Array.from(map.entries())
        .map(([name, min]) => ({ name, hours: parseFloat((min / 60).toFixed(1)) }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 5);
  }, [sessions]);

  // 4. Daily Planner Stats Logic
  const todayStr = getAdjustedDate(new Date());
  
  const todaysTargets = useMemo(() => {
      return studyPlan.filter(p => {
          if (p.isCompleted && p.date < todayStr) return false; 
          if (p.date === todayStr) return true; 
          if (p.date < todayStr && !p.isCompleted) return true; 
          return false;
      });
  }, [studyPlan, todayStr]);

  const dailyStats = useMemo(() => {
      let totalAnki = 0;
      let completedAnki = 0;
      
      todaysTargets.forEach(item => {
          if (item.ankiCount && item.ankiCount > 0) {
              totalAnki += item.ankiCount;
              const session = sessions.find(s => s.pageNumber === item.pageNumber);
              if (session && session.ankiCovered) {
                  completedAnki += session.ankiCovered;
              }
          }
      });

      const pageItems = todaysTargets.filter(p => p.type === 'PAGE');
      const totalPages = pageItems.length;
      const completedPages = pageItems.filter(p => p.isCompleted).length;

      const revisionsDoneToday = sessions.reduce((count, s) => {
          const doneToday = s.history.filter(h => 
              getAdjustedDate(h.startTime) === todayStr && h.type === 'REVISION'
          ).length;
          return count + doneToday;
      }, 0);

      const revisionsDue = sessions.filter(s => 
          s.nextRevisionDate && new Date(s.nextRevisionDate).toLocaleDateString('en-CA') <= todayStr
      );
      const revisionsPending = revisionsDue.length;
      const totalRevision = revisionsDoneToday + revisionsPending;

      return {
          anki: { current: completedAnki, total: totalAnki },
          pages: { current: completedPages, total: totalPages },
          revision: { current: revisionsDoneToday, total: totalRevision }
      };
  }, [todaysTargets, sessions, todayStr]);

  // Total Summary Metrics
  const totalHours = useMemo(() => {
    return sessions.reduce((acc, curr) => {
        const sessionTotal = curr.history.reduce((hAcc, log) => hAcc + log.durationMinutes, 0);
        return acc + sessionTotal;
    }, 0) / 60;
  }, [sessions]);

  const dueCount = sessions.filter(s => s.nextRevisionDate && new Date(s.nextRevisionDate) <= new Date()).length;
  const masteredCount = sessions.filter(s => !s.nextRevisionDate && s.currentIntervalIndex > 0).length;

  return (
    <div className="space-y-6 mb-8 animate-fade-in">
      
      {/* Summary Metrics Row - Optimized for iPad/Tablet (md:grid-cols-4) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div 
            onClick={onViewAllPages}
            className="bg-white dark:bg-dark-surface p-3 sm:p-4 rounded-xl border border-slate-100 dark:border-dark-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 cursor-pointer hover:shadow-md hover:border-indigo-100 dark:hover:border-primary/30 transition-all group"
            title="View all studied pages"
        >
            <div className="p-2 sm:p-3 bg-indigo-50 dark:bg-primary/10 text-primary rounded-lg group-hover:bg-indigo-100 dark:group-hover:bg-primary/20 transition-colors">
                <BookOpenIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
                <p className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs font-bold uppercase group-hover:text-primary">Total Pages</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">{sessions.length}</p>
            </div>
        </div>
        <div className="bg-white dark:bg-dark-surface p-3 sm:p-4 rounded-xl border border-slate-100 dark:border-dark-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
            <div className="p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                <ClockIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
                <p className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs font-bold uppercase">Study Time</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">{totalHours.toFixed(1)}h</p>
            </div>
        </div>
        <div 
            onClick={onNavigateToRevision}
            className="bg-white dark:bg-dark-surface p-3 sm:p-4 rounded-xl border border-slate-100 dark:border-dark-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 cursor-pointer hover:shadow-md hover:border-amber-200 dark:hover:border-amber-900/30 transition-all group"
            title="Go to Revision Hub"
        >
            <div className="p-2 sm:p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg group-hover:bg-amber-100 dark:group-hover:bg-amber-900/40 transition-colors">
                <FireIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
                <p className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs font-bold uppercase group-hover:text-amber-600 dark:group-hover:text-amber-400">Due Now</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">{dueCount}</p>
            </div>
        </div>
        <div className="bg-white dark:bg-dark-surface p-3 sm:p-4 rounded-xl border border-slate-100 dark:border-dark-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
            <div className="p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg">
                <CheckCircleIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
                <p className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs font-bold uppercase">Mastered</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">{masteredCount}</p>
            </div>
        </div>
      </div>

      {/* Daily Planner Statistics (New Section) */}
      <div 
        onClick={onNavigateToPlanner}
        className="bg-white dark:bg-dark-surface rounded-2xl border border-slate-200 dark:border-dark-border p-4 sm:p-6 shadow-sm cursor-pointer transition-all group relative overflow-hidden hover:border-primary/50 hover:shadow-md active:scale-[0.99]"
      >
          <div className="absolute top-0 left-0 w-1 h-full bg-primary/0 group-hover:bg-primary transition-colors"></div>
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-dark-border pb-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-primary transition-colors">Daily Progress ({todayStr})</h3>
              <span className="text-xs text-primary font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  Go to Planner <ChevronRightIcon className="w-3 h-3" />
              </span>
          </div>
          <div className="flex flex-wrap justify-around items-center gap-4 sm:gap-6">
              <CircularProgress 
                  label="Anki Cards" 
                  value={dailyStats.anki.current} 
                  total={dailyStats.anki.total} 
                  color="text-blue-500"
                  icon={<FireIcon className="w-4 h-4" />}
              />
              <CircularProgress 
                  label="Pages Done" 
                  value={dailyStats.pages.current} 
                  total={dailyStats.pages.total} 
                  color="text-indigo-500 dark:text-indigo-400"
                  icon={<BookOpenIcon className="w-4 h-4" />}
              />
              <CircularProgress 
                  label="Revisions" 
                  value={dailyStats.revision.current} 
                  total={dailyStats.revision.total} 
                  color="text-amber-500"
                  icon={<HistoryIcon className="w-4 h-4" />}
              />
          </div>
      </div>

      {/* Charts Area - Optimized for iPad (lg:grid-cols-2 for side-by-side only on larger screens, stacked on portrait) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Daily Activity */}
        <div className="bg-white dark:bg-dark-surface p-4 sm:p-6 rounded-2xl border border-slate-100 dark:border-dark-border shadow-sm flex flex-col overflow-hidden">
           <div className="flex items-center gap-2 mb-6">
                <ChartBarIcon className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                <h3 className="font-bold text-slate-800 dark:text-white text-sm sm:text-base">Study Activity (7 Days)</h3>
           </div>
           <div className="flex-1 min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={dailyActivityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.2} />
                    <XAxis 
                        dataKey="day" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#94a3b8' }} 
                        dy={10}
                    />
                    <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                    />
                    <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="hours" fill={COLORS.indigo} radius={[4, 4, 0, 0]} barSize={20} />
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Chart 2: Knowledge Distribution */}
        <div className="bg-white dark:bg-dark-surface p-4 sm:p-6 rounded-2xl border border-slate-100 dark:border-dark-border shadow-sm flex flex-col overflow-hidden">
           <div className="flex items-center gap-2 mb-6">
                <FireIcon className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-800 dark:text-white text-sm sm:text-base">Knowledge Status</h3>
           </div>
           <div className="flex-1 min-h-[250px]">
             {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={statusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={5}
                            dataKey="value"
                        >
                        {statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                </ResponsiveContainer>
             ) : (
                <div className="h-full flex items-center justify-center text-slate-400 italic">No data available</div>
             )}
           </div>
        </div>
      </div>

      {/* Chart 3: Topic Distribution (Horizontal Bar) */}
      <div className="bg-white dark:bg-dark-surface p-4 sm:p-6 rounded-2xl border border-slate-100 dark:border-dark-border shadow-sm overflow-hidden">
         <div className="flex items-center gap-2 mb-6">
            <BookOpenIcon className="w-5 h-5 text-purple-500" />
            <h3 className="font-bold text-slate-800 dark:text-white text-sm sm:text-base">Top Subjects by Hours</h3>
         </div>
         <div className="h-64">
             {subjectData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={subjectData} margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#94a3b8" strokeOpacity={0.2} />
                        <XAxis type="number" hide />
                        <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={90} 
                            tick={{ fontSize: 10, fill: '#94a3b8' }} 
                            axisLine={false} 
                            tickLine={false}
                        />
                        <Tooltip 
                             cursor={{ fill: '#f8fafc' }}
                             contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="hours" fill={COLORS.purple} radius={[0, 4, 4, 0]} barSize={15} background={{ fill: 'transparent' }} />
                    </BarChart>
                </ResponsiveContainer>
             ) : (
                <div className="h-full flex items-center justify-center text-slate-400 italic">Start studying to see subject breakdowns</div>
             )}
         </div>
      </div>

    </div>
  );
};

export default StatsCard;