

import React, { useEffect } from 'react';
import { StudySession, StudyPlanItem, getAdjustedDate } from '../types';
import { ClockIcon, BookOpenIcon, FireIcon, CheckCircleIcon, CalendarIcon, ListCheckIcon } from './Icons';

interface DailyViewModalProps {
  isOpen: boolean;
  date: Date | null;
  onClose: () => void;
  sessions: StudySession[];
  studyPlan: StudyPlanItem[];
  onEditSession: (s: StudySession) => void;
}

const DailyViewModal: React.FC<DailyViewModalProps> = ({ isOpen, date, onClose, sessions, studyPlan, onEditSession }) => {
  
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

  if (!isOpen || !date) return null;

  // The selected date from calendar/forecast (e.g., 2023-11-19)
  const selectedDateStr = date.toLocaleDateString('en-CA'); 

  // 1. Revisions Due
  const revisionsDue = sessions.filter(s => {
      if (!s.nextRevisionDate) return false;
      // For due dates, we stick to standard calendar days for now or use the adjusted logic if we want consistency
      // Usually due dates are stored as full ISO. Let's check if the due date falls on this visual day.
      return new Date(s.nextRevisionDate).toLocaleDateString('en-CA') === selectedDateStr;
  });

  // 2. Completed Sessions (History Logged on this Date)
  // USE ADJUSTED DATE LOGIC: A session logged at 2AM on the 20th matches '2023-11-19'
  const completedSessions = sessions.filter(s => 
      s.history.some(h => getAdjustedDate(h.startTime) === selectedDateStr)
  ).map(s => {
      // Calculate total time spent specifically on this adjusted date
      const dailyMinutes = s.history
        .filter(h => getAdjustedDate(h.startTime) === selectedDateStr)
        .reduce((acc, curr) => acc + curr.durationMinutes, 0);
      return { ...s, dailyMinutes };
  });

  // 3. Planned Targets
  const plannedTargets = studyPlan.filter(p => p.date === selectedDateStr);

  const formattedDate = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-fade-in-up max-h-[90vh] flex flex-col border border-slate-100">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white rounded-t-2xl">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-white border border-slate-200 rounded-xl text-primary shadow-sm">
                    <CalendarIcon className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-800 leading-tight">Daily Summary</h2>
                    <p className="text-primary font-semibold text-sm mt-0.5">{formattedDate}</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <span className="sr-only">Close</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                    <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
                </svg>
            </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-8">
            
            {/* Section 1: Activity Log (What was done) */}
            <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-green-500" /> 
                    <span>Completed Sessions</span>
                    <span className="ml-auto bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px]">{completedSessions.length}</span>
                </h3>
                {completedSessions.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {completedSessions.map((s, idx) => (
                             <div key={s.id + idx} className="p-4 bg-green-50/40 border border-green-100 rounded-xl flex items-start gap-3 hover:shadow-sm transition-shadow cursor-pointer" onClick={() => { onClose(); onEditSession(s); }}>
                                 <div className="w-8 h-8 mt-0.5 bg-white rounded-lg flex items-center justify-center text-green-600 shadow-sm border border-green-100 shrink-0">
                                     <BookOpenIcon className="w-4 h-4" />
                                 </div>
                                 <div className="min-w-0">
                                     <h4 className="font-bold text-slate-800 text-sm truncate">{s.topic}</h4>
                                     <div className="flex gap-3 text-xs text-slate-500 mt-1">
                                         <span className="bg-white px-1.5 rounded border border-green-100">Pg {s.pageNumber}</span>
                                         <span className="font-medium text-green-700 flex items-center gap-1">
                                            <ClockIcon className="w-3 h-3" /> {s.dailyMinutes}m
                                         </span>
                                     </div>
                                 </div>
                             </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-slate-400 italic p-6 bg-slate-50 rounded-xl border border-slate-100 text-center border-dashed">
                        No study sessions recorded for this day.
                    </div>
                )}
            </section>

            {/* Section 2: Planned Targets */}
            <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <ListCheckIcon className="w-4 h-4 text-blue-500" /> 
                    <span>Planned Targets</span>
                    <span className="ml-auto bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px]">{plannedTargets.length}</span>
                </h3>
                {plannedTargets.length > 0 ? (
                    <div className="space-y-2">
                        {plannedTargets.map(p => (
                            <div key={p.id} className={`p-3 border rounded-xl flex justify-between items-center transition-all ${p.isCompleted ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-white border-blue-100 shadow-sm hover:shadow-md'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.isCompleted ? 'bg-green-400' : 'bg-blue-500'}`}></div>
                                    <div>
                                        <h4 className={`font-bold text-sm ${p.isCompleted ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{p.topic}</h4>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">Pg {p.pageNumber} • {p.type}</p>
                                    </div>
                                </div>
                                {p.isCompleted ? (
                                    <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded border border-green-100">Done</span>
                                ) : (
                                    <span className="text-[10px] font-bold text-blue-400 bg-blue-50 px-2 py-1 rounded border border-blue-100">Pending</span>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-slate-400 italic p-6 bg-slate-50 rounded-xl border border-slate-100 text-center border-dashed">
                        No specific targets planned for this day.
                    </div>
                )}
            </section>

            {/* Section 3: Scheduled Revisions */}
            <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <FireIcon className="w-4 h-4 text-amber-500" /> 
                    <span>Revisions Due</span>
                    <span className="ml-auto bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px]">{revisionsDue.length}</span>
                </h3>
                {revisionsDue.length > 0 ? (
                    <div className="space-y-2">
                        {revisionsDue.map(s => (
                            <div 
                                key={s.id} 
                                onClick={() => { onClose(); onEditSession(s); }}
                                className="p-3 rounded-xl border border-slate-100 hover:border-amber-300 hover:bg-amber-50/30 transition-all cursor-pointer flex items-center justify-between bg-white group shadow-sm"
                            >
                                 <div className="flex items-center gap-3">
                                     <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-lg flex items-center justify-center border border-amber-100 group-hover:bg-amber-100 transition-colors">
                                         <span className="text-[10px] font-bold">REV</span>
                                     </div>
                                     <div>
                                         <h4 className="font-bold text-slate-800 text-sm group-hover:text-amber-800 transition-colors">{s.topic}</h4>
                                         <span className="text-xs text-slate-400">Pg {s.pageNumber}</span>
                                     </div>
                                 </div>
                                 <button className="text-xs bg-white border border-slate-200 text-slate-600 font-bold px-3 py-1.5 rounded-lg group-hover:border-amber-200 group-hover:text-amber-600">View</button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-slate-400 italic p-6 bg-slate-50 rounded-xl border border-slate-100 text-center border-dashed">
                        No revisions scheduled for this day.
                    </div>
                )}
            </section>

        </div>
      </div>
    </div>
  );
};

export default DailyViewModal;