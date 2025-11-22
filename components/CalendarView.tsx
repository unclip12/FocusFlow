import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { StudySession, StudyPlanItem, getAdjustedDate, VideoResource, Attachment, KnowledgeBaseEntry } from '../types';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, CheckCircleIcon, ClockIcon, FireIcon, ListCheckIcon, PlusIcon, XMarkIcon, SparklesIcon } from './Icons';

interface CalendarViewProps {
  knowledgeBase: KnowledgeBaseEntry[];
  studyPlan: StudyPlanItem[];
  onAddToPlan: (item: Omit<StudyPlanItem, 'id'>, newVideo?: VideoResource, attachments?: Attachment[]) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ knowledgeBase, studyPlan, onAddToPlan }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'MONTH' | 'DAY'>('MONTH'); // Toggle right panel view

  // --- QUICK ADD STATE ---
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskType, setTaskType] = useState<'PAGE' | 'VIDEO' | 'HYBRID'>('HYBRID');
  const [taskTime, setTaskTime] = useState('');
  const [taskNotes, setTaskNotes] = useState('');

  // --- HELPERS ---
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
    return { days, firstDay, year, month };
  };

  const { days, firstDay, year, month } = getDaysInMonth(currentMonth);

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));
  
  const isSameDay = (d1: Date, d2: Date) => 
    d1.getDate() === d2.getDate() && 
    d1.getMonth() === d2.getMonth() && 
    d1.getFullYear() === d2.getFullYear();

  // Get data for a specific date
  const getDayData = (date: Date) => {
    const dateStr = getAdjustedDate(date);
    const plans = studyPlan.filter(p => p.date === dateStr);
    
    const logs = new Set<string>(); // Use set to count unique pages logged
    knowledgeBase.forEach(kb => {
        if (kb.logs.some(l => getAdjustedDate(l.timestamp) === dateStr)) {
            logs.add(kb.pageNumber);
        }
    });

    const revisions = knowledgeBase.filter(kb => kb.nextRevisionAt && getAdjustedDate(new Date(kb.nextRevisionAt)) === dateStr);
    
    return { plans, logs: { size: logs.size }, revisions, hasAny: plans.length > 0 || logs.size > 0 || revisions.length > 0 };
  };

  const monthEvents = useMemo(() => {
    // FIX: Changed `type` to `eventType` to avoid conflict with StudyPlanItem's `type` property.
    const events: { date: Date, eventType: 'PLAN' | 'REVISION', title: string, subtitle: string, id: string }[] = [];
    
    // Plans
    studyPlan.forEach(p => {
        const planDate = new Date(p.date + 'T12:00:00');
        if (planDate.getFullYear() === year && planDate.getMonth() === month) {
            events.push({
                date: planDate,
                eventType: 'PLAN',
                title: p.topic,
                subtitle: `Page ${p.pageNumber} • ${p.type}`,
                id: p.id
            });
        }
    });

    // Revisions
    knowledgeBase.forEach(kb => {
        if (kb.nextRevisionAt) {
            const revisionDate = new Date(kb.nextRevisionAt);
            if (revisionDate.getFullYear() === year && revisionDate.getMonth() === month) {
                 events.push({
                    date: revisionDate,
                    eventType: 'REVISION',
                    title: `Revise: ${kb.title}`,
                    subtitle: `Due: Page ${kb.pageNumber}`,
                    id: kb.pageNumber
                });
            }
        }
    });

    events.sort((a,b) => a.date.getTime() - b.date.getTime());
    return events;
}, [currentMonth, studyPlan, knowledgeBase, year, month]);

  // Handle Date Click
  const handleDateClick = (date: Date) => {
      setSelectedDate(date);
      // If user clicks a date, we switch to Day View in the right panel to show details
      setViewMode('DAY');
  };

  // Handle Plan Item Click
  const handlePlanItemClick = (date: Date) => {
      setSelectedDate(date);
      // Maybe keep it in Month view but highlight? Or switch to Day?
      // Requirement: "Select that date in the calendar grid"
      setViewMode('DAY'); 
  };

  // --- RENDER HELPERS ---
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthName = currentMonth.toLocaleString('default', { month: 'long' });

  // Save Task Logic
  const handleSaveQuickTask = (e: React.FormEvent) => {
      e.preventDefault();
      if (!taskTitle.trim()) return;

      const finalTitle = taskTime.trim() ? `${taskTime} - ${taskTitle}` : taskTitle;
      const subTasks = taskNotes.trim() ? [{ id: Date.now().toString(), text: taskNotes, done: false }] : [];

      onAddToPlan({
          date: getAdjustedDate(selectedDate),
          type: taskType,
          pageNumber: 'General',
          topic: finalTitle,
          estimatedMinutes: 60,
          isCompleted: false,
          subTasks: subTasks,
          logs: [],
          totalMinutesSpent: 0
      });
      setIsQuickAddOpen(false);
  };

  // Right Panel Content
  const renderRightPanel = () => {
      const dateStr = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      const { plans, revisions } = getDayData(selectedDate);
      
      // FIX: Changed `type` to `eventType` to avoid conflict with StudyPlanItem's `type` property.
      const dayEvents = [
          ...plans.map(p => ({ ...p, eventType: 'PLAN' as const })), 
          ...revisions.map(r => ({ ...r, eventType: 'REVISION' as const }))
      ];
      
      if (viewMode === 'MONTH') {
          return (
              <>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Plan Dates</h3>
                    <span className="text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 px-2 py-1 rounded-full">
                        {monthEvents.length} Items
                    </span>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                    {monthEvents.length > 0 ? (
                        monthEvents.map((event, idx) => (
                            <div 
                                key={`${event.id}-${idx}`}
                                onClick={() => handlePlanItemClick(event.date)}
                                className="group bg-indigo-600 dark:bg-indigo-700 text-white p-4 rounded-[20px] shadow-lg shadow-indigo-200 dark:shadow-none flex items-center gap-3 cursor-pointer hover:bg-indigo-500 transition-all hover:scale-[1.02]"
                            >
                                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0">
                                    {/* FIX: Use eventType for logic */}
                                    {event.eventType === 'REVISION' ? <FireIcon className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-bold text-sm leading-tight truncate">{event.title}</h4>
                                    <p className="text-xs text-indigo-100 opacity-80 mt-0.5">
                                        {event.date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} – {event.subtitle}
                                    </p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-12 text-slate-400 italic">
                            No plans for {monthName} yet.
                        </div>
                    )}
                </div>
              </>
          );
      } else {
          // DAY VIEW
          return (
              <>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <button onClick={() => setViewMode('MONTH')} className="text-xs font-bold text-indigo-500 hover:underline mb-1 flex items-center gap-1">
                            <ChevronLeftIcon className="w-3 h-3" /> Back to Month
                        </button>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">{dateStr}</h3>
                    </div>
                    <button 
                        onClick={() => setIsQuickAddOpen(true)}
                        className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-full hover:bg-indigo-100 transition-colors"
                        title="Add Plan"
                    >
                        <PlusIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                    {dayEvents.length > 0 ? (
                        dayEvents.map((item, idx) => (
                            <div 
                                // FIX: Use eventType for logic and a safe key.
                                key={`${item.eventType === 'REVISION' ? item.pageNumber : item.id}-${idx}`}
                                className={`p-4 rounded-[20px] shadow-md flex items-center gap-3 ${
                                    item.eventType === 'REVISION' 
                                    ? 'bg-amber-500 text-white shadow-amber-200' 
                                    : 'bg-indigo-600 text-white shadow-indigo-200'
                                }`}
                            >
                                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0">
                                    {/* FIX: Use eventType for logic */}
                                    {item.eventType === 'REVISION' ? <FireIcon className="w-5 h-5" /> : <ListCheckIcon className="w-5 h-5" />}
                                </div>
                                <div className="min-w-0">
                                    {/* FIX: Use eventType for logic and remove incorrect cast */}
                                    <h4 className="font-bold text-sm leading-tight truncate">{item.eventType === 'REVISION' ? item.title : item.topic}</h4>
                                    <p className="text-xs opacity-80 mt-0.5">
                                        {/* FIX: Use eventType and access original `type` for PLAN items */}
                                        {item.eventType === 'REVISION' ? item.subject : item.type}
                                    </p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-300">
                                <CalendarIcon className="w-8 h-8" />
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 font-medium">No plans for this day yet.</p>
                            <button onClick={() => setIsQuickAddOpen(true)} className="mt-4 text-xs font-bold text-primary hover:underline">
                                + Add a session
                            </button>
                        </div>
                    )}
                </div>
              </>
          );
      }
  };

  return (
    <div className="animate-fade-in p-4 md:p-8 min-h-full">
        
        <div className="max-w-6xl mx-auto bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl shadow-slate-200/50 dark:shadow-none border border-white/50 dark:border-slate-800 overflow-hidden flex flex-col lg:flex-row min-h-[600px]">
            
            {/* LEFT PANEL: Calendar Grid */}
            <div className="flex-1 p-6 md:p-10 bg-white dark:bg-slate-900">
                
                {/* Month Header */}
                <div className="flex justify-between items-center mb-8 sticky top-0 bg-white dark:bg-slate-900 z-10 py-2">
                    <button onClick={prevMonth} className="p-3 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 transition-all">
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
                        {monthName} <span className="text-slate-300 dark:text-slate-600 font-normal">{year}</span>
                    </h2>
                    <button onClick={nextMonth} className="p-3 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 transition-all">
                        <ChevronRightIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Days Row */}
                <div className="grid grid-cols-7 mb-4">
                    {weekDays.map(d => (
                        <div key={d} className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2">
                            {d}
                        </div>
                    ))}
                </div>

                {/* Date Grid */}
                <div className="grid grid-cols-7 gap-2 md:gap-4">
                    {/* Empty Cells */}
                    {Array.from({ length: firstDay }).map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-square"></div>
                    ))}

                    {/* Days */}
                    {Array.from({ length: days }).map((_, i) => {
                        const day = i + 1;
                        const date = new Date(year, month, day);
                        const isSelected = isSameDay(date, selectedDate);
                        const isToday = isSameDay(date, new Date());
                        const { hasAny } = getDayData(date);

                        return (
                            <button
                                key={day}
                                onClick={() => handleDateClick(date)}
                                className={`
                                    aspect-square rounded-full flex flex-col items-center justify-center relative transition-all duration-300 group
                                    ${isSelected 
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-300 dark:shadow-indigo-900/50 scale-105 z-10' 
                                        : 'bg-indigo-50/50 dark:bg-slate-800 text-indigo-900 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-slate-700'
                                    }
                                    ${isToday && !isSelected ? 'ring-2 ring-indigo-300 dark:ring-indigo-700' : ''}
                                `}
                            >
                                <span className={`text-sm md:text-base font-medium ${isSelected ? 'font-bold' : ''}`}>{day}</span>
                                
                                {/* Dot Indicator */}
                                {hasAny && (
                                    <span className={`absolute bottom-2 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-indigo-400'}`}></span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* RIGHT PANEL: Plan Dates List */}
            <div className="w-full lg:w-[380px] bg-slate-50/80 dark:bg-slate-950/50 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 p-6 md:p-8 flex flex-col">
                {renderRightPanel()}
            </div>

        </div>

        {/* Quick Add Modal Overlay */}
        {isQuickAddOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[24px] shadow-2xl p-6 animate-slide-in-up">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-xl text-slate-800 dark:text-white">Add Plan</h3>
                        <button onClick={() => setIsQuickAddOpen(false)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 hover:text-slate-700">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="mb-4 text-sm text-slate-500 dark:text-slate-400 font-medium">
                        For {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </div>

                    <form onSubmit={handleSaveQuickTask} className="space-y-4">
                        <div>
                            <input 
                                autoFocus
                                type="text" 
                                value={taskTitle}
                                onChange={e => setTaskTitle(e.target.value)}
                                className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border-none focus:ring-2 focus:ring-indigo-500 text-lg font-bold placeholder-slate-300 text-slate-800 dark:text-white"
                                placeholder="What's the plan?"
                            />
                        </div>
                        <div className="flex gap-3">
                            <select 
                                value={taskType}
                                onChange={e => setTaskType(e.target.value as any)}
                                className="flex-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold text-slate-600 border-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="HYBRID">General Study</option>
                                <option value="PAGE">Reading</option>
                                <option value="VIDEO">Video</option>
                            </select>
                            <input 
                                type="text"
                                value={taskTime}
                                onChange={e => setTaskTime(e.target.value)}
                                placeholder="10:00 AM"
                                className="w-1/3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold text-slate-600 border-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 dark:shadow-none transition-all transform active:scale-95">
                            Save to Calendar
                        </button>
                    </form>
                </div>
            </div>
        )}

    </div>
  );
};