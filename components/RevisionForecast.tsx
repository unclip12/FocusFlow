import React from 'react';
import { StudySession } from '../types';

interface RevisionForecastProps {
  sessions: StudySession[];
  onSelectDay: (date: Date) => void;
}

const RevisionForecast: React.FC<RevisionForecastProps> = ({ sessions, onSelectDay }) => {
  
  // Get next 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const getDueSessions = (date: Date) => {
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);
    
    return sessions.filter(s => {
      if (!s.nextRevisionDate) return false;
      const dueDate = new Date(s.nextRevisionDate);
      return dueDate >= date && dueDate < nextDay;
    });
  };

  const formatDate = (date: Date, index: number) => {
    if (index === 0) return 'Today';
    if (index === 1) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
  };

  return (
    <div className="mb-8 overflow-hidden">
      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 px-1">Upcoming Revisions</h3>
      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar snap-x">
        {days.map((day, idx) => {
          const due = getDueSessions(day);
          const isToday = idx === 0;
          
          return (
            <div 
              key={idx} 
              onClick={() => onSelectDay(day)}
              className={`snap-start flex-shrink-0 w-40 p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md hover:-translate-y-1 ${
                isToday 
                  ? 'bg-indigo-50 border-indigo-100 shadow-sm' 
                  : 'bg-white border-slate-100'
              }`}
            >
              <div className={`text-sm font-semibold mb-2 ${isToday ? 'text-primary' : 'text-slate-600'}`}>
                {formatDate(day, idx)}
              </div>
              
              {due.length > 0 ? (
                <div className="space-y-2 pointer-events-none">
                  {due.slice(0, 3).map(s => (
                    <div key={s.id} className="bg-white/80 p-2 rounded-md border border-slate-100 shadow-sm text-xs">
                      <span className="font-bold text-slate-700">Pg {s.pageNumber}</span>
                      <span className="block text-slate-500 truncate">{s.topic}</span>
                    </div>
                  ))}
                  {due.length > 3 && (
                    <div className="text-xs text-center text-slate-400 font-medium">
                      + {due.length - 3} more
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-16 flex items-center justify-center text-xs text-slate-300 italic pointer-events-none">
                  No revisions
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RevisionForecast;