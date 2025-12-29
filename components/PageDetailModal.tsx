
import React, { useState, useEffect, useMemo } from 'react';
import { KnowledgeBaseEntry, StudySession, Attachment, QuizQuestion, SYSTEMS, CATEGORIES, TrackableItem, AppSettings, RevisionSettings } from '../types';
import { BookOpenIcon, FireIcon, HistoryIcon, PaperClipIcon, PhotoIcon, DocumentIcon, VideoIcon, XMarkIcon, LightBulbIcon, PuzzlePieceIcon, CheckCircleIcon, ArrowRightIcon, SpeakerWaveIcon, StopCircleIcon, CalendarIcon, PencilSquareIcon, TrashIcon, PlusIcon, SparklesIcon, ArrowPathIcon, LinkIcon, ListCheckIcon } from './Icons';
import { AttachmentViewerModal } from './AttachmentViewerModal';
import { explainTopic, generateQuiz, speakText } from '../services/geminiService';
// import { uploadFile } from '../services/firebase'; // Removed
import { getData } from '../services/dbService';
import { CollapsibleTopic } from './KnowledgeBaseView'; 
import { syncAnkiToDb, openAnkiBrowser, AnkiStats, createStudySession } from '../services/ankiService';
import { SubtopicDetailModal } from './SubtopicDetailModal';
import { recalculateEntryStats } from '../services/faLoggerService';
import { getRevisionSettings } from '../services/firebase';

interface PageDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageNumber: string | null;
  knowledgeBase: KnowledgeBaseEntry[];
  sessions: StudySession[];
  onUpdateEntry: (entry: KnowledgeBaseEntry) => void;
}

const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

