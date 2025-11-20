import React from 'react';
import { StudySession, KnowledgeBaseEntry } from '../types';
import { CheckCircleIcon, TrashIcon, ClockIcon, RepeatIcon, ListCheckIcon, FireIcon } from './Icons';
import { PageBadge } from './PageBadge';

interface SessionRowProps {
  session: StudySession;
  knowledgeBase?: KnowledgeBaseEntry[];
  onDelete: (id: string) => void;
  onEdit: (session: StudySession) => void;
  onLogRevision: (session: StudySession) => void;
  onViewPage?: (page: string) => void;
}

const SessionRow: React.FC<SessionRowProps> = ({ session, knowledgeBase = [], onDelete, onEdit, onLogRevision, onViewPage }) => {
  
  // Calculated fields
  const nextDue = session.nextRevisionDate ? new Date(session.nextRevisionDate) : null;
  const isDue = nextDue && nextDue <= new Date();
  const isMastered = !session.nextRevisionDate && session.currentIntervalIndex >= session.revisionIntervals.length;
  
  // Formatting
  const dueDateStr = nextDue ? nextDue.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' }) : 'Done';
  
  // Stats
  const totalMinutes = session.history.reduce((acc, log) => acc + log.durationMinutes, 0);
  
  // Anki Stats
  const ankiTotal = session.ankiTotal || 0;
  const ankiCovered = session.ankiCovered || 0;
  const ankiPercent = ankiTotal > 0 ? Math.min(100, Math.round((ankiCovered / ankiTotal) * 100)) : 0;
  
  // ToDo Stats
  const pendingTasks = session.toDoList?.filter(t => !t.done).length || 0;
  const totalTasks = session.toDoList?.length || 0;

  // Get KB attachments if available
  const kbEntry = knowledgeBase.find(k => k.pageNumber === session.pageNumber);
  const attachments = kbEntry?.attachments || [];
  const revisionCount = session.history.filter(h => h.type === 'REVISION').length;

  return (
    <div className={`group relative bg-white dark:bg-dark-surface border rounded-xl p-4 transition-all duration-200 hover:shadow-md ${isDue ? 'border-l-4 border-l-amber-400 border-slate-200 dark:border-dark-border bg-amber-50/10 dark:bg-amber-900/10' : 'border-slate-100 dark:border-dark-border'}`}>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        
        {/* Page Badge (New Integration) */}
        <div className="flex-shrink-0">
            <PageBadge 
                pageNumber={session.pageNumber} 
                attachments={attachments} 
                revisionCount={revisionCount}
                onClick={() => onViewPage && onViewPage(session.pageNumber)}
            />
        </div>

        {/* Task Info */}
        <div className="flex-grow min-w-0 cursor-pointer w-full" onClick={() => onEdit(session)}>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className={`font-semibold text-slate-800 dark:text-slate-200 truncate text-base sm:text-lg ${isMastered ? 'text-slate-500 dark:text-slate-500' : ''}`}>
              {session.topic}
            </h4>
            <span className="text-[10px] px-2 py-0.5 bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full uppercase font-bold tracking-wide border border-slate-200 dark:border-slate-600">
                {session.category}
            </span>
          </div>
          
          {/* Detail Row */}
          <div className="flex items-center gap-3 sm:gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
             {/* Anki Bar */}
             <div className="flex items-center gap-2 min-w-[90px]">
                <FireIcon className={`w-3 h-3 ${ankiPercent === 100 ? 'text-orange-500' : 'text-slate-400'}`} />
                <div className="flex flex-col w-16 sm:w-20">
                    <div className="flex justify-between text-[10px] mb-0.5">
                        <span>Anki</span>
                        <span>{ankiCovered}/{ankiTotal}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden border border-slate-200 dark:border-slate-600">
                        <div className={`h-full rounded-full ${ankiPercent === 100 ? 'bg-green-500' : 'bg-orange-400'}`} style={{ width: `${ankiPercent}%` }}></div>
                    </div>
                </div>
             </div>

             {/* Tasks */}
             {totalTasks > 0 && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded border ${pendingTasks === 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900 text-green-600 dark:text-green-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                    <ListCheckIcon className="w-3 h-3" />
                    <span>{totalTasks - pendingTasks}/{totalTasks}</span>
                </div>
             )}

             <span className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-700">
                 <ClockIcon className="w-3 h-3" /> {Math.round(totalMinutes / 60 * 10) / 10}h
             </span>

             <span className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-700">
                 <RepeatIcon className="w-3 h-3" /> 
                 {isMastered ? 'Mastered' : `${dueDateStr}`}
             </span>
             {isDue && <span className="text-amber-600 dark:text-amber-400 font-bold animate-pulse text-[10px]">DUE</span>}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0 justify-between sm:justify-end">
            
            {/* Revision Button */}
            {!isMastered && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onLogRevision(session); }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all flex-grow sm:flex-grow-0 justify-center ${
                        isDue 
                        ? 'bg-primary text-white shadow-md shadow-indigo-200 dark:shadow-none hover:bg-indigo-700'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                >
                    <RepeatIcon className="w-4 h-4" />
                    {isDue ? 'Revise' : 'Log'}
                </button>
            )}

            {isMastered && (
                 <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-900" title="Mastered">
                    <CheckCircleIcon className="w-5 h-5" />
                 </div>
            )}

            <button 
                onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
                className="p-2 rounded-lg text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-500 transition-colors"
                title="Delete Session"
            >
                <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
    </div>
  );
};

export default SessionRow;