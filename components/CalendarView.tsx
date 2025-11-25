
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { StudySession, StudyPlanItem, getAdjustedDate, VideoResource, Attachment, KnowledgeBaseEntry, DayPlan, Block } from '../types';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, CheckCircleIcon, ClockIcon, FireIcon, ListCheckIcon, PlusIcon, XMarkIcon, SparklesIcon } from './Icons';
import { getDayPlan } from '../services/firebase';

interface CalendarViewProps {
  knowledgeBase: KnowledgeBaseEntry[];
  studyPlan: StudyPlanItem[];
  onAddToPlan: (item: Omit<StudyPlanItem, 'id'>, newVideo?: VideoResource, attachments?: Attachment[]) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ knowledgeBase, studyPlan, onAddToPlan }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'MONTH' | 'DAY'>('MONTH'); // Toggle right panel view
  const [selectedDayPlan, setSelectedDayPlan] = useState<DayPlan | null>(null);

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

  // Fetch Plan for Selected Date
  useEffect(() => {
      const fetchPlan = async () => {
          if (viewMode === 'DAY') {
              const dateStr = getAdjustedDate(selectedDate);
              const plan = await getDayPlan(dateStr);
              setSelectedDayPlan(plan);
          }
      };
      fetchPlan();
  }, [selectedDate, viewMode]);

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

  const formatTime12 = (timeStr: string | undefined) => {
    if (!timeStr) return "--:--";
    if (timeStr.toLowerCase().includes('m')) return timeStr;
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr);
    const m = parseInt(mStr);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const d = new Date();
    d.setHours(h, m);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

  // Right Panel Content
  const renderRightPanel = () => {
      const dateStr = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      
      // NEW LOGIC: Prioritize DayPlan Blocks if available
      let dayEvents: any[] = [];
      
      if (selectedDayPlan && selectedDayPlan.blocks && selectedDayPlan.blocks.length > 0) {
          dayEvents = selectedDayPlan.blocks.map(b => ({
              id: b.id,
              title: b.title,
              subtitle: `${formatTime12(b.plannedStartTime)} - ${formatTime12(b.plannedEndTime)}`,
              eventType: 'BLOCK',
              status: b.status
          }));
      } else {
          // Fallback to old logic
          const { plans, revisions } = getDayData(selectedDate);
          dayEvents = [
              ...plans.map(p => ({ ...p, eventType: 'PLAN', subtitle: p.type, status: p.isCompleted ? 'DONE' : 'PENDING' })), 
              ...revisions.map(r => ({ ...r, eventType: 'REVISION', subtitle: 'Revision Due', status: 'PENDING' }))
          ];
      }
      
      if (viewMode === 'MONTH') {
          return (
              <>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Plan Dates</h3>
                    <span className="text-xs font-bold bg-indigo-50/50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-full border border-indigo-100 dark:border-indigo-800">
                        {monthEvents.length} Items
                    </span>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                    {monthEvents.length > 0 ? (
                        monthEvents.map((event, idx) => (
                            <div 
                                key={`${event.id}-${idx}`}
                                onClick={() => handlePlanItemClick(event.date)}
                                className="group bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/40 dark:border-slate-700/50 text-slate-800 dark:text-slate-200 p-4 rounded-[20px] shadow-sm flex items-center gap-3 cursor-pointer hover:bg-white/80 dark:hover:bg-slate-700/80 transition-all hover:scale-[1.02]"
                            >
                                <div className="w-10 h-10 rounded-full bg-indigo-100/50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                    {event.eventType === 'REVISION' ? <FireIcon className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-bold text-sm leading-tight truncate">{event.title}</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 opacity-80 mt-0.5">
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
                        className="p-2 bg-indigo-50/50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors backdrop-blur-sm"
                        title="Add Plan"
                    >
                        <PlusIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                    {dayEvents.length > 0 ? (
                        dayEvents.map((item, idx) => (
                            <div 
                                key={`${item.id}-${idx}`}
                                className={`p-3 rounded-xl border flex items-center gap-3 backdrop-blur-sm shadow-sm ${
                                    item.status === 'DONE' || item.status === 'COMPLETED'
                                    ? 'bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-900/30'
                                    : 'bg-white/60 dark:bg-slate-800/60 border-white/40 dark:border-slate-700/50'
                                }`}
                            >
                                {item.status === 'DONE' || item.status === 'COMPLETED' ? (
                                    <div className="w-8 h-8 rounded-full bg-green-100/50 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 shrink-0">
                                        <CheckCircleIcon className="w-4 h-4" />
                                    </div>
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-slate-100/50 dark:bg-slate-700/50 flex items-center justify-center text-slate-400 shrink-0">
                                        <ClockIcon className="w-4 h-4" />
                                    </div>
                                )}
                                
                                <div className="min-w-0 flex-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className={`font-bold text-sm truncate ${item.status === 'DONE' ? 'text-slate-500 line-through' : 'text-slate-800 dark:text-white'}`}>
                                            {item.title}
                                        </h4>
                                        {item.status === 'DONE' && <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider bg-green-50/50 px-1.5 py-0.5 rounded border border-green-100">Done</span>}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                        {item.subtitle}
                                    </p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <div className="w-16 h-16 bg-slate-100/50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-4 text-slate-300 backdrop-blur-sm">
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
        
        <div className="max-w-6xl mx-auto bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[32px] shadow-2xl shadow-slate-200/20 dark:shadow-none border border-white/40 dark:border-slate-800 overflow-hidden flex flex-col lg:flex-row min-h-[600px]">
            
            {/* LEFT PANEL: Calendar Grid */}
            <div className="flex-1 p-6 md:p-10 bg-transparent">
                
                {/* Month Header */}
                <div className="flex justify-between items-center mb-8 sticky top-0 z-10 py-2">
                    <button onClick={prevMonth} className="p-3 rounded-full hover:bg-white/50 dark:hover:bg-slate-800/50 text-slate-400 hover:text-slate-700 transition-all backdrop-blur-sm">
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
                        {monthName} <span className="text-slate-300 dark:text-slate-600 font-normal">{year}</span>
                    </h2>
                    <button onClick={nextMonth} className="p-3 rounded-full hover:bg-white/50 dark:hover:bg-slate-800/50 text-slate-400 hover:text-slate-700 transition-all backdrop-blur-sm">
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
                                        : 'bg-indigo-50/50 dark:bg-slate-800/50 text-indigo-900 dark:text-indigo-200 hover:bg-indigo-100/50 dark:hover:bg-slate-700/50'
                                    }
                                    ${isToday && !isSelected ? 'ring-2 ring-indigo-300 dark:ring-indigo-700' : ''}
                                    backdrop-blur-sm
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
            <div className="w-full lg:w-[380px] bg-white/40 dark:bg-slate-950/40 backdrop-blur-lg border-t lg:border-t-0 lg:border-l border-white/20 dark:border-slate-800 p-6 md:p-8 flex flex-col">
                {renderRightPanel()}
            </div>

        </div>

        {/* Quick Add Modal Overlay */}
        {isQuickAddOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[24px] shadow-2xl p-6 animate-slide-in-up border border-white/20 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-xl text-slate-800 dark:text-white">Add Plan</h3>
                        <button onClick={() => setIsQuickAddOpen(false)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200"><XMarkIcon className="w-5 h-5 text-slate-500" /></button>
                    </div>
                    <form onSubmit={handleSaveQuickTask} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Task Title</label>
                            <input 
                                autoFocus
                                type="text" 
                                value={taskTitle}
                                onChange={e => setTaskTitle(e.target.value)}
                                className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="e.g. Read Chapter 4"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Time (Optional)</label>
                                <input 
                                    type="time" 
                                    value={taskTime}
                                    onChange={e => setTaskTime(e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                                <select 
                                    value={taskType}
                                    onChange={e => setTaskType(e.target.value as any)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="HYBRID">General</option>
                                    <option value="PAGE">Reading</option>
                                    <option value="VIDEO">Video</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
                            <textarea 
                                value={taskNotes}
                                onChange={e => setTaskNotes(e.target.value)}
                                className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-20"
                                placeholder="Details..."
                            />
                        </div>
                        <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all">
                            Save to Calendar
                        </button>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};
