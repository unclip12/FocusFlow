

import React, { useState, useEffect } from 'react';
import { ClockIcon, BookOpenIcon, ListCheckIcon } from './Icons';
import { StudySession, ToDoItem } from '../types';

// Robust ID generator
const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

interface LogRevisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (start: string, end: string, updatedNotes?: string, updatedTodos?: ToDoItem[]) => void;
  session: StudySession;
}

const LogRevisionModal: React.FC<LogRevisionModalProps> = ({ isOpen, onClose, onConfirm, session }) => {
  const [activeTab, setActiveTab] = useState<'TIME' | 'NOTES' | 'TASKS'>('TIME');
  
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  
  // Local state for edits during revision
  const [notes, setNotes] = useState('');
  const [toDoList, setToDoList] = useState<ToDoItem[]>([]);
  const [newToDo, setNewToDo] = useState('');

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

  useEffect(() => {
    if (isOpen) {
      // Default time
      const now = new Date();
      const end = new Date(now.getTime() + 30 * 60000);
      setStartTime(now.toTimeString().slice(0, 5));
      setEndTime(end.toTimeString().slice(0, 5));
      
      // Load session data
      setNotes(session.notes || '');
      setToDoList(session.toDoList || []);
      setActiveTab('TIME');
    }
  }, [isOpen, session]);

  const handleAddToDo = () => {
    if (!newToDo.trim()) return;
    setToDoList(prev => [...prev, { id: generateId(), text: newToDo, done: false }]);
    setNewToDo('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const today = new Date().toISOString().slice(0, 10);
    const startISO = `${today}T${startTime}:00`;
    const endISO = `${today}T${endTime}:00`;
    
    onConfirm(startISO, endISO, notes, toDoList);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh] animate-fade-in-up">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">Log Revision</h3>
          <p className="text-sm text-slate-500">Pg {session.pageNumber} - {session.topic}</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
            <button onClick={() => setActiveTab('TIME')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${activeTab === 'TIME' ? 'text-primary border-b-2 border-primary bg-indigo-50/50' : 'text-slate-500 hover:bg-slate-50'}`}>
                Time Log
            </button>
            <button onClick={() => setActiveTab('NOTES')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${activeTab === 'NOTES' ? 'text-primary border-b-2 border-primary bg-indigo-50/50' : 'text-slate-500 hover:bg-slate-50'}`}>
                Notes
            </button>
            <button onClick={() => setActiveTab('TASKS')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${activeTab === 'TASKS' ? 'text-primary border-b-2 border-primary bg-indigo-50/50' : 'text-slate-500 hover:bg-slate-50'}`}>
                Tasks ({toDoList.filter(t => !t.done).length})
            </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
            
            {activeTab === 'TIME' && (
                <div className="space-y-6">
                    <div className="text-center">
                         <div className="w-12 h-12 bg-indigo-100 text-primary rounded-full flex items-center justify-center mx-auto mb-3">
                            <ClockIcon className="w-6 h-6" />
                        </div>
                        <p className="text-sm text-slate-600">Record your study session time.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Time</label>
                        <input 
                            type="time" 
                            required
                            value={startTime}
                            onChange={e => setStartTime(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-center font-mono"
                        />
                        </div>
                        <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Time</label>
                        <input 
                            type="time" 
                            required
                            value={endTime}
                            onChange={e => setEndTime(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-center font-mono"
                        />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'NOTES' && (
                <div className="space-y-2 h-full flex flex-col">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Update Notes</label>
                    <textarea 
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        className="w-full flex-1 min-h-[200px] p-3 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 outline-none text-sm"
                        placeholder="Add observations from this revision..."
                    />
                </div>
            )}

            {activeTab === 'TASKS' && (
                <div className="space-y-3">
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={newToDo}
                            onChange={e => setNewToDo(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddToDo())}
                            placeholder="Add a task..."
                            className="flex-grow px-3 py-2 rounded border border-slate-200 text-sm focus:outline-none focus:border-primary"
                        />
                        <button type="button" onClick={handleAddToDo} className="px-3 bg-slate-100 rounded text-slate-600 font-bold hover:bg-slate-200">+</button>
                    </div>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                         {toDoList.map(todo => (
                            <label key={todo.id} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50 border border-transparent hover:border-slate-100 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={todo.done} 
                                    onChange={() => setToDoList(prev => prev.map(t => t.id === todo.id ? {...t, done: !t.done} : t))}
                                    className="w-4 h-4 rounded text-primary focus:ring-primary"
                                />
                                <span className={`text-sm flex-grow ${todo.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{todo.text}</span>
                            </label>
                         ))}
                         {toDoList.length === 0 && <p className="text-center text-slate-400 text-sm py-4">No tasks for this page.</p>}
                    </div>
                </div>
            )}

        </form>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex gap-3 bg-slate-50/50 rounded-b-2xl">
             <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-indigo-600 shadow-md shadow-indigo-200 transition-all"
            >
              Complete Session
            </button>
        </div>
      </div>
    </div>
  );
};

export default LogRevisionModal;