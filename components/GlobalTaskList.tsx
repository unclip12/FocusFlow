import React from 'react';
import { StudySession } from '../types';
import { ListCheckIcon, BookOpenIcon } from './Icons';

interface GlobalTaskListProps {
  sessions: StudySession[];
  onToggleTask: (sessionId: string, taskId: string) => void;
}

const GlobalTaskList: React.FC<GlobalTaskListProps> = ({ sessions, onToggleTask }) => {
  
  // Filter sessions that have at least one pending task OR show all if we want to see done ones too
  // Let's show any session that has tasks defined
  const sessionsWithTasks = sessions.filter(s => s.toDoList && s.toDoList.length > 0);

  return (
    <div className="animate-fade-in">
        <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 text-primary flex items-center justify-center">
                <ListCheckIcon className="w-6 h-6" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-slate-900">Global Task List</h2>
                <p className="text-slate-500 text-sm">Track pending actions across all pages</p>
            </div>
        </div>

        {sessionsWithTasks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sessionsWithTasks.map(session => {
                    const pendingCount = session.toDoList!.filter(t => !t.done).length;
                    const allDone = pendingCount === 0;

                    return (
                        <div key={session.id} className={`bg-white rounded-xl border p-5 transition-all ${allDone ? 'border-slate-100 opacity-75' : 'border-indigo-100 shadow-sm'}`}>
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                        <BookOpenIcon className="w-3 h-3" /> Page {session.pageNumber}
                                    </div>
                                    <h3 className="font-bold text-slate-800">{session.topic}</h3>
                                </div>
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${allDone ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {allDone ? 'All Done' : `${pendingCount} Pending`}
                                </span>
                            </div>
                            
                            <div className="space-y-2">
                                {session.toDoList!.map(todo => (
                                    <label key={todo.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-100 transition-colors">
                                        <input 
                                            type="checkbox" 
                                            checked={todo.done}
                                            onChange={() => onToggleTask(session.id, todo.id)}
                                            className="mt-1 w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                        />
                                        <span className={`text-sm leading-relaxed ${todo.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                            {todo.text}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        ) : (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
                <ListCheckIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700">No tasks tracked yet</h3>
                <p className="text-slate-500 mt-2">Add specific to-do items to your study sessions to see them here.</p>
            </div>
        )}
    </div>
  );
};

export default GlobalTaskList;