

import React, { useState, useEffect } from 'react';
import { StudyPlanItem, KnowledgeBaseEntry, VideoResource, ToDoItem, getAdjustedDate, Attachment } from '../types';
import { CalendarPlusIcon, VideoIcon, LinkIcon, CheckCircleIcon, PlusIcon, FireIcon, PlayIcon, PencilSquareIcon, HistoryIcon, ChevronDownIcon, ListCheckIcon, TrashIcon, SparklesIcon, PaperClipIcon, DocumentIcon, BookOpenIcon, RepeatIcon, SpeakerWaveIcon, StopCircleIcon } from './Icons';
import { parseStudyRequest, speakText } from '../services/geminiService';
import { PageBadge } from './PageBadge';
import { uploadFile } from '../services/firebase';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

// Robust ID generator fallback
const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

interface PlannerViewProps {
  plan: StudyPlanItem[];
  knowledgeBase: KnowledgeBaseEntry[];
  sessions: any[];
  onAddToPlan: (item: Omit<StudyPlanItem, 'id'>, newVideo?: VideoResource, attachments?: Attachment[]) => void;
  onUpdatePlanItem: (item: StudyPlanItem) => void;
  onCompleteTask: (item: StudyPlanItem) => void;
  onStartTask: (item: StudyPlanItem) => void;
  onManageSession: (session: any) => void;
  onToggleSubTask: (planId: string, subTaskId: string) => void;
  onDeleteLog: (planId: string, logId: string) => void;
  onViewPage: (page: string) => void;
  sharedContent?: string | null; // New prop for PWA shared content
}

const formatMinutes = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

interface PlanItemCardProps {
    item: StudyPlanItem;
    onComplete: () => void;
    onEdit: () => void;
    onStart: () => void;
    onManageSession: () => void;
    onToggleSubTask: (subTaskId: string) => void;
    onDeleteLog: (logId: string) => void;
    isOverdue?: boolean;
    linkedSession?: KnowledgeBaseEntry;
    onViewPage: (page: string) => void;
    knowledgeBase: KnowledgeBaseEntry[];
}