export const PageDetailModal: React.FC<PageDetailModalProps> = ({ isOpen, onClose, pageNumber, knowledgeBase, sessions, onUpdateEntry }) => {
  const [activeAttachment, setActiveAttachment] = useState<Attachment | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<KnowledgeBaseEntry | null>(null);

  // Subtopic Modal State
  const [viewingSubtopic, setViewingSubtopic] = useState<TrackableItem | null>(null);

  // New state for extended editing
  const [subtopicsInput, setSubtopicsInput] = useState('');
  const [keyPointsInput, setKeyPointsInput] = useState(''); 
  // const [isUploading, setIsUploading] = useState(false); // Removed

  // AI Features State
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanation, setExplanation] = useState('');
  
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [showQuizResult, setShowQuizResult] = useState(false);

  // TTS State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [stopSpeaking, setStopSpeaking] = useState<(() => void) | null>(null);

  // Anki Integration
  const [ankiStats, setAnkiStats] = useState<AnkiStats | null>(null);
  const [isSyncingAnki, setIsSyncingAnki] = useState(false);
  const [isMovingCards, setIsMovingCards] = useState(false); // For study session
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [revisionSettings, setRevisionSettings] = useState<RevisionSettings>({ mode: 'balanced', targetCount: 7 });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Load settings
      getData<AppSettings>('settings').then(s => s && setAppSettings(s));
      getRevisionSettings().then(s => s && setRevisionSettings(s));
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Calculate derived data unconditionally to satisfy Hook Rules
  const kbEntry = knowledgeBase.find(k => k.pageNumber === pageNumber);
  const session = sessions.find(s => s.pageNumber === pageNumber);

  const displayEntry = isEditing ? editForm : kbEntry;

  const topic = displayEntry?.title || session?.topic || 'Unknown Topic';
  const subject = displayEntry?.subject || session?.category || 'General';
  const system = displayEntry?.system || session?.system || 'General Principles';
  
  // Stats
  const revisionCount = displayEntry?.revisionCount || session?.history.filter(h => h.type === 'REVISION').length || 0;
  const lastStudied = displayEntry?.lastStudiedAt ? new Date(displayEntry.lastStudiedAt).toLocaleString([], { year: '2-digit', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : (session?.lastStudied ? new Date(session.lastStudied).toLocaleString([], { year: '2-digit', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : 'Never');
  const firstStudied = displayEntry?.firstStudiedAt ? new Date(displayEntry.firstStudiedAt).toLocaleString([], { year: '2-digit', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : 'Unknown';
  
  // Anki
  const ankiTotal = isEditing ? (editForm?.ankiTotal || 0) : (displayEntry?.ankiTotal || session?.ankiTotal || 0);
  const ankiCovered = isEditing ? (editForm?.ankiCovered || 0) : (displayEntry?.ankiCovered || session?.ankiCovered || 0);
  
  // Dynamic Tag Logic
  const generatedTag = appSettings?.ankiTagPrefix ? `${appSettings.ankiTagPrefix}${pageNumber}` : `FA_Page::${pageNumber}`;
  const ankiTag = displayEntry?.ankiTag || generatedTag;

  // Content
  const topics = displayEntry?.topics || [];
  const keyPoints = displayEntry?.keyPoints || [];
  const notes = isEditing ? editForm?.notes : (session?.notes || kbEntry?.notes || '');

  const baseRevisionCount = useMemo(() => {
      if (topics.length === 0) return revisionCount;
      return Math.min(...topics.map(t => t.revisionCount));
  }, [topics, revisionCount]);
  
  // AGGREGATED ATTACHMENTS (Page + Subtopics)
  const attachments = useMemo(() => {
      if (isEditing && editForm) {
          return editForm.attachments || [];
      }
      const pageAtts = kbEntry?.attachments || [];
      const subAtts = kbEntry?.topics?.flatMap(t => t.attachments || []) || [];
      return [...pageAtts, ...subAtts];
  }, [kbEntry, isEditing, editForm]);

  const videoLinks = displayEntry?.videoLinks || [];

  // Init Anki Stats on Open
  useEffect(() => {
      if (isOpen && appSettings && kbEntry) {
          // Auto-sync stats quietly if not editing
          syncAnkiToDb(appSettings, { ...kbEntry, ankiTag: kbEntry.ankiTag || generatedTag }, onUpdateEntry);
      }
  }, [isOpen, appSettings]);

  // --- EARLY RETURN MUST BE AFTER ALL HOOKS ---
  if (!isOpen || !pageNumber) return null;

  const handleStartEdit = () => {
    if (kbEntry) {
        setEditForm(JSON.parse(JSON.stringify(kbEntry))); // Deep copy
        setSubtopicsInput((kbEntry.topics || []).map(t => t.name).join('\n'));
        setKeyPointsInput((kbEntry.keyPoints || []).join('\n')); 
        setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
      setIsEditing(false);
      setEditForm(null);
      setSubtopicsInput('');
      setKeyPointsInput('');
      // setIsUploading(false);
  };
  
  const handleSaveEdit = () => {
    if (editForm) {
        const updatedSubTopicNames = subtopicsInput.split('\n').map(t => t.trim()).filter(t => t.length > 0);
        const existingTopics = editForm.topics || [];
        const updatedTopics: TrackableItem[] = updatedSubTopicNames.map(name => {
            const existing = existingTopics.find(t => t.name === name);
            if (existing) return existing;
            return {
                id: generateId(), name, revisionCount: 0, lastStudiedAt: null,
                nextRevisionAt: null, currentRevisionIndex: 0, logs: []
            };
        });

        const updatedKeyPoints = keyPointsInput.split('\n').map(k => k.trim()).filter(k => k.length > 0);

        const finalForm = { ...editForm, topics: updatedTopics, keyPoints: updatedKeyPoints };
        onUpdateEntry(finalForm);
        handleCancelEdit();
    }
  };

  const handleDeleteLog = (logId: string) => {
      // Source of truth
      const entry = isEditing && editForm ? editForm : kbEntry;
      if (!entry) return;

      if (confirm("Are you sure you want to delete this log entry?")) {
          const remainingLogs = entry.logs.filter(l => l.id !== logId);
          const tempEntry = { ...entry, logs: remainingLogs };
          
          // Recalculate stats with settings
          const updatedEntry = recalculateEntryStats(tempEntry, revisionSettings);
          
          // If editing, update the form state so it doesn't revert on save
          if (isEditing) {
              setEditForm(updatedEntry);
          }
          
          // Update the global store immediately
          onUpdateEntry(updatedEntry);
      }
  };

  const removeAttachment = (id: string) => {
    if (editForm) {
        setEditForm(prev => ({
            ...prev!,
            attachments: (prev!.attachments || []).filter(a => a.id !== id)
        }));
    }
  };


  const handleClose = () => {
      if (isEditing) {
          handleCancelEdit();
      }
      onClose();
  }

  // --- HANDLERS ---
  const handleExplain = async () => {
      if (explanation) return; 
      setIsExplaining(true);
      const text = await explainTopic(topic);
      setExplanation(text);
      setIsExplaining(false);
  };

  const handleSpeak = async () => {
      if (isSpeaking) {
          if (stopSpeaking) stopSpeaking();
          setIsSpeaking(false);
          setStopSpeaking(null);
      } else {
          setIsSpeaking(true);
          let textToRead = '';
          if (explanation) {
              textToRead = `Explanation for ${topic}. ${explanation}`;
          } else if (keyPoints.length > 0) {
              textToRead = `High Yield Key Points for ${topic}. ${keyPoints.join('. ')}`;
          } else {
              textToRead = `Topic: ${topic}. Subject: ${subject}. ${notes ? 'Notes: ' + notes : ''}`;
          }
            
          const stopFn = await speakText(textToRead);
          setStopSpeaking(() => stopFn);
      }
  };

  const handleStartQuiz = async () => {
      setIsQuizLoading(true);
      const qs = await generateQuiz(topic);
      if (qs.length > 0) {
          setQuizQuestions(qs);
          setIsQuizActive(true);
          setCurrentQuestionIndex(0);
          setQuizScore(0);
          setShowQuizResult(false);
          setSelectedOption(null);
      } else {
          alert("Could not generate quiz at this time.");
      }
      setIsQuizLoading(false);
  };

  const handleAnswer = (optionIndex: number) => {
      if (selectedOption !== null) return; 
      setSelectedOption(optionIndex);
      if (optionIndex === quizQuestions[currentQuestionIndex].correctAnswer) {
          setQuizScore(s => s + 1);
      }
  };

  const nextQuestion = () => {
      if (currentQuestionIndex < quizQuestions.length - 1) {
          setCurrentQuestionIndex(prev => prev + 1);
          setSelectedOption(null);
      } else {
          setShowQuizResult(true);
      }
  };

  const closeQuiz = () => {
      setIsQuizActive(false);
      setQuizQuestions([]);
      setShowQuizResult(false);
  };

  // --- ANKI HANDLERS ---

  const handleSyncAnki = async () => {
      if (!appSettings || !kbEntry) return;
      setIsSyncingAnki(true);
      const stats = await syncAnkiToDb(appSettings, { ...kbEntry, ankiTag }, onUpdateEntry);
      if (stats) setAnkiStats(stats);
      else alert("Failed to sync with Anki. Check if Anki is open on your host computer.");
      setIsSyncingAnki(false);
  };

  const handleStudyNow = async () => {
      if (!appSettings || !ankiTag || !pageNumber) return;
      setIsMovingCards(true);
      // Pass pageNumber to create specific deck
      const result = await createStudySession(appSettings, `tag:${ankiTag}`, pageNumber);
      if (result.success) {
          alert(`${result.count} cards moved to "FocusFlow::${pageNumber}" deck. Check Anki!`);
      } else {
          alert(`Failed: ${result.error}`);
      }
      setIsMovingCards(false);
  };

  const formatText = (text: string) => {
      const parts = text.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
              return <span key={idx} className="font-bold text-black dark:text-white">{part.slice(2, -2)}</span>;
          }
          return part;
      });
  };

  const handleUpdateSubtopic = (updatedSubtopic: TrackableItem) => {
      if (!kbEntry) return;
      const updatedTopics = kbEntry.topics.map(t => t.id === updatedSubtopic.id ? updatedSubtopic : t);
      const updatedEntry = { ...kbEntry, topics: updatedTopics };
      onUpdateEntry(updatedEntry);
      setViewingSubtopic(updatedSubtopic);
  };

  // Use the logs from the displayEntry (which respects editForm if editing)
  const logsToDisplay = displayEntry?.logs || [];

  return (
    <>
      {viewingSubtopic && kbEntry && (
          <SubtopicDetailModal 
              isOpen={!!viewingSubtopic}
              onClose={() => setViewingSubtopic(null)}
              subtopic={viewingSubtopic}
              parentEntry={kbEntry}
              onUpdate={handleUpdateSubtopic}
          />
      )}

      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={handleClose}>
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up border border-white/20 dark:border-slate-700/50" onClick={e => e.stopPropagation()}>
          
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-200/50 dark:border-slate-700/50 flex justify-between items-start shrink-0">
              <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-full shadow-md shadow-indigo-500/30">
                          PG {pageNumber}
                      </span>
                      {isEditing && editForm ? (
                        <>
                            <select value={editForm.subject} onChange={e => setEditForm({...editForm, subject: e.target.value})} className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border border-slate-300 dark:border-slate-600 px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none">
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                             <select value={editForm.system} onChange={e => setEditForm({...editForm, system: e.target.value})} className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border border-slate-300 dark:border-slate-600 px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none">
                                {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </>
                      ) : (
                        <>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border border-slate-300 dark:border-slate-600 px-2 py-0.5 rounded-full">
                                {subject}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border border-slate-300 dark:border-slate-600 px-2 py-0.5 rounded-full">
                                {system}
                            </span>
                        </>
                      )}
                  </div>
                  {isEditing && editForm ? (
                    <input 
                        type="text"
                        value={editForm.title}
                        onChange={e => setEditForm({...editForm, title: e.target.value})}
                        className="w-full text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight bg-transparent border-b-2 border-indigo-300 focus:outline-none"
                    />
                  ) : (
                    <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">{topic}</h2>
                  )}
                  
                  {/* AI Action Buttons */}
                  {!isEditing && (
                    <div className="flex gap-3 mt-4">
                        <button 
                          onClick={handleExplain}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 hover:scale-105 transition-transform"
                        >
                            <LightBulbIcon className="w-4 h-4" />
                            {isExplaining ? 'Analyzing...' : 'Deep Dive'}
                        </button>
                        <button 
                          onClick={handleStartQuiz}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold shadow-lg shadow-pink-500/20 hover:scale-105 transition-transform"
                        >
                            <PuzzlePieceIcon className="w-4 h-4" />
                            {isQuizLoading ? 'Generating...' : 'Quiz Me'}
                        </button>
                        <button 
                          onClick={handleSpeak}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-lg transition-all hover:scale-105 ${isSpeaking ? 'bg-red-500 shadow-red-500/20' : 'bg-slate-700 shadow-slate-700/20'}`}
                        >
                            {isSpeaking ? <StopCircleIcon className="w-4 h-4" /> : <SpeakerWaveIcon className="w-4 h-4" />}
                            {isSpeaking ? 'Stop' : 'Listen'}
                        </button>
                    </div>
                  )}
              </div>
              <div className="flex items-center gap-2">
                {!isEditing && (
                    <button onClick={handleStartEdit} className="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-full transition-colors" title="Edit Page Details">
                        <PencilSquareIcon className="w-6 h-6 text-slate-400" />
                    </button>
                )}
                <button onClick={handleClose} className="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-full transition-colors">
                    <XMarkIcon className="w-8 h-8 text-slate-400" />
                </button>
              </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto p-6 relative bg-white/40 dark:bg-slate-800/40">
              
              {/* AI Explanation Panel */}
              {explanation && (
                  <div className="mb-8 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl shadow-sm animate-fade-in">
                      <div className="flex justify-between items-start mb-3">
                          <h3 className="text-sm font-bold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                              <LightBulbIcon className="w-5 h-5" /> AI Explanation
                          </h3>
                          <button onClick={() => setExplanation('')} className="text-blue-400 hover:text-blue-600 text-xs font-bold uppercase tracking-wider">Close</button>
                      </div>
                      <div className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                          {formatText(explanation)}
                      </div>
                  </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  
                  {/* LEFT COL: Resources & Visuals */}
                  <div className="lg:col-span-2 space-y-6">
                      
                      {/* Key Points Section */}
                      <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 shadow-sm">
                           <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-3 flex items-center gap-2 tracking-wider">
                               <SparklesIcon className="w-4 h-4" /> High Yield Key Points
                           </h3>
                           {isEditing ? (
                               <textarea 
                                   value={keyPointsInput} 
                                   onChange={e => setKeyPointsInput(e.target.value)} 
                                   placeholder="Paste key points here (one per line)..." 
                                   className="w-full h-32 p-3 bg-white dark:bg-slate-800 rounded-xl text-sm border border-indigo-200 dark:border-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none shadow-inner" 
                               />
                           ) : keyPoints.length > 0 ? (
                               <ul className="space-y-2">
                                   {keyPoints.map((point, i) => (
                                       <li key={i} className="text-sm text-slate-800 dark:text-slate-200 flex items-start gap-3 leading-relaxed">
                                           <span className="text-indigo-500 mt-1 font-bold text-lg">•</span> 
                                           <span>{point}</span>
                                       </li>
                                   ))}
                               </ul>
                           ) : (
                               <div className="text-center py-4 border-2 border-dashed border-indigo-200 dark:border-indigo-900/30 rounded-xl bg-white/50 dark:bg-slate-800/50">
                                   <p className="text-sm text-indigo-400 italic">No key points added yet.</p>
                                   <p className="text-xs text-slate-400 mt-1">Use the AI Chatbot to extract them automatically!</p>
                               </div>
                           )}
                      </div>

                      {/* Attachments Gallery */}
                      <div>
                          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3 flex items-center gap-2 tracking-wider">
                              <PhotoIcon className="w-4 h-4" /> Visuals & Documents
                          </h3>
                          {isEditing && editForm ? (
                              <div className="space-y-3">
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                      {(editForm.attachments || []).map(att => (
                                          <div key={att.id} className="relative group aspect-video bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                              {att.type === 'IMAGE' ? <img src={att.data} alt={att.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><DocumentIcon className="w-8 h-8 text-red-400" /></div>}
                                              <button type="button" onClick={() => removeAttachment(att.id)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                                          </div>
                                      ))}
                                  </div>
                                  {/* UPLOAD BUTTON REMOVED */}
                              </div>
                          ) : attachments.length > 0 ? (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                  {attachments.map(att => (
                                      <div key={att.id} onClick={() => setActiveAttachment(att)} className="relative group aspect-video bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all">
                                          {att.type === 'IMAGE' ? <img src={att.data} alt={att.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center text-slate-400"><DocumentIcon className="w-10 h-10 mb-2 text-red-400" /><span className="text-[10px] uppercase font-bold">PDF Document</span></div>}
                                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                      </div>
                                  ))}
                              </div>
                          ) : (
                              <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-center text-slate-400 text-sm italic">
                                  No attachments synced to this page.
                              </div>
                          )}
                      </div>

                      {/* Subtopics Covered - Expanded to Full Width */}
                      <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-md p-5 rounded-2xl border border-white/40 dark:border-slate-700 shadow-sm">
                           <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-1 tracking-wider">
                               <BookOpenIcon className="w-3 h-3" /> Subtopics Covered
                           </h3>
                           {isEditing ? (
                               <textarea value={subtopicsInput} onChange={e => setSubtopicsInput(e.target.value)} placeholder="One subtopic per line..." className="w-full h-32 p-3 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm border-slate-200 dark:border-slate-600 focus:ring-1 focus:ring-indigo-500 outline-none" />
                           ) : topics.length > 0 ? (
                               <div className="space-y-1">
                                   {topics.map((topic, i) => (
                                       <CollapsibleTopic 
                                            key={i} 
                                            topic={topic}
                                            baseRevisionCount={baseRevisionCount}
                                            onOpenModal={() => setViewingSubtopic(topic)}
                                            highlight=""
                                       />
                                   ))}
                               </div>
                           ) : (
                               <p className="text-sm text-slate-400 italic">No subtopics defined.</p>
                           )}
                      </div>

                      {/* Persistent Notes */}
                      {isEditing || notes ? (
                          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-md p-5 rounded-2xl border border-white/40 dark:border-slate-700 shadow-sm">
                              <h3 className="text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">My Notes</h3>
                              {isEditing && editForm ? (
                                <textarea 
                                    value={editForm.notes}
                                    onChange={e => setEditForm({...editForm, notes: e.target.value})}
                                    placeholder="Add persistent notes for this page..."
                                    className="w-full h-24 p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm border-slate-200 dark:border-slate-600 focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                              ) : (
                                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-medium">{notes}</p>
                              )}
                          </div>
                      ) : null}

                       {/* Video Links */}
                       {videoLinks.length > 0 && (
                          <div className="space-y-2">
                               <h3 className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1 tracking-wider">
                                   <VideoIcon className="w-3 h-3" /> Linked Videos
                               </h3>
                               {videoLinks.map(v => (
                                   <a key={v.id} href={v.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-900/30 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors group backdrop-blur-sm">
                                       <div className="w-8 h-8 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-blue-500 shadow-sm group-hover:scale-110 transition-transform">
                                           <VideoIcon className="w-4 h-4" />
                                       </div>
                                       <span className="text-sm font-bold text-blue-700 dark:text-blue-300 group-hover:underline">{v.title}</span>
                                   </a>
                               ))}
                          </div>
                       )}
                  </div>

                  {/* RIGHT COL: History & Meta */}
                  <div className="space-y-6">
                       <div className="bg-indigo-50/60 dark:bg-indigo-900/20 p-6 rounded-3xl border border-indigo-100/50 dark:border-indigo-900/30 text-center backdrop-blur-sm">
                           <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600 shadow-md rotate-3 hover:rotate-0 transition-transform">
                               <HistoryIcon className="w-8 h-8" />
                           </div>
                           <h3 className="text-4xl font-black text-slate-800 dark:text-white mb-1">{revisionCount}</h3>
                           <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Total Revisions</p>
                           <p className="text-xs text-slate-400 mt-3 font-medium">Last Studied: {lastStudied}</p>
                           
                           <div className="mt-4 pt-4 border-t border-indigo-100 dark:border-indigo-900/50">
                               <div className="flex items-center justify-center gap-2">
                                   <CalendarIcon className="w-4 h-4 text-slate-400" />
                                   <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">First Studied</span>
                               </div>
                               <p className="text-sm font-bold text-slate-800 dark:text-white mt-1">{firstStudied}</p>
                           </div>
                       </div>

                       {/* Flashcards Box */}
                       <div className="bg-amber-50/60 dark:bg-amber-900/10 p-5 rounded-2xl border border-amber-100/50 dark:border-amber-900/30 shadow-sm backdrop-blur-sm">
                           <h3 className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase mb-3 flex items-center gap-1 tracking-wider">
                               <FireIcon className="w-3 h-3" /> Flashcards
                           </h3>
                           
                           {isEditing && editForm ? (
                               <div className="space-y-3">
                                   <div className="flex items-center gap-2">
                                       <input type="number" value={editForm.ankiCovered} onChange={e => setEditForm({...editForm, ankiCovered: parseInt(e.target.value) || 0})} className="w-16 p-1 text-center font-bold text-lg rounded bg-white/50 dark:bg-slate-700 border" />
                                       <span className="text-slate-500">/</span>
                                       <input type="number" value={editForm.ankiTotal} onChange={e => setEditForm({...editForm, ankiTotal: parseInt(e.target.value) || 0})} className="w-16 p-1 text-center font-bold text-lg rounded bg-white/50 dark:bg-slate-700 border" />
                                       <span className="text-xs text-slate-500">Cards</span>
                                   </div>
                                   <div>
                                       <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Anki Tag (for sync)</label>
                                       <input 
                                            type="text" 
                                            value={editForm.ankiTag || ''} 
                                            onChange={e => setEditForm({...editForm, ankiTag: e.target.value})} 
                                            placeholder="tag:#AK_Step1::Biochem"
                                            className="w-full p-2 text-xs font-mono rounded bg-white/50 dark:bg-slate-700 border focus:ring-1 focus:ring-amber-500" 
                                        />
                                   </div>
                                </div>
                           ) : (
                               <>
                                   <div className="flex items-end gap-2 mb-3">
                                       <span className="text-4xl font-extrabold text-slate-800 dark:text-white">{ankiCovered}</span>
                                       <span className="text-sm text-slate-500 mb-1.5 font-bold opacity-70">/ {ankiTotal} Done</span>
                                   </div>
                                   <div className="w-full bg-amber-200/50 dark:bg-amber-900/50 rounded-full h-3 overflow-hidden mb-4">
                                       <div className="bg-amber-500 h-full transition-all shadow-[0_0_10px_rgba(245,158,11,0.5)]" style={{ width: `${ankiTotal > 0 ? (ankiCovered / ankiTotal) * 100 : 0}%` }} />
                                   </div>
                                   
                                   {/* Anki Integration Buttons */}
                                   <div className="flex flex-col gap-2">
                                       <div className="flex gap-2">
                                           <button 
                                                onClick={handleSyncAnki} 
                                                disabled={isSyncingAnki}
                                                className="flex-1 text-[10px] font-bold bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 py-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                                           >
                                               <ArrowPathIcon className={`w-3 h-3 ${isSyncingAnki ? 'animate-spin' : ''}`} />
                                               Sync Stats
                                           </button>
                                           <button 
                                                onClick={handleStudyNow} 
                                                disabled={isMovingCards}
                                                className="flex-1 text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 py-2 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors flex items-center justify-center gap-1"
                                           >
                                               <LinkIcon className={`w-3 h-3 ${isMovingCards ? 'animate-spin' : ''}`} />
                                               Study Now
                                           </button>
                                       </div>
                                       <div className="text-[10px] text-slate-400 text-center font-mono truncate px-1">
                                           Tag: {ankiTag}
                                       </div>
                                   </div>
                               </>
                           )}
                       </div>

                       <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-2xl border border-white/40 dark:border-slate-700 shadow-sm overflow-hidden">
                           <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                               <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Session Log</h3>
                           </div>
                           <div className="max-h-[300px] overflow-y-auto p-3 space-y-2 custom-scrollbar">
                               {logsToDisplay && logsToDisplay.length > 0 ? (
                                   [...logsToDisplay].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((log) => (
                                       <div key={log.id} className="p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-sm shadow-sm hover:scale-[1.02] transition-transform group relative">
                                           <div className="flex justify-between mb-1">
                                               <span className="font-bold text-slate-700 dark:text-slate-300">{new Date(log.timestamp).toLocaleString([], { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                                               <div className="flex items-center gap-2">
                                                   {log.durationMinutes && <span className="text-xs text-slate-400 font-mono">{log.durationMinutes}m</span>}
                                                   <button 
                                                       onClick={() => handleDeleteLog(log.id)} 
                                                       className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                       title="Delete Log"
                                                   >
                                                       <TrashIcon className="w-3.5 h-3.5" />
                                                   </button>
                                               </div>
                                           </div>
                                           <div className="flex items-center gap-2">
                                               <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${log.type === 'STUDY' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                                   {log.type === 'STUDY' ? 'First Study' : `Revision #${log.revisionIndex}`}
                                               </span>
                                           </div>
                                            {/* Show specific subtopics studied in this session */}
                                            {log.topics && log.topics.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {log.topics.map((topicName, i) => (
                                                        <span key={i} className="text-[10px] font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-800 flex items-center gap-1">
                                                            <ListCheckIcon className="w-2.5 h-2.5" />
                                                            Focused on: {topicName}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {log.notes && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 italic border-l-2 border-slate-200 pl-2">
                                                    "{log.notes}"
                                                </p>
                                            )}
                                       </div>
                                   ))
                               ) : (
                                   <p className="text-center text-xs text-slate-400 py-8 italic">No study sessions recorded.</p>
                               )}
                           </div>
                       </div>
                  </div>

              </div>
          </div>
          
          {isEditing && (
            <div className="px-6 py-4 border-t border-slate-200/50 dark:border-slate-700/50 flex justify-end gap-4 shrink-0 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm">
                <button onClick={handleCancelEdit} className="px-6 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Cancel</button>
                <button onClick={handleSaveEdit} className="px-6 py-2 rounded-lg bg-primary text-white text-sm font-bold shadow-md hover:bg-indigo-700 transition-colors">Save Changes</button>
            </div>
          )}

          {/* Quiz Overlay */}
          {(isQuizActive || showQuizResult) && (
              <div className="absolute inset-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl flex flex-col animate-fade-in">
                  <div className="p-4 flex justify-end shrink-0">
                      <button onClick={closeQuiz} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><XMarkIcon className="w-6 h-6 text-slate-500" /></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                      <div className="flex min-h-full items-center justify-center">
                          {showQuizResult ? (
                              <div className="text-center space-y-6 animate-scale-up">
                                  <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full shadow-lg shadow-green-500/30 mb-4">
                                      <CheckCircleIcon className="w-12 h-12 text-white" />
                                  </div>
                                  <h3 className="text-3xl font-bold text-slate-800 dark:text-white">Quiz Complete!</h3>
                                  <p className="text-lg text-slate-600 dark:text-slate-300">
                                      You scored <span className="font-bold text-primary">{quizScore}</span> out of <span className="font-bold">{quizQuestions.length}</span>
                                  </p>
                                  <button onClick={closeQuiz} className="px-8 py-3 bg-slate-800 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold shadow-lg hover:scale-105 transition-transform">
                                      Finish Review
                                  </button>
                              </div>
                          ) : (
                              <div className="w-full max-w-2xl">
                                  <div className="flex justify-between text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
                                      <span>Question {currentQuestionIndex + 1} of {quizQuestions.length}</span>
                                      <span>Score: {quizScore}</span>
                                  </div>
                                  <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 mb-6">
                                      <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 leading-relaxed">{quizQuestions[currentQuestionIndex].question}</h3>
                                      <div className="space-y-3">
                                          {quizQuestions[currentQuestionIndex].options.map((opt, idx) => {
                                              const isSelected = selectedOption === idx;
                                              const isCorrect = idx === quizQuestions[currentQuestionIndex].correctAnswer;
                                              const showStatus = selectedOption !== null;
                                              
                                              let btnClass = "w-full p-4 rounded-xl text-left font-medium transition-all border-2 ";
                                              if (showStatus) {
                                                  if (isCorrect) btnClass += "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300";
                                                  else if (isSelected) btnClass += "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300";
                                                  else btnClass += "border-slate-100 dark:border-slate-700 opacity-50";
                                              } else {
                                                  btnClass += "border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10";
                                              }

                                              return (
                                                  <button 
                                                      key={idx} 
                                                      onClick={() => handleAnswer(idx)}
                                                      disabled={selectedOption !== null}
                                                      className={btnClass}
                                                  >
                                                      {opt}
                                                  </button>
                                              );
                                          })}
                                      </div>
                                  </div>
                                  
                                  {selectedOption !== null && (
                                      <div className="animate-fade-in-up">
                                          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 mb-6">
                                              <p className="text-sm text-blue-800 dark:text-blue-200 font-medium leading-relaxed">
                                                  <span className="font-bold uppercase text-xs block mb-1 opacity-70">Explanation</span>
                                                  {quizQuestions[currentQuestionIndex].explanation}
                                              </p>
                                          </div>
                                          <div className="flex justify-end">
                                              <button onClick={nextQuestion} className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-colors">
                                                  {currentQuestionIndex < quizQuestions.length - 1 ? 'Next Question' : 'Finish Quiz'} <ArrowRightIcon className="w-4 h-4" />
                                              </button>
                                          </div>
                                      </div>
                                  )}
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          )}

        </div>
      </div>
      
      {activeAttachment && (
          <AttachmentViewerModal 
              attachment={activeAttachment} 
              onClose={() => setActiveAttachment(null)} 
          />
      )}
    </>
  );
};
