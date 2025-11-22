

import React, { useState, useEffect } from 'react';
// FIX: Replaced DEFAULT_INTERVALS with REVISION_SCHEDULE
import { StudySession, CATEGORIES, ToDoItem, SYSTEMS, KnowledgeBaseEntry, StudyLog, getAdjustedDate, Attachment } from '../types';
import { SparklesIcon, BookOpenIcon, ListCheckIcon, XMarkIcon, PlusIcon, DatabaseIcon, CheckCircleIcon, HistoryIcon, PencilSquareIcon, TrashIcon, PaperClipIcon, PhotoIcon, DocumentIcon } from './Icons';
import { generateStudyChecklist } from '../services/geminiService';
import { uploadFile } from '../services/firebase';

// Robust ID generator
const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

interface SessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (session: Partial<StudySession> & { planUpdates?: { completedSubTaskIds: string[], isFinished: boolean } }) => void;
  initialData?: StudySession | null;
  prefillData?: any | null; 
  knowledgeBase?: KnowledgeBaseEntry[];
  planContext?: {
      planId: string;
      subTasks: ToDoItem[];
  } | null;
}

const SessionModal: React.FC<SessionModalProps> = ({ isOpen, onClose, onSave, initialData, prefillData, knowledgeBase = [], planContext }) => {
  const [activeTab, setActiveTab] = useState<'CURRENT' | 'HISTORY'>('CURRENT');

  // Core Fields
  const [topic, setTopic] = useState('');
  const [pageNumber, setPageNumber] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [system, setSystem] = useState(SYSTEMS[0]);
  
  // Time Fields
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [date, setDate] = useState('');
  
  // Global/Persistent Notes
  const [notes, setNotes] = useState('');

  // Session Specific Logging
  const [sessionNotes, setSessionNotes] = useState('');
  const [ankiSessionDelta, setAnkiSessionDelta] = useState<number>(0);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Anki Stats (Global)
  const [ankiCovered, setAnkiCovered] = useState<number>(0);
  const [ankiTotal, setAnkiTotal] = useState<number>(0);

  // To-Do List (Global Session)
  const [toDoList, setToDoList] = useState<ToDoItem[]>([]);
  const [newToDo, setNewToDo] = useState('');

  // Plan Specific Context
  const [planSubTasks, setPlanSubTasks] = useState<ToDoItem[]>([]);
  const [markPlanComplete, setMarkPlanComplete] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  // FIX: Use REVISION_SCHEDULE instead of DEFAULT_INTERVALS
  const [revisionIntervals, setRevisionIntervals] = useState<number[]>([]);

  // History Editing State
  const [localHistory, setLocalHistory] = useState<StudyLog[]>([]);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogStart, setEditLogStart] = useState('');
  const [editLogEnd, setEditLogEnd] = useState('');
  const [editLogDate, setEditLogDate] = useState('');
  const [editLogNotes, setEditLogNotes] = useState('');
  const [editLogAnkiDelta, setEditLogAnkiDelta] = useState(0);

  // Reset or populate form when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('CURRENT');
      setSessionNotes('');
      setAnkiSessionDelta(0);
      setAttachments([]);

      // Init Plan Context
      if (planContext) {
          setPlanSubTasks(JSON.parse(JSON.stringify(planContext.subTasks))); // Deep copy
          // Default mark as complete check logic can stay, but we will have a specific button too
          const allDone = planContext.subTasks.length > 0 && planContext.subTasks.every(t => t.done);
          setMarkPlanComplete(allDone);
      } else {
          setPlanSubTasks([]);
          setMarkPlanComplete(false);
      }

      if (initialData) {
        setTopic(initialData.topic);
        setPageNumber(initialData.pageNumber);
        setCategory(initialData.category);
        setSystem(initialData.system || SYSTEMS[0]);
        setNotes(initialData.notes || '');
        
        setAnkiCovered(initialData.ankiCovered || 0);
        setAnkiTotal(initialData.ankiTotal || 0);
        setToDoList(initialData.toDoList || []);
        setRevisionIntervals(initialData.revisionIntervals);
        setLocalHistory(initialData.history || []);

        // Default time to now for a new log entry
        const now = new Date();
        setDate(getAdjustedDate(now));
        setStartTime(now.toTimeString().slice(0,5));
        const end = new Date(now.getTime() + 60 * 60000);
        setEndTime(end.toTimeString().slice(0,5));

      } else {
        // New Session State
        setTopic(prefillData?.topic || '');
        setPageNumber(prefillData?.pageNumber || '');
        setCategory(prefillData?.category || CATEGORIES[0]);
        setSystem(prefillData?.system || SYSTEMS[0]);
        setAnkiTotal(prefillData?.ankiTotal || 0);
        setAnkiCovered(0);
        setToDoList([]);
        setNewToDo('');
        setNotes('');
        // FIX: Use REVISION_SCHEDULE instead of DEFAULT_INTERVALS
        setRevisionIntervals([]);
        setLocalHistory([]);
        
        // Time handling
        const now = new Date();
        
        if (prefillData?.startTime && prefillData?.endTime) {
             // Timer provided
             const s = new Date(prefillData.startTime);
             const e = new Date(prefillData.endTime);
             setDate(getAdjustedDate(s));
             setStartTime(s.toTimeString().slice(0, 5));
             setEndTime(e.toTimeString().slice(0, 5));
        } else {
             setDate(getAdjustedDate(now));
             setStartTime(now.toTimeString().slice(0, 5));
             const end = new Date(now.getTime() + 60 * 60000);
             setEndTime(end.toTimeString().slice(0, 5));
        }
      }
    }
  }, [isOpen, initialData, prefillData, planContext]);

  // Helper to construct date respecting the 4AM rule
  const constructDateTime = (dateStr: string, timeStr: string): Date => {
      const d = new Date(`${dateStr}T${timeStr}:00`);
      const hours = parseInt(timeStr.split(':')[0], 10);
      if (hours < 4) {
          d.setDate(d.getDate() + 1);
      }
      return d;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setIsUploading(true);
          
          let type: 'IMAGE' | 'PDF' | 'OTHER' = 'OTHER';
          if (file.type.startsWith('image/')) {
              type = 'IMAGE';
          } else if (file.type === 'application/pdf') {
              type = 'PDF';
          }

          try {
             const url = await uploadFile(file);
             const newAttachment: Attachment = {
                id: generateId(),
                name: file.name,
                type: type,
                data: url
            };
            setAttachments(prev => [...prev, newAttachment]);
          } catch (error) {
             console.warn("Upload failed, falling back to base64", error);
             // No file size limit fallback
             const reader = new FileReader();
             reader.onload = (ev) => {
                 const result = ev.target?.result as string;
                 const newAttachment: Attachment = {
                     id: generateId(),
                     name: file.name,
                     type: type,
                     data: result
                 };
                 setAttachments(prev => [...prev, newAttachment]);
             };
             reader.readAsDataURL(file);
          } finally {
             setIsUploading(false);
          }
      }
  };

  const removeAttachment = (id: string) => {
      setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handlePlanTaskToggle = (taskId: string, text: string, currentDone: boolean) => {
      const newDone = !currentDone;
      setPlanSubTasks(prev => prev.map(t => t.id === taskId ? {...t, done: newDone} : t));
      
      if (newDone) {
          setSessionNotes(prev => {
              const line = `• Completed: ${text}`;
              if (prev.includes(line)) return prev;
              return prev ? prev + '\n' + line : line;
          });
      }
  };

  const handleGlobalTaskToggle = (taskId: string, text: string, currentDone: boolean) => {
      const newDone = !currentDone;
      setToDoList(prev => prev.map(t => t.id === taskId ? {...t, done: newDone} : t));
  }

  const handleAnkiDeltaChange = (delta: number) => {
      setAnkiSessionDelta(delta);
      const base = initialData?.ankiCovered || 0;
      setAnkiCovered(Math.min(ankiTotal, base + delta));
  };

  const handleGeneratePlan = async () => {
    if (!topic) return;
    setIsGenerating(true);
    try {
      const start = constructDateTime(date, startTime);
      const end = constructDateTime(date, endTime);
      const duration = Math.max(5, Math.round((end.getTime() - start.getTime()) / 60000));
      
      const checklist = await generateStudyChecklist(`${topic} (FA Page ${pageNumber})`, duration);
      const newItems: ToDoItem[] = checklist.map(item => ({
          id: generateId(),
          text: item,
          done: false
      }));
      setToDoList(prev => [...prev, ...newItems]);
      
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddToDo = () => {
    if (!newToDo.trim()) return;
    setToDoList(prev => [...prev, { id: generateId(), text: newToDo, done: false }]);
    setNewToDo('');
  };

  const removeToDo = (id: string) => {
      setToDoList(prev => prev.filter(i => i.id !== id));
  };

  // --- HISTORY EDITING LOGIC ---
  const startEditingLog = (log: StudyLog) => {
      setEditingLogId(log.id);
      const adjustedDate = getAdjustedDate(log.startTime);
      setEditLogDate(adjustedDate);
      setEditLogStart(new Date(log.startTime).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'}));
      setEditLogEnd(new Date(log.endTime).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'}));
      setEditLogNotes(log.notes || '');
      setEditLogAnkiDelta(log.ankiDelta || 0);
  };

  const saveEditingLog = () => {
      if (!editingLogId) return;
      const sDateObj = constructDateTime(editLogDate, editLogStart);
      let eDateObj = constructDateTime(editLogDate, editLogEnd);
      
      if (eDateObj < sDateObj) {
          eDateObj = new Date(eDateObj.getTime() + 24 * 60 * 60 * 1000);
      }
      
      const duration = Math.round((eDateObj.getTime() - sDateObj.getTime()) / 60000);

      setLocalHistory(prev => prev.map(log => {
          if (log.id === editingLogId) {
              const oldDelta = log.ankiDelta || 0;
              const diff = editLogAnkiDelta - oldDelta;
              setAnkiCovered(prev => prev + diff);

              return {
                  ...log,
                  date: sDateObj.toISOString(), 
                  startTime: sDateObj.toISOString(),
                  endTime: eDateObj.toISOString(),
                  durationMinutes: duration,
                  notes: editLogNotes,
                  ankiDelta: editLogAnkiDelta
              };
          }
          return log;
      }));
      setEditingLogId(null);
  };

  const deleteLog = (id: string) => {
      if(confirm('Remove this history entry?')) {
          const log = localHistory.find(l => l.id === id);
          if (log && log.ankiDelta) {
              setAnkiCovered(prev => Math.max(0, prev - log.ankiDelta!));
          }
          setLocalHistory(prev => prev.filter(l => l.id !== id));
      }
  };

  // Handle Form Submission
  const handleSubmit = (e: React.FormEvent, forceComplete = false) => {
    if (e) e.preventDefault();
    if (isUploading) return; // Prevent saving while uploading
    
    const startObj = constructDateTime(date, startTime);
    let endObj = constructDateTime(date, endTime);
    if (endObj <= startObj) {
        endObj.setDate(endObj.getDate() + 1);
    }
    const durationMinutes = Math.round((endObj.getTime() - startObj.getTime()) / 60000);

    // If forcing complete, ensure all tracked stats are maxed or checked
    let finalAnkiCovered = ankiCovered;
    let finalAnkiDone = ankiTotal > 0 && ankiCovered >= ankiTotal;
    let finalPlanSubTasks = [...planSubTasks];
    let finalMarkPlanComplete = markPlanComplete;

    if (forceComplete) {
        if (ankiTotal > 0) {
            finalAnkiCovered = ankiTotal;
            finalAnkiDone = true;
        }
        finalPlanSubTasks = finalPlanSubTasks.map(t => ({ ...t, done: true }));
        finalMarkPlanComplete = true;
    }

    const newHistoryLog: StudyLog = {
        id: generateId(),
        date: startObj.toISOString(), 
        startTime: startObj.toISOString(),
        endTime: endObj.toISOString(),
        durationMinutes: durationMinutes,
        type: initialData ? 'REVISION' : 'INITIAL',
        notes: sessionNotes,
        ankiDelta: forceComplete ? (finalAnkiCovered - (initialData?.ankiCovered || 0)) : ankiSessionDelta,
        subTasksCompleted: [
            ...finalPlanSubTasks.filter(t => t.done).map(t => t.text),
            ...toDoList.filter(t => t.done).map(t => t.text)
        ],
        attachments: attachments
    };

    let planUpdates = undefined;
    if (planContext) {
        planUpdates = {
            completedSubTaskIds: finalPlanSubTasks.filter(t => t.done).map(t => t.id),
            isFinished: finalMarkPlanComplete
        };
    }

    onSave({
      topic,
      pageNumber,
      category,
      system,
      ankiCovered: finalAnkiCovered, 
      ankiTotal,
      ankiDone: finalAnkiDone,
      notes, 
      toDoList,
      revisionIntervals,
      lastStudied: startObj.toISOString(),
      history: [newHistoryLog, ...localHistory], 
      planUpdates
    } as any); 
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-xl w-full max-w-lg animate-fade-in-up my-2 sm:my-8 flex flex-col max-h-[95vh] sm:max-h-[85vh]">
        
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-dark-border flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 rounded-t-2xl shrink-0">
          <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2 truncate">
                {initialData ? 'Edit Session' : 'Log Study Session'}
              </h2>
              {initialData && (
                  <div className="flex gap-4 mt-2 text-xs font-bold tracking-wide">
                      <button onClick={() => setActiveTab('CURRENT')} className={`pb-1 border-b-2 transition-colors ${activeTab === 'CURRENT' ? 'text-primary border-primary' : 'text-slate-400 dark:text-slate-500 border-transparent hover:text-slate-600'}`}>
                          CURRENT LOG
                      </button>
                      <button onClick={() => setActiveTab('HISTORY')} className={`pb-1 border-b-2 transition-colors ${activeTab === 'HISTORY' ? 'text-primary border-primary' : 'text-slate-400 dark:text-slate-500 border-transparent hover:text-slate-600'}`}>
                          HISTORY ({localHistory.length})
                      </button>
                  </div>
              )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors text-2xl leading-none self-start ml-2">
            &times;
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-6">
          {activeTab === 'HISTORY' && initialData ? (
              <div className="space-y-4">
                  {/* History List Rendering (Simplified for brevity) */}
                  {localHistory.map(log => (
                      <div key={log.id} onClick={() => startEditingLog(log)} className="p-3 border border-slate-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer group transition-all">
                          <div className="flex justify-between items-start">
                              <div>
                                  <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                      {getAdjustedDate(log.startTime)} 
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                      {log.durationMinutes} mins {log.attachments && log.attachments.length > 0 && `• ${log.attachments.length} files`}
                                  </div>
                              </div>
                              <PencilSquareIcon className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-primary" />
                          </div>
                      </div>
                  ))}
              </div>
          ) : (
            <form id="session-form" onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            
            {/* PLAN SUBTASKS */}
            {planContext && planSubTasks.length > 0 && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4 mb-4">
                    <h3 className="font-bold text-indigo-900 dark:text-indigo-300 text-sm uppercase tracking-wide mb-2">Planned Sub-Tasks</h3>
                    <div className="space-y-2 mb-3">
                        {planSubTasks.map(task => (
                            <label key={task.id} className="flex items-center gap-3 p-2 bg-white dark:bg-slate-800 rounded-lg border border-indigo-100 dark:border-indigo-900 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={task.done}
                                    onChange={() => handlePlanTaskToggle(task.id, task.text, task.done)}
                                    className="w-4 h-4 text-primary rounded border-slate-300 dark:border-slate-600"
                                />
                                <span className={`text-sm ${task.done ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>{task.text}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Basic Info */}
            <div className="flex gap-4">
                <div className="w-24 sm:w-28 flex-shrink-0">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Page #</label>
                    <input 
                        required 
                        type="text" 
                        value={pageNumber} 
                        onChange={(e) => setPageNumber(e.target.value)} 
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-white text-slate-900 dark:text-slate-900 focus:border-primary" 
                    />
                </div>
                <div className="flex-grow">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Topic</label>
                    <input 
                        required 
                        type="text" 
                        value={topic} 
                        onChange={(e) => setTopic(e.target.value)} 
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-white text-slate-900 dark:text-slate-900 focus:border-primary" 
                    />
                </div>
            </div>

            {/* Time Entry - Optimized for Mobile */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-2">Session Timing</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                         <span className="text-[10px] text-slate-400 font-bold uppercase mb-1 block sm:hidden">Date</span>
                         <input 
                             type="date" 
                             required 
                             value={date} 
                             onChange={e => setDate(e.target.value)} 
                             className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-white text-slate-900 dark:text-slate-900 text-sm" 
                         />
                    </div>
                    <div className="flex gap-3 sm:contents">
                         <div className="flex-1">
                             <span className="text-[10px] text-slate-400 font-bold uppercase mb-1 block sm:hidden">Start</span>
                             <input 
                                 type="time" 
                                 required 
                                 value={startTime} 
                                 onChange={e => setStartTime(e.target.value)} 
                                 className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-white text-slate-900 dark:text-slate-900 text-sm" 
                             />
                         </div>
                         <div className="flex-1">
                             <span className="text-[10px] text-slate-400 font-bold uppercase mb-1 block sm:hidden">End</span>
                             <input 
                                 type="time" 
                                 required 
                                 value={endTime} 
                                 onChange={e => setEndTime(e.target.value)} 
                                 className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-white text-slate-900 dark:text-slate-900 text-sm" 
                             />
                         </div>
                    </div>
                </div>
            </div>

            {/* Notes & Files */}
            <div className="grid grid-cols-1 gap-4">
                <div>
                     <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Session Notes</label>
                     <textarea
                        rows={3}
                        value={sessionNotes}
                        onChange={(e) => setSessionNotes(e.target.value)}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-white text-slate-900 dark:text-slate-900 focus:border-primary text-sm"
                        placeholder="Observations..."
                     />
                </div>
                
                {/* File Attachments */}
                <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Attachments</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                        {attachments.map(att => (
                            <div key={att.id} className="relative w-16 h-16 rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 flex items-center justify-center group overflow-hidden">
                                {att.type === 'IMAGE' ? (
                                    <img src={att.data} alt="preview" className="w-full h-full object-cover" />
                                ) : (
                                    <DocumentIcon className="w-8 h-8 text-red-400" />
                                )}
                                <button type="button" onClick={() => removeAttachment(att.id)} className="absolute top-0 right-0 bg-red-500 text-white w-4 h-4 flex items-center justify-center text-[10px] rounded-bl opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                            </div>
                        ))}
                        <label className={`w-16 h-16 rounded border-2 border-dashed border-slate-300 dark:border-slate-500 flex items-center justify-center cursor-pointer hover:border-primary hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {isUploading ? (
                                <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <PaperClipIcon className="w-5 h-5 text-slate-400 dark:text-slate-300" />
                            )}
                            <input type="file" onChange={handleFileChange} className="hidden" disabled={isUploading} />
                        </label>
                    </div>
                </div>
            </div>

            </form>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-3 bg-white dark:bg-slate-800 rounded-b-2xl shrink-0">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-bold">Cancel</button>
            
            {activeTab === 'CURRENT' && (
                <>
                    {/* Standard Save */}
                    <button 
                        type="submit" 
                        form="session-form" 
                        disabled={isUploading}
                        className="flex-1 px-4 py-2 rounded-lg bg-white border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isUploading ? 'Uploading...' : 'Save Progress'}
                    </button>

                    {/* Complete Target Button (Only for Planned Items) */}
                    {planContext && (
                        <button 
                            type="button" 
                            onClick={(e) => handleSubmit(e, true)} 
                            disabled={isUploading}
                            className="flex-[2] px-4 py-2 rounded-lg bg-primary text-white hover:bg-indigo-600 shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <CheckCircleIcon className="w-4 h-4" /> {isUploading ? 'Uploading...' : 'Complete Target'}
                        </button>
                    )}
                </>
            )}
        </div>
      </div>
    </div>
  );
};

export default SessionModal;