const PlannerView: React.FC<PlannerViewProps> = ({ 
    plan, knowledgeBase, sessions, onAddToPlan, onUpdatePlanItem, onCompleteTask, onStartTask, onManageSession, onToggleSubTask, onDeleteLog, onViewPage, sharedContent 
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StudyPlanItem | null>(null);
  
  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [pageNumber, setPageNumber] = useState('');
  const [topic, setTopic] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(60);
  const [ankiCount, setAnkiCount] = useState(0);
  
  // Sub-tasks for Plan
  const [subTasks, setSubTasks] = useState<ToDoItem[]>([]);
  const [newSubTask, setNewSubTask] = useState('');
  
  // Video specific
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // UI State
  const [isResourcesExpanded, setIsResourcesExpanded] = useState(false);

  // AI Input State
  const [aiInput, setAiInput] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const inputBaseClass = "w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-white text-slate-900 dark:text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-base sm:text-sm";

  // Handle Shared Content from PWA
  useEffect(() => {
      if (sharedContent) {
          setEditingItem(null);
          setIsFormOpen(true);
          // Simple heuristic: check if it looks like a URL
          if (sharedContent.startsWith('http')) {
              setVideoUrl(sharedContent);
              setVideoTitle('Shared Link');
              setIsResourcesExpanded(true);
          } else {
              setTopic(sharedContent);
          }
      }
  }, [sharedContent]);

  // Auto-fill effect
  useEffect(() => {
    if (!editingItem) {
        const kbEntry = knowledgeBase.find(k => k.pageNumber === pageNumber);
        if (kbEntry) {
            if (!topic) setTopic(kbEntry.title);
            if (ankiCount === 0 && kbEntry.ankiTotal) setAnkiCount(kbEntry.ankiTotal);
        }
    }
  }, [pageNumber, knowledgeBase, topic, ankiCount, editingItem]);

  useEffect(() => {
      if (editingItem) {
          setDate(editingItem.date);
          setPageNumber(editingItem.pageNumber);
          setTopic(editingItem.topic);
          setEstimatedMinutes(editingItem.estimatedMinutes);
          setAnkiCount(editingItem.ankiCount || 0);
          setVideoUrl(editingItem.videoUrl || '');
          setSubTasks(editingItem.subTasks || []);
          setAttachments(editingItem.attachments || []);
          // Expand resources if there are any
          if (editingItem.videoUrl || (editingItem.attachments && editingItem.attachments.length > 0)) {
              setIsResourcesExpanded(true);
          } else {
              setIsResourcesExpanded(false);
          }
      } else {
          // Reset
          setDate(getAdjustedDate(new Date()));
          setPageNumber('');
          setTopic(sharedContent && !sharedContent.startsWith('http') ? sharedContent : ''); // Preserve shared topic if any
          setEstimatedMinutes(60);
          setAnkiCount(0);
          setVideoUrl(sharedContent && sharedContent.startsWith('http') ? sharedContent : '');
          setVideoTitle(sharedContent && sharedContent.startsWith('http') ? 'Shared Link' : '');
          setSubTasks([]);
          setNewSubTask('');
          setAttachments([]);
          setIsResourcesExpanded(false);
      }
  }, [editingItem, sharedContent]);

  const handleAddSubTask = () => {
      if (!newSubTask.trim()) return;
      setSubTasks(prev => [...prev, { id: generateId(), text: newSubTask, done: false }]);
      setNewSubTask('');
  };

  const removeSubTask = (id: string) => {
      setSubTasks(prev => prev.filter(t => t.id !== id));
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
              // Attempt upload to Cloud Storage
              const url = await uploadFile(file);
              
              const newAttachment: Attachment = {
                  id: generateId(),
                  name: file.name,
                  type: type,
                  data: url // Store URL
              };
              setAttachments(prev => [...prev, newAttachment]);

          } catch (error) {
              console.warn("Cloud upload failed, falling back to local base64", error);
              // Fallback to FileReader (Base64)
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

  // --- AI HANDLERS ---
  const handleVoiceInput = () => {
      if (!('webkitSpeechRecognition' in window)) {
          alert("Speech recognition not supported in this browser.");
          return;
      }
      
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      
      recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setAiInput(transcript);
          handleAiProcess(transcript);
      };
      
      recognition.start();
  };

  const handleAiProcess = async (inputText?: string) => {
      const textToProcess = inputText || aiInput;
      if (!textToProcess.trim()) return;

      setIsAiProcessing(true);
      try {
          const result = await parseStudyRequest(textToProcess);
          if (result) {
              setEditingItem(null); // Ensure new mode
              setIsFormOpen(true); // Open form to confirm
              
              if (result.pageNumber) setPageNumber(result.pageNumber);
              if (result.topic) setTopic(result.topic);
              if (result.duration) setEstimatedMinutes(result.duration);
              if (result.ankiCount) setAnkiCount(result.ankiCount);
              if (result.videoUrl) {
                  setVideoUrl(result.videoUrl);
                  setVideoTitle(result.topic ? `Video: ${result.topic}` : "Study Video");
                  setIsResourcesExpanded(true);
              }
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsAiProcessing(false);
          setAiInput('');
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return; // Prevent submit while uploading
    
    if (editingItem) {
        onUpdatePlanItem({
            ...editingItem,
            date,
            type: 'HYBRID',
            pageNumber,
            topic,
            estimatedMinutes,
            ankiCount,
            videoUrl: videoUrl || undefined,
            subTasks: subTasks,
            attachments: attachments
        });
        setEditingItem(null);
    } else {
        let newVideo: VideoResource | undefined = undefined;
        if (videoUrl) {
            newVideo = {
                id: generateId(),
                title: videoTitle || `Video for Pg ${pageNumber}`,
                url: videoUrl
            };
        }

        onAddToPlan({
            date,
            type: 'HYBRID',
            pageNumber,
            topic: topic || `Page ${pageNumber}`,
            videoUrl: videoUrl || undefined,
            ankiCount: ankiCount > 0 ? ankiCount : undefined,
            estimatedMinutes,
            isCompleted: false,
            subTasks: subTasks,
            logs: [],
            totalMinutesSpent: 0
        }, newVideo, attachments);
    }
    
    setIsFormOpen(false);
  };

  const todayStr = getAdjustedDate(new Date());

  const todaysTargets = plan.filter(p => {
      if (p.isCompleted && p.date < todayStr) return false; 
      if (p.date === todayStr) return true; 
      if (p.date < todayStr && !p.isCompleted) return true; 
      return false;
  }).sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.pageNumber.localeCompare(b.pageNumber);
  });

  const revisionsDue = knowledgeBase.filter(s => 
      s.nextRevisionAt && new Date(s.nextRevisionAt).toLocaleDateString('en-CA') <= todayStr
  );

  const upcomingPlan = plan.filter(p => p.date > todayStr);

  return (
    <div className="animate-fade-in space-y-8">
        
        {/* AI Assistant Section */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 shadow-lg text-white">
             <div className="flex items-center gap-2 mb-3">
                 <SparklesIcon className="w-5 h-5 text-yellow-300" />
                 <h2 className="font-bold text-lg">AI Study Assistant</h2>
             </div>
             <p className="text-indigo-100 text-sm mb-4">Tell me your plan naturally. E.g., "Study page 450, watch this video https://..., 20 mins"</p>
             
             <div className="relative">
                 <input 
                    type="text" 
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAiProcess()}
                    placeholder="Type your plan here..."
                    className="w-full p-4 pr-24 rounded-xl bg-white/10 border border-white/20 placeholder-indigo-200 text-white focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 backdrop-blur-sm transition-all text-base sm:text-sm"
                 />
                 <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-2">
                     <button 
                        onClick={handleVoiceInput}
                        className={`p-2 rounded-lg transition-all ${isListening ? 'bg-red-500 animate-pulse' : 'bg-white/10 hover:bg-white/20'}`}
                        title="Voice Input"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                        </svg>
                     </button>
                     <button 
                        onClick={() => handleAiProcess()}
                        disabled={isAiProcessing}
                        className="p-2 bg-white text-indigo-600 rounded-lg font-bold shadow-md hover:bg-indigo-50 transition-all disabled:opacity-50"
                     >
                        {isAiProcessing ? (
                            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <ChevronDownIcon className="w-5 h-5 -rotate-90" />
                        )}
                     </button>
                 </div>
             </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <CalendarPlusIcon className="w-6 h-6 text-primary" />
                    Today's Targets
                </h2>
            </div>
            <button 
                onClick={() => { setEditingItem(null); setIsFormOpen(true); }} 
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-sm font-bold w-full sm:w-auto justify-center"
            >
                <PlusIcon className="w-4 h-4" /> Manual Add
            </button>
        </div>

        {/* Add/Edit Modal */}
        {isFormOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg animate-fade-in-up max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-700">
                    
                    <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-700 shrink-0">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">{editingItem ? 'Edit Target' : 'Add New Target'}</h3>
                        <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl leading-none">&times;</button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-6">
                        {/* ... (Form fields remain unchanged) ... */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Core Details</h4>
                            <div className="grid grid-cols-3 gap-3">
                                 <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Date</label>
                                    <input 
                                        type="date" 
                                        value={date} 
                                        onChange={e => setDate(e.target.value)} 
                                        className={inputBaseClass}
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Page #</label>
                                    <input 
                                        type="text" 
                                        value={pageNumber} 
                                        onChange={e => setPageNumber(e.target.value)} 
                                        className={`${inputBaseClass} font-bold`} 
                                        placeholder="455"
                                        required 
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Topic / Title</label>
                                <input 
                                    type="text" 
                                    value={topic} 
                                    onChange={e => setTopic(e.target.value)} 
                                    className={inputBaseClass} 
                                    placeholder="e.g., Cardio Physiology – preload & afterload"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                             <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Sub-tasks</label>
                             <div className="space-y-2">
                                 {subTasks.map(t => (
                                     <div key={t.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-700/50 px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-700 text-sm">
                                         <span className="text-slate-800 dark:text-slate-200 truncate">{t.text}</span>
                                         <button type="button" onClick={() => removeSubTask(t.id)} className="text-slate-400 hover:text-red-500 ml-2">&times;</button>
                                     </div>
                                 ))}
                             </div>
                             <div className="flex gap-2">
                                 <input 
                                    type="text" 
                                    value={newSubTask} 
                                    onChange={e => setNewSubTask(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSubTask())}
                                    className={inputBaseClass}
                                    placeholder="e.g. Read FA p.455 once, then do questions" 
                                />
                                <button type="button" onClick={handleAddSubTask} className="px-3 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg font-bold hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200">+</button>
                             </div>
                        </div>

                        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                            <button 
                                type="button"
                                onClick={() => setIsResourcesExpanded(!isResourcesExpanded)} 
                                className="w-full flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 font-bold text-xs uppercase text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <span>Resources & Sync</span>
                                <ChevronDownIcon className={`w-4 h-4 transition-transform ${isResourcesExpanded ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {isResourcesExpanded && (
                                <div className="p-4 space-y-4 bg-white dark:bg-slate-900/20 border-t border-slate-200 dark:border-slate-700">
                                    <div className="space-y-2">
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1"><VideoIcon className="w-3 h-3"/> Video Link</label>
                                        <input type="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} className={inputBaseClass} placeholder="https://..." />
                                        {videoUrl && (
                                            <input type="text" value={videoTitle} onChange={e => setVideoTitle(e.target.value)} className={inputBaseClass} placeholder="Video Title" />
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-2"><PaperClipIcon className="w-3 h-3"/> Attachments (Synced to DB)</label>
                                        <div className="flex flex-wrap gap-2">
                                            {attachments.map(att => (
                                                <div key={att.id} className="relative w-12 h-12 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 flex items-center justify-center group overflow-hidden">
                                                    {att.type === 'IMAGE' ? <img src={att.data} alt="" className="w-full h-full object-cover rounded" /> : <DocumentIcon className="w-6 h-6 text-red-400" />}
                                                    <button type="button" onClick={() => removeAttachment(att.id)} className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">&times;</button>
                                                </div>
                                            ))}
                                            <label className={`w-full sm:w-auto px-4 py-3 rounded border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center gap-2 cursor-pointer hover:border-primary hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                {isUploading ? (
                                                    <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <PlusIcon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                                                )}
                                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Add PDF / Images</span>
                                                <input type="file" onChange={handleFileChange} className="hidden" disabled={isUploading} />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                             <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Progress Tracking</h4>
                             <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Est. Duration (Min)</label>
                                    <input type="number" value={estimatedMinutes} onChange={e => setEstimatedMinutes(parseInt(e.target.value))} className={inputBaseClass} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Anki Cards</label>
                                    <input type="number" value={ankiCount} onChange={e => setAnkiCount(parseInt(e.target.value))} className={inputBaseClass} placeholder="0" />
                                </div>
                            </div>
                        </div>
                    </form>

                    <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex gap-3 bg-slate-50 dark:bg-slate-800/50 shrink-0">
                        <button type="button" onClick={() => { setIsFormOpen(false); setEditingItem(null); }} className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-white dark:hover:bg-slate-700 transition-colors">
                            Cancel
                        </button>
                        <button 
                            onClick={handleSubmit} 
                            disabled={isUploading}
                            className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold text-sm shadow-md hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isUploading ? 'Uploading...' : (editingItem ? 'Update Target' : 'Add Target')}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* SPLIT VIEW: NEW STUDY vs REVISION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* COLUMN 1: NEW STUDY TARGETS */}
            <div className="space-y-4">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-lg border-b border-slate-100 dark:border-slate-700 pb-2">
                    <span className="w-2 h-6 bg-indigo-500 rounded-full"></span>
                    Study Plan
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        {todaysTargets.filter(p => !p.isCompleted).length} Pending
                    </span>
                </h3>
                
                <div className="space-y-3">
                    {todaysTargets.length > 0 ? todaysTargets.map(item => {
                         const linkedSession = knowledgeBase.find(s => s.pageNumber === item.pageNumber);
                         return (
                            <PlanItemCard 
                                key={item.id} 
                                item={item} 
                                onComplete={() => onCompleteTask(item)}
                                onEdit={() => { setEditingItem(item); setIsFormOpen(true); }}
                                onStart={() => onStartTask(item)}
                                onManageSession={() => linkedSession && onManageSession(linkedSession)}
                                onToggleSubTask={(tid) => onToggleSubTask(item.id, tid)}
                                onDeleteLog={(lid) => onDeleteLog(item.id, lid)}
                                isOverdue={item.date < todayStr && !item.isCompleted}
                                linkedSession={linkedSession}
                                onViewPage={onViewPage}
                                knowledgeBase={knowledgeBase}
                            />
                         );
                    }) : (
                        <div className="text-center p-8 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 border-dashed">
                            <BookOpenIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                            <p className="text-sm text-slate-400 dark:text-slate-500 italic">No new targets active. Use the AI Assistant!</p>
                        </div>
                    )}
                </div>

                {/* Upcoming List */}
                <div className="mt-8">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 text-sm uppercase tracking-wide text-slate-400">Upcoming Plans</h3>
                    <div className="space-y-3">
                        {upcomingPlan.length > 0 ? upcomingPlan.slice(0, 3).map(item => (
                             <PlanItemCard 
                                key={item.id} 
                                item={item} 
                                onComplete={() => onCompleteTask(item)}
                                onEdit={() => { setEditingItem(item); setIsFormOpen(true); }}
                                onStart={() => onStartTask(item)}
                                onManageSession={() => {}}
                                onToggleSubTask={(subTaskId) => {}}
                                onDeleteLog={(logId) => {}}
                                onViewPage={onViewPage}
                                knowledgeBase={knowledgeBase}
                            />
                        )) : (
                            <p className="text-xs text-slate-400 dark:text-slate-500 italic">No upcoming targets.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* COLUMN 2: DUE REVISIONS */}
            <div className="space-y-4">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-lg border-b border-slate-100 dark:border-slate-700 pb-2">
                    <span className="w-2 h-6 bg-amber-500 rounded-full"></span>
                    Due Revisions
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        {revisionsDue.length} Due
                    </span>
                </h3>
                {/* Revision Cards Rendering Logic */}
                <div className="space-y-3">
                    {revisionsDue.length > 0 ? revisionsDue.map(session => (
                        <div key={session.pageNumber} className="bg-white dark:bg-slate-800 rounded-xl border border-amber-100 dark:border-amber-900/50 shadow-sm p-4 relative hover:shadow-md transition-shadow group">
                            <div className="absolute top-0 left-0 w-1 h-full bg-amber-400 rounded-l-xl"></div>
                            <div className="pl-2">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                         <PageBadge 
                                            pageNumber={session.pageNumber} 
                                            attachments={knowledgeBase.find(k => k.pageNumber === session.pageNumber)?.attachments} 
                                            revisionCount={session.revisionCount}
                                            onClick={() => onViewPage(session.pageNumber)}
                                         />
                                        <div onClick={() => onViewPage(session.pageNumber)} className="cursor-pointer">
                                            <h4 className="font-bold text-slate-800 dark:text-slate-200">{session.title}</h4>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">{session.subject}</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => onStartTask({
                                            id: 'revision-temp',
                                            date: todayStr,
                                            type: 'PAGE',
                                            pageNumber: session.pageNumber,
                                            topic: `Revise: ${session.title}`,
                                            estimatedMinutes: 30, // default revision time
                                            isCompleted: false
                                        })}
                                        className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                                        title="Start Revision"
                                    >
                                        <RepeatIcon className="w-5 h-5" />
                                    </button>
                                </div>
                                
                                <div className="mt-3 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                                    {session.ankiTotal && (
                                        <div className="flex items-center gap-1">
                                            <FireIcon className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                                            <span>{session.ankiCovered}/{session.ankiTotal} Cards</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1">
                                        <HistoryIcon className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                                        <span>Studied {session.lastStudiedAt ? new Date(session.lastStudiedAt).toLocaleDateString() : 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center p-8 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 border-dashed">
                            <CheckCircleIcon className="w-8 h-8 text-green-300 dark:text-green-600 mx-auto mb-2" />
                            <p className="text-sm text-slate-400 dark:text-slate-500 italic">No revisions due today. Great job!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

const PlanItemCard: React.FC<PlanItemCardProps> = ({ 
    item, 
    onComplete, 
    onEdit, 
    onStart, 
    onManageSession, 
    onToggleSubTask, 
    onDeleteLog,
    isOverdue, 
    linkedSession,
    onViewPage,
    knowledgeBase
}) => {
    const [expanded, setExpanded] = useState(false);
    const [logToDelete, setLogToDelete] = useState<string | null>(null);
    
    // TTS State
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [stopAudio, setStopAudio] = useState<(() => void) | null>(null);

    // Stats
    const completedSubTasks = item.subTasks?.filter(t => t.done).length || 0;
    const totalSubTasks = item.subTasks?.length || 0;
    const progress = totalSubTasks > 0 ? (completedSubTasks / totalSubTasks) * 100 : 0;
    const totalTime = item.totalMinutesSpent || 0;
    
    // Anki Progress from Session
    const ankiTotal = item.ankiCount || linkedSession?.ankiTotal || 0;
    const ankiCovered = linkedSession?.ankiCovered || 0;
    const ankiProgress = ankiTotal > 0 ? (ankiCovered / ankiTotal) * 100 : 0;

    // Resolve attachments for badge (from item + KB merge if needed, using KB as source of truth for general view)
    const kbEntry = knowledgeBase.find(k => k.pageNumber === item.pageNumber);
    const displayAttachments = item.attachments?.length ? item.attachments : (kbEntry?.attachments || []);
    const revisionCount = linkedSession?.revisionCount || 0;
    
    const handleSpeak = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isSpeaking) {
            if (stopAudio) stopAudio();
            setIsSpeaking(false);
            setStopAudio(null);
        } else {
            setIsSpeaking(true);
            const text = `Plan: ${item.topic}. Page ${item.pageNumber}. ${totalSubTasks} tasks pending.`;
            const stopFn = await speakText(text);
            setStopAudio(() => stopFn);
        }
    };

    return (
        <div className={`rounded-xl border transition-all ${
            item.isCompleted 
            ? 'bg-green-50/30 dark:bg-green-900/10 border-green-100 dark:border-green-900/30 shadow-sm' 
            : isOverdue 
                ? 'bg-amber-50/30 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30 shadow-sm hover:shadow-md' 
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md'
        }`}>
            <DeleteConfirmationModal 
                isOpen={!!logToDelete}
                onClose={() => setLogToDelete(null)}
                onConfirm={() => {
                    if (logToDelete) onDeleteLog(logToDelete);
                    setLogToDelete(null);
                }}
                title="Delete Session Log?"
            />

            {isOverdue && <div className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-3 py-1 uppercase tracking-wide rounded-t-xl border-b border-amber-200 dark:border-amber-900/50">Carried Forward (Due {item.date})</div>}
            
            <div className="p-4">
                <div className="flex items-start gap-3 sm:gap-4">
                    {/* New Page Badge - Prevent shrink */}
                    <div className="flex-shrink-0">
                        <PageBadge 
                            pageNumber={item.pageNumber} 
                            attachments={displayAttachments}
                            revisionCount={revisionCount}
                            onClick={() => onViewPage(item.pageNumber)}
                        />
                    </div>
                    
                    <div className="flex-grow min-w-0 cursor-pointer" onClick={() => onViewPage(item.pageNumber)}>
                        <div className="flex items-center gap-2 flex-wrap">
                            {item.videoUrl && (
                                <a href={item.videoUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-blue-500 hover:underline flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-900/50">
                                    <LinkIcon className="w-3 h-3" /> <span className="hidden sm:inline">Watch</span> Video
                                </a>
                            )}
                        </div>
                        <h4 className={`font-bold truncate transition-colors text-sm sm:text-base ${item.isCompleted ? 'text-slate-500 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200 group-hover:text-primary'}`}>{item.topic}</h4>
                        
                        {/* Progress Bar for Subtasks */}
                        {totalSubTasks > 0 && (
                            <div className="mt-2">
                                <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                                    <span>{completedSubTasks}/{totalSubTasks} Topics</span>
                                    <span>{Math.round(progress)}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className={`h-full transition-all duration-500 ${item.isCompleted ? 'bg-green-400' : 'bg-green-500'}`} style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                        )}

                        {/* Anki Progress Bar */}
                        {ankiTotal > 0 && (
                            <div className="mt-2">
                                <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                                    <span className="flex items-center gap-1"><FireIcon className="w-3 h-3 text-amber-500"/> Anki Cards</span>
                                    <span>{ankiCovered}/{ankiTotal}</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden border border-slate-200 dark:border-slate-600">
                                    <div className={`h-full transition-all duration-500 ${item.isCompleted ? 'bg-amber-300' : 'bg-amber-500'}`} style={{ width: `${ankiProgress}%` }}></div>
                                </div>
                            </div>
                        )}
                        
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>Plan: {formatMinutes(item.estimatedMinutes)}</span>
                            {(totalTime > 0 || item.isCompleted) && (
                                <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold">
                                    <HistoryIcon className="w-3 h-3" /> Done: {formatMinutes(totalTime)}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1 flex-shrink-0">
                        <div className="flex items-center gap-1">
                             <button onClick={onStart} className="p-2 bg-primary text-white rounded-lg shadow-md hover:bg-indigo-700 transition-colors" title="Log New Session / Add Time">
                                <PlayIcon className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={onComplete} 
                                className={`p-2 rounded-lg transition-colors ${
                                    item.isCompleted 
                                    ? 'text-green-600 bg-green-100 dark:bg-green-900/20 hover:bg-green-200 dark:hover:bg-green-900/40' 
                                    : 'text-slate-300 dark:text-slate-600 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/10'
                                }`} 
                                title={item.isCompleted ? "Mark Incomplete / Update" : "Quick Complete"}
                            >
                                <CheckCircleIcon className="w-5 h-5" />
                            </button>
                        </div>
                        
                         {/* TTS Button */}
                         <button 
                             onClick={handleSpeak}
                             className={`self-end mt-2 p-1.5 rounded transition-colors ${isSpeaking ? 'text-red-500 bg-red-50' : 'text-slate-300 dark:text-slate-600 hover:text-indigo-500'}`}
                             title="Read Plan Aloud"
                         >
                             {isSpeaking ? <StopCircleIcon className="w-4 h-4" /> : <SpeakerWaveIcon className="w-4 h-4" />}
                         </button>

                        <button onClick={() => setExpanded(!expanded)} className="self-end mt-1 text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400">
                            <ChevronDownIcon className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Expanded Detail View */}
            {expanded && (
                <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30 p-4 rounded-b-xl space-y-4 text-sm">
                     
                     {/* TIMESTAMPS DISPLAY */}
                     <div className="flex justify-between text-[10px] text-slate-400 uppercase font-bold">
                         <span>Created: {item.createdAt ? new Date(item.createdAt).toLocaleString([], { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : 'N/A'}</span>
                         {item.completedAt && <span className="text-green-500">Completed: {new Date(item.completedAt).toLocaleString([], { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</span>}
                     </div>

                     {/* Subtasks List */}
                     {item.subTasks && item.subTasks.length > 0 && (
                         <div>
                             <h5 className="font-bold text-slate-600 dark:text-slate-400 text-xs uppercase mb-2 flex items-center gap-1"><ListCheckIcon className="w-3 h-3"/> TASKS</h5>
                             <div className="space-y-1.5">
                                 {item.subTasks.map(t => (
                                     <label key={t.id} className="flex items-center gap-3 p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600 hover:shadow-sm cursor-pointer transition-all">
                                         <input 
                                            type="checkbox" 
                                            checked={t.done} 
                                            onChange={() => onToggleSubTask(t.id)}
                                            className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300"
                                         />
                                         <span className={`text-sm ${t.done ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>{t.text}</span>
                                     </label>
                                 ))}
                             </div>
                         </div>
                     )}
                     
                     {/* Attachments Viewer (Simplified as details are in badge) */}
                     {item.attachments && item.attachments.length > 0 && (
                         <div>
                             <h5 className="font-bold text-slate-600 dark:text-slate-400 text-xs uppercase mb-2 flex items-center gap-1"><PaperClipIcon className="w-3 h-3"/> Resources Added Today</h5>
                             <div className="flex flex-wrap gap-2">
                                {item.attachments.map(att => (
                                    <div key={att.id} className="relative w-12 h-12 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 flex items-center justify-center group">
                                        {att.type === 'IMAGE' ? (
                                            <img src={att.data} alt="" className="w-full h-full object-cover rounded" />
                                        ) : (
                                            <DocumentIcon className="w-6 h-6 text-red-400" />
                                        )}
                                    </div>
                                ))}
                             </div>
                         </div>
                     )}

                     {/* Session Logs */}
                     {item.logs && item.logs.length > 0 && (
                         <div>
                             <h5 className="font-bold text-slate-600 dark:text-slate-400 text-xs uppercase mb-2 flex items-center gap-1"><HistoryIcon className="w-3 h-3"/> SESSION HISTORY</h5>
                             <div className="space-y-2">
                                 {item.logs.map((log, idx) => {
                                     const startTimeStr = log.startTime ? new Date(log.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : null;
                                     const endTimeStr = log.endTime ? new Date(log.endTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : null;
                                     
                                     return (
                                        <div key={log.id} className="relative border-l-2 border-slate-200 dark:border-slate-600 pl-4 py-2 ml-2 hover:border-primary/50 transition-colors">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                                                        <span>#{idx + 1}</span>
                                                        <span className="text-slate-400 font-normal text-[10px]">{new Date(log.date).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                                                         {startTimeStr} - {endTimeStr}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                     <span className="font-bold text-xs text-slate-700 dark:text-slate-300">{formatMinutes(log.durationMinutes)}</span>
                                                     <button 
                                                        onClick={() => setLogToDelete(log.id)}
                                                        className="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                        title="Delete Log"
                                                    >
                                                        <TrashIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                     );
                                 })}
                             </div>
                         </div>
                     )}
                     
                     <div className="flex flex-wrap justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-600 mt-2">
                        {linkedSession && (
                             <button onClick={onManageSession} className="flex-grow sm:flex-grow-0 text-center text-xs text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors border border-indigo-200 dark:border-indigo-900/50 shadow-sm">
                                 Manage Session History
                             </button>
                        )}
                        <button onClick={onEdit} className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center gap-1 px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            <PencilSquareIcon className="w-3 h-3" /> Edit Target Details
                        </button>
                     </div>
                </div>
            )}
        </div>
    );
};

export default PlannerView;