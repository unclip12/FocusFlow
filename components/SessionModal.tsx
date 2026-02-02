
import React, { useState, useEffect } from 'react';
// FIX: Replaced DEFAULT_INTERVALS with REVISION_SCHEDULE
import { StudySession, CATEGORIES, ToDoItem, SYSTEMS, KnowledgeBaseEntry, StudyLog, getAdjustedDate, Attachment } from '../types';
import { SparklesIcon, BookOpenIcon, ListCheckIcon, XMarkIcon, PlusIcon, DatabaseIcon, CheckCircleIcon, HistoryIcon, PencilSquareIcon, TrashIcon, PaperClipIcon, PhotoIcon, DocumentIcon } from './Icons';
import { generateStudyChecklist } from '../services/geminiService';
// import { uploadFile } from '../services/firebase'; // Removed

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
  defaultLogType?: 'INITIAL' | 'REVISION'; // NEW PROP
}

const SessionModal: React.FC<SessionModalProps> = ({ isOpen, onClose, onSave, initialData, prefillData, knowledgeBase = [], planContext, defaultLogType = 'INITIAL' }) => {
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
  // const [isUploading, setIsUploading] = useState(false); // Removed
  
  // Anki Stats (Global)
  const [ankiCovered, setAnkiCovered] = useState<number>(0);
  const [ankiTotal, setAnkiTotal] = useState<number>(0);

  // To-Do List (Global Session)
  const [toDoList, setToDoList] = useState<ToDoItem[]>([]);
  const [newToDo, setNewToDo] = useState('');

  // AI Planner
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiChecklist, setAiChecklist] = useState<string[]>([]);

  // Log Type Toggle (Initial vs Revision)
  const [logType, setLogType] = useState<'INITIAL' | 'REVISION'>(defaultLogType || 'INITIAL');

  // Plan Sync State
  const [planSubTasks, setPlanSubTasks] = useState<ToDoItem[]>([]);
  const [markPlanFinished, setMarkPlanFinished] = useState(false);

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
        // Defaults
        const now = new Date();
        const end = new Date(now.getTime() + 60 * 60000); // 1h default
        
        setStartTime(now.toTimeString().slice(0, 5));
        setEndTime(end.toTimeString().slice(0, 5));
        setDate(getAdjustedDate(now));
        
        // Reset local state
        setSessionNotes('');
        setAnkiSessionDelta(0);
        setAttachments([]);
        setAiChecklist([]);
        setLogType(defaultLogType || 'INITIAL');
        
        // Load Plan Context
        if (planContext) {
            setPlanSubTasks(planContext.subTasks);
            setMarkPlanFinished(false);
        } else {
            setPlanSubTasks([]);
        }

        if (initialData) {
            // Edit Mode
            setTopic(initialData.topic);
            setPageNumber(initialData.pageNumber);
            setCategory(initialData.category);
            setSystem(initialData.system || SYSTEMS[0]);
            setNotes(initialData.notes || '');
            setToDoList(initialData.toDoList || []);
            setAnkiCovered(initialData.ankiCovered || 0);
            setAnkiTotal(initialData.ankiTotal || 0);
        } else if (prefillData) {
            // New Session from Dashboard/Plan
            setTopic(prefillData.topic || '');
            setPageNumber(prefillData.pageNumber || '');
            setCategory(prefillData.category || CATEGORIES[0]);
            setSystem(prefillData.system || SYSTEMS[0]);
            setAnkiTotal(prefillData.ankiTotal || 0);
            setAnkiCovered(prefillData.ankiCovered || 0);
            
            // Auto-load existing knowledge base data if match found
            const existing = knowledgeBase.find(k => k.pageNumber === prefillData.pageNumber);
            if (existing) {
                setNotes(existing.notes);
                setCategory(existing.subject);
                setSystem(existing.system);
                setAnkiTotal(existing.ankiTotal);
                setAnkiCovered(existing.ankiCovered);
                // If existing, default to revision unless prefill says otherwise
                if (!defaultLogType) setLogType('REVISION');
            } else {
                setNotes('');
            }
        } else {
            // Clean New
            setTopic('');
            setPageNumber('');
            setCategory(CATEGORIES[0]);
            setSystem(SYSTEMS[0]);
            setNotes('');
            setToDoList([]);
            setAnkiTotal(0);
            setAnkiCovered(0);
        }
    }
  }, [isOpen, initialData, prefillData, knowledgeBase, planContext, defaultLogType]);

  const handleGeneratePlan = async () => {
      if (!topic) return;
      setIsGenerating(true);
      // Determine duration
      const start = new Date(`2000-01-01T${startTime}`);
      const end = new Date(`2000-01-01T${endTime}`);
      let diff = (end.getTime() - start.getTime()) / 60000;
      if (diff < 0) diff += 1440; // overnight
      
      const checklist = await generateStudyChecklist(topic, diff);
      setAiChecklist(checklist);
      setIsGenerating(false);
  };

  /* REMOVED UPLOAD HANDLER
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      // Disabled
  };
  */

  const handleSave = () => {
      // Calculate duration
      const startD = new Date(`${date}T${startTime}`);
      let endD = new Date(`${date}T${endTime}`);
      if (endD < startD) endD.setDate(endD.getDate() + 1);
      
      const duration = Math.round((endD.getTime() - startD.getTime()) / 60000);

      // Create log entry
      const logEntry: StudyLog = {
          id: generateId(),
          date: new Date().toISOString(), // creation timestamp
          startTime: startD.toISOString(),
          endTime: endD.toISOString(),
          durationMinutes: duration,
          type: logType,
          notes: sessionNotes,
          ankiDelta: ankiSessionDelta,
          subTasksCompleted: planSubTasks.filter(t => t.done).map(t => t.id),
          attachments: attachments
      };

      // Construct session object
      const sessionData: any = {
          topic,
          pageNumber,
          category,
          system,
          notes, // Global notes updated
          toDoList, // Global todos updated
          ankiCovered, // Global anki state
          ankiTotal,
          history: [logEntry], // Send as array, parent will merge
      };

      // Plan Updates
      const planUpdates = planContext ? {
          completedSubTaskIds: planSubTasks.filter(t => t.done).map(t => t.id),
          isFinished: markPlanFinished
      } : undefined;

      onSave({ ...sessionData, planUpdates });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[95vh]">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl text-white shadow-md ${logType === 'INITIAL' ? 'bg-indigo-500' : 'bg-green-500'}`}>
                        {logType === 'INITIAL' ? <BookOpenIcon className="w-5 h-5" /> : <HistoryIcon className="w-5 h-5" />}
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                            {initialData ? 'Edit Session' : (logType === 'INITIAL' ? 'Log New Study' : 'Log Revision')}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"><XMarkIcon className="w-6 h-6" /></button>
            </div>

            {/* Content Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950/50">
                
                {/* Core Info */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex gap-4 mb-4">
                        <div className="w-24">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Page #</label>
                            <input 
                                value={pageNumber}
                                onChange={e => setPageNumber(e.target.value)}
                                className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl font-bold text-lg text-center outline-none focus:border-indigo-500"
                                placeholder="000"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Topic</label>
                            <input 
                                value={topic}
                                onChange={e => setTopic(e.target.value)}
                                className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl font-bold text-lg outline-none focus:border-indigo-500"
                                placeholder="e.g. Cardio Physiology"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">System</label>
                            <select 
                                value={system} 
                                onChange={e => setSystem(e.target.value)}
                                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium outline-none"
                            >
                                {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Subject</label>
                            <select 
                                value={category} 
                                onChange={e => setCategory(e.target.value)}
                                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium outline-none"
                            >
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Time & Log Type */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <label className="text-xs font-bold text-slate-500 uppercase">Session Time</label>
                        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                            <button 
                                onClick={() => setLogType('INITIAL')}
                                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${logType === 'INITIAL' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-white' : 'text-slate-400'}`}
                            >
                                First Study
                            </button>
                            <button 
                                onClick={() => setLogType('REVISION')}
                                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${logType === 'REVISION' ? 'bg-white dark:bg-slate-700 shadow-sm text-green-600 dark:text-white' : 'text-slate-400'}`}
                            >
                                Revision
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <input 
                            type="time" 
                            value={startTime} 
                            onChange={e => setStartTime(e.target.value)}
                            className="flex-1 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-center font-bold outline-none"
                        />
                        <span className="text-slate-300">➜</span>
                        <input 
                            type="time" 
                            value={endTime} 
                            onChange={e => setEndTime(e.target.value)}
                            className="flex-1 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-center font-bold outline-none"
                        />
                    </div>
                </div>

                {/* Optional Plan Tasks */}
                {planContext && (
                    <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                        <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-3 flex items-center gap-2">
                            <ListCheckIcon className="w-4 h-4" /> From Today's Plan
                        </h4>
                        <div className="space-y-2 mb-3">
                            {planSubTasks.map((task, idx) => (
                                <label key={task.id} className="flex items-center gap-3 p-2 bg-white dark:bg-slate-800 rounded-lg border border-blue-100 dark:border-blue-900/30 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={task.done}
                                        onChange={() => {
                                            const newTasks = [...planSubTasks];
                                            newTasks[idx].done = !newTasks[idx].done;
                                            setPlanSubTasks(newTasks);
                                        }}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    <span className={`text-sm ${task.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>{task.text}</span>
                                </label>
                            ))}
                        </div>
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={markPlanFinished}
                                onChange={e => setMarkPlanFinished(e.target.checked)}
                                className="w-4 h-4 rounded text-green-600 focus:ring-green-500"
                            />
                            Mark entire plan item as FINISHED
                        </label>
                    </div>
                )}

                {/* Session Notes & Attachments */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Session Notes</label>
                        <button onClick={handleGeneratePlan} disabled={isGenerating || !topic} className="text-[10px] font-bold text-purple-600 flex items-center gap-1 hover:bg-purple-50 px-2 py-1 rounded transition-colors disabled:opacity-50">
                            <SparklesIcon className="w-3 h-3" /> {isGenerating ? 'Generating...' : 'AI Suggestions'}
                        </button>
                    </div>
                    
                    {aiChecklist.length > 0 && (
                        <div className="mb-3 p-3 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-900/30">
                            <p className="text-[10px] font-bold text-purple-400 mb-2 uppercase">Suggested Checklist</p>
                            <ul className="space-y-1">
                                {aiChecklist.map((item, i) => (
                                    <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                                        <span className="text-purple-400">•</span> {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <textarea 
                        value={sessionNotes} 
                        onChange={e => setSessionNotes(e.target.value)}
                        className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm min-h-[100px] outline-none focus:border-indigo-500 mb-3"
                        placeholder="What did you cover? Key takeaways..."
                    />

                    {/* Attachments (View Only for now, removed Add button) */}
                    <div className="flex flex-wrap gap-2">
                        {attachments.map(att => (
                            <div key={att.id} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center">
                                {att.type === 'IMAGE' ? (
                                    <img src={att.data} className="w-full h-full object-cover" />
                                ) : (
                                    <DocumentIcon className="w-8 h-8 text-red-400" />
                                )}
                                <button 
                                    onClick={() => setAttachments(attachments.filter(a => a.id !== att.id))}
                                    className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <XMarkIcon className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex gap-3 shrink-0 bg-white dark:bg-slate-900 rounded-b-3xl">
                <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm">Cancel</button>
                <button onClick={handleSave} className="flex-[2] py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-colors text-sm flex items-center justify-center gap-2">
                    <CheckCircleIcon className="w-5 h-5" /> Save Session
                </button>
            </div>
        </div>
    </div>
  );
};

export default SessionModal;
