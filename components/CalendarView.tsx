
import React, { useState } from 'react';
import { StudySession, StudyPlanItem } from '../types';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from './Icons';

interface CalendarViewProps {
  sessions: StudySession[];
  studyPlan: StudyPlanItem[];
  onSelectDate: (date: Date) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ sessions, studyPlan, onSelectDate }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const monthNames = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
  ];

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getDayData = (day: number) => {
      const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toLocaleDateString('en-CA');
      
      // Check for logs (Completed) - Use local date string matching
      const hasLogs = sessions.some(s => s.history.some(h => new Date(h.date).toLocaleDateString('en-CA') === dateStr));
      
      // Check for Plans (Targets)
      const hasPlan = studyPlan.some(p => p.date === dateStr);
      
      // Check for Revisions Due
      const hasRevision = sessions.some(s => s.nextRevisionDate && new Date(s.nextRevisionDate).toLocaleDateString('en-CA') === dateStr);

      return { hasLogs, hasPlan, hasRevision };
  };

  const isToday = (day: number) => {
      const today = new Date();
      return day === today.getDate() && 
             currentDate.getMonth() === today.getMonth() && 
             currentDate.getFullYear() === today.getFullYear();
  };

  const handleDayClick = (day: number) => {
      const selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      onSelectDate(selectedDate);
  };

  const renderCalendarDays = () => {
    const days = [];
    // Empty cells for days before start of month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 bg-slate-50/20 border border-slate-100/50"></div>);
    }

    // Actual days
    for (let day = 1; day <= daysInMonth; day++) {
      const { hasLogs, hasPlan, hasRevision } = getDayData(day);
      const today = isToday(day);

      days.push(
        <div 
            key={day} 
            onClick={() => handleDayClick(day)}
            className={`relative h-24 border border-slate-100 p-2 cursor-pointer transition-all group hover:shadow-md ${today ? 'bg-indigo-50/60 ring-1 ring-indigo-200' : 'bg-white hover:bg-slate-50'}`}
        >
          <div className={`text-sm font-medium w-8 h-8 flex items-center justify-center rounded-full transition-transform ${today ? 'bg-primary text-white shadow-lg shadow-indigo-300 scale-110 font-bold' : 'text-slate-700 group-hover:font-bold group-hover:scale-105'}`}>
            {day}
          </div>
          
          {/* Indicators container */}
          <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-1.5">
              {hasPlan && (
                  <div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm ring-1 ring-blue-200" title="Planned Targets"></div>
              )}
              {hasLogs && (
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm ring-1 ring-green-200" title="Completed Sessions"></div>
              )}
              {hasRevision && (
                  <div className="w-2 h-2 rounded-full bg-amber-500 shadow-sm ring-1 ring-amber-200" title="Revisions Due"></div>
              )}
          </div>
        </div>
      );
    }
    return days;
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
         <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-100 text-primary rounded-lg shadow-sm">
                 <CalendarIcon className="w-6 h-6" />
             </div>
             <div>
                <h2 className="text-2xl font-bold text-slate-800">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
                <p className="text-xs text-slate-500 font-medium">Select a date to view details</p>
             </div>
         </div>
         <div className="flex gap-2">
             <button onClick={prevMonth} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors">
                 <ChevronLeftIcon className="w-5 h-5" />
             </button>
             <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-bold text-slate-600 transition-colors">
                 Today
             </button>
             <button onClick={nextMonth} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors">
                 <ChevronRightIcon className="w-5 h-5" />
             </button>
         </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Weekday Header */}
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {d}
                  </div>
              ))}
          </div>
          
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 bg-slate-50">
              {renderCalendarDays()}
          </div>
      </div>
      
      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 justify-center text-xs text-slate-500 font-medium bg-white p-3 rounded-lg border border-slate-100 shadow-sm max-w-fit mx-auto">
          <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-1 ring-blue-200"></div>
              <span>Study Target</span>
          </div>
          <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 ring-1 ring-green-200"></div>
              <span>Session Logged</span>
          </div>
          <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-1 ring-amber-200"></div>
              <span>Revision Due</span>
          </div>
          <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] shadow-md shadow-indigo-200">31</div>
              <span>Current Day</span>
          </div>
      </div>
    </div>
  );
};
