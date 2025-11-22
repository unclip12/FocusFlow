import React, { useState, useEffect, useRef } from 'react';
import { StudySession, StudyPlanItem, VideoResource, Attachment, getAdjustedDate, StudyMaterial, MaterialChatMessage, DayPlan, MentorMessage, Block, MentorMemory, KnowledgeBaseEntry, AISettings, RevisionSettings } from '../types';
import { chatWithMentor, chatWithStudyBuddy, speakText, extractTextFromMedia } from '../services/geminiService';
import { SparklesIcon, PaperAirplaneIcon, CheckCircleIcon, SpeakerWaveIcon, StopCircleIcon, BookOpenIcon, ArrowRightIcon, DocumentTextIcon, CalendarIcon, TrashIcon, PaperClipIcon, XMarkIcon } from './Icons';
import { getStudyMaterials, saveMaterialChat, auth, saveDayPlan, saveMentorMessage, getMentorMessages, clearMentorMessages, getDayPlan, getMentorMemoryData, saveMentorMemoryData, saveStudyMaterial, getAISettings, getRevisionSettings, deleteDayPlan } from '../services/firebase';
import { generateBlocks } from '../services/blockGenerator';
import { startBlock, updateBlockInPlan, finishBlock } from '../services/planService';
import { processLogEntries } from '../services/faLoggerService';

const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

const addMinutesToTime = (timeStr: string, minutesToAdd: number): string => {
  try {
      const [h, m] = timeStr.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return '';
      const d = new Date();
      d.setHours(h, m, 0, 0);
      d.setMinutes(d.getMinutes() + minutesToAdd);
      return d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: false});
  } catch (e) {
      return '';
  }
};

interface AIChatViewProps {
  sessions: StudySession[];
  studyPlan: StudyPlanItem[];
  streak: number;
  onAddToPlan: (item: Omit<StudyPlanItem, 'id'>, newVideo?: VideoResource, attachments?: Attachment[]) => void;
  onViewDayPlan: (date: string) => void;
  displayName?: string;
  knowledgeBase: KnowledgeBaseEntry[];
  onUpdateKnowledgeBase: (newKB: KnowledgeBaseEntry[]) => Promise<void>;
}

type ChatMode = 'MENTOR' | 'BUDDY';

export const AIChatView: React.FC<AIChatViewProps> = ({ sessions, studyPlan, streak, onAddToPlan, onViewDayPlan, displayName, knowledgeBase, onUpdateKnowledgeBase }) => {
  const [mode, setMode] = useState<ChatMode>('MENTOR');
  
  const [mentorMessages, setMentorMessages] = useState<MentorMessage[]>([]);
  const [mentorMemory, setMentorMemory] = useState<MentorMemory | null>(null);
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
  const [revisionSettings, setRevisionSettings] = useState<RevisionSettings>({ mode: 'balanced', targetCount: 7 });

  const [buddyMessages, setBuddyMessages] = useState<any[]>([
      {
          id: 'buddy_welcome',
          role: 'model',
          text: "I'm your Study Buddy. I'll use your active Info Files as context.",
          timestamp: new Date()
      }
  ]);
  
  const [activeMaterial, setActiveMaterial] = useState<StudyMaterial | null>(null);
  const [allMaterials, setAllMaterials] = useState<StudyMaterial[]>([]); // Local cache for retrieval
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);

  const [todaysBlocks, setTodaysBlocks] = useState<Block[]>([]);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [stopAudio, setStopAudio] = useState<(() => void) | null>(null);

  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ data: string; mimeType: string; filename: string } | null>(null);

  useEffect(() => {
    if (mode === 'MENTOR') {
        loadMentorHistory();
        loadMentorMemory();
        loadTodaysBlocks();
        loadSettings();
    }
    // Always load materials for context/retrieval
    loadMaterials();
  }, [mode]);

  const loadSettings = async () => {
    const [aiData, revData] = await Promise.all([getAISettings(), getRevisionSettings()]);
    if(aiData) setAiSettings(aiData);
    if(revData) setRevisionSettings(revData);
  }

  const loadMentorHistory = async () => {
      const history = await getMentorMessages();
      if (history.length > 0) {
          setMentorMessages(history);
      } else {
          setMentorMessages([{
              id: 'welcome',
              role: 'model',
              text: `Hello, ${displayName || 'doctor'}. I've reviewed your charts. Your study stats are loaded. How can I help you optimize your preparation today?`,
              timestamp: new Date().toISOString()
          }]);
      }
  };

  const loadMentorMemory = async () => {
      try {
          const memory = await getMentorMemoryData();
          setMentorMemory(memory);
      } catch (e) { console.error("Memory load error", e); }
  };

  const loadTodaysBlocks = async () => {
      try {
          const today = getAdjustedDate(new Date());
          const plan = await getDayPlan(today);
          if (plan && plan.blocks) {
              setTodaysBlocks(plan.blocks);
          } else {
              setTodaysBlocks([]);
          }
      } catch (e) {
          console.error("Error loading blocks for context", e);
      }
  };

  const loadMaterials = async () => {
      if (!auth.currentUser) return;
      setIsLoadingMaterials(true);
      try {
          const materials = await getStudyMaterials();
          setAllMaterials(materials); // Cache for local retrieval
          const active = materials.find(m => m.isActive);
          setActiveMaterial(active || null);
          
          if (active && mode === 'BUDDY') {
               setBuddyMessages(prev => {
                    if (prev.some(m => m.text.includes(active.title))) return prev;
                    return [...prev, {
                        id: generateId(),
                        role: 'model',
                        text: `Loaded active material: "${active.title}". I'm ready to discuss it.`,
                        timestamp: new Date(),
                        isSystemAction: true
                    }];
               });
          }
      } catch (e) {
          console.error("Failed to load materials", e);
      } finally {
          setIsLoadingMaterials(false);
      }
  };

  useEffect(() => {
      if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
  }, [mentorMessages, buddyMessages, isTyping, mode]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
        // Reset height to allow shrinking
        textarea.style.height = 'auto';
        // Set height to scroll height. The max-height from tailwind will cap it.
        textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [input]);

  const handleSpeakMessage = async (msgText: string, msgId: string) => {
      if (speakingMessageId === msgId) {
          if (stopAudio) stopAudio();
          setSpeakingMessageId(null);
          setStopAudio(null);
      } else {
          if (stopAudio) stopAudio();
          setSpeakingMessageId(msgId);
          const stopFn = await speakText(msgText);
          setStopAudio(() => stopFn);
      }
  };

  const handleClearChat = async () => {
      if (confirm("Clear all chat history with AI Mentor?")) {
          await clearMentorMessages();
          setMentorMessages([{
              id: generateId(),
              role: 'model',
              text: "Chat cleared. How can I help you now?",
              timestamp: new Date().toISOString()
          }]);
      }
  };

  // --- FILE HANDLING & MENTOR SAVE ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setIsUploadingFile(true);

        // Part 1: Prepare UI attachment for current message (if image)
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = (reader.result as string).split(',')[1];
                setAttachedImage({
                    data: base64data,
                    mimeType: file.type,
                    filename: file.name,
                });
            };
            reader.readAsDataURL(file);
        } else {
             setAttachedImage({
                data: '',
                mimeType: file.type,
                filename: `[Processing PDF] ${file.name}`
            });
        }

        // Part 2: Process Local File & Save to Info Files
        try {
            // Skip uploadTempFile to avoid storage permission errors. Process locally.
            const base64ForExtraction = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const extractedText = await extractTextFromMedia(base64ForExtraction, file.type);

            if (extractedText) {
                const newMaterial: StudyMaterial = {
                    id: generateId(),
                    title: file.name,
                    text: extractedText,
                    sourceType: file.type.startsWith('image/') ? 'IMAGE' : 'PDF',
                    createdAt: new Date().toISOString(),
                    isActive: false,
                    source: 'MENTOR', // Explicitly tag as from Mentor
                };
                await saveStudyMaterial(newMaterial);
                // Refresh local list
                setAllMaterials(prev => [...prev, newMaterial]);
                
                const sysMsg: MentorMessage = {
                    id: generateId(),
                    role: 'model',
                    text: `✅ Processed and saved "${file.name}" to Info Files. I can now reuse this knowledge later. 📂`,
                    timestamp: new Date().toISOString(),
                    isSystemAction: true
                };
                setMentorMessages(prev => [...prev, sysMsg]);
                await saveMentorMessage(sysMsg);
            } else {
                 const sysMsg: MentorMessage = {
                    id: generateId(),
                    role: 'model',
                    text: `⚠️ Could not extract text from "${file.name}". File not saved.`,
                    timestamp: new Date().toISOString(),
                    isSystemAction: true
                };
                setMentorMessages(prev => [...prev, sysMsg]);
                await saveMentorMessage(sysMsg);
                if (!file.type.startsWith('image/')) {
                    setAttachedImage(null);
                }
            }
        } catch (error) {
            console.error("File processing error:", error);
            const sysMsg: MentorMessage = {
                id: generateId(),
                role: 'model',
                text: `⚠️ Error processing "${file.name}".`,
                timestamp: new Date().toISOString(),
                isSystemAction: true
            };
            setMentorMessages(prev => [...prev, sysMsg]);
            await saveMentorMessage(sysMsg);
            setAttachedImage(null);
        } finally {
            setIsUploadingFile(false);
             e.target.value = ''; // Allow re-selecting
        }
    }
  };

  const handleRemoveAttachment = () => {
      setAttachedImage(null);
  };

  // --- SIMPLE RAG RETRIEVAL ---
  const retrieveContext = (query: string): string => {
      if (!allMaterials.length || !query.trim() || !aiSettings?.memoryPermissions?.canReadInfoFiles) return "";
      
      const lowerQuery = query.toLowerCase();
      
      // Simple keyword scoring
      const scoredMaterials = allMaterials.map(m => {
          let score = 0;
          if (m.title.toLowerCase().includes(lowerQuery)) score += 10;
          // Basic overlapping keywords check
          const keywords = lowerQuery.split(' ').filter(w => w.length > 4);
          keywords.forEach(k => {
              if (m.text.toLowerCase().includes(k)) score += 1;
              if (m.title.toLowerCase().includes(k)) score += 3;
          });
          return { material: m, score };
      });

      // Filter and sort
      const relevant = scoredMaterials
          .filter(m => m.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 2); // Take top 2

      if (relevant.length === 0) return "";

      return relevant.map(r => `SOURCE: ${r.material.title}\nCONTENT: ${r.material.text.substring(0, 2000)}...`).join('\n\n');
  };

  // --- UNIFIED BLOCK MANAGEMENT via planService ---
  const executeBlockAction = async (
      action: 'START' | 'PAUSE' | 'RESUME' | 'FINISH', 
      index: number, 
      notes?: string, 
      delayMinutes?: number,
      completionStatus?: 'COMPLETED' | 'PARTIAL' | 'NOT_DONE',
      pagesCovered?: number[],
      carryForwardPages?: number[]
  ) => {
      const today = getAdjustedDate(new Date());
      // Get block ID from todaysBlocks index
      const blockId = todaysBlocks[index]?.id;
      if (!blockId) {
          console.warn("Block not found at index", index);
          return false;
      }

      try {
          if (action === 'START' || action === 'RESUME') {
              await startBlock(today, blockId);
          } else if (action === 'PAUSE') {
              await updateBlockInPlan(today, blockId, {
                  status: 'PAUSED',
                  actualNotes: notes ? `Paused: ${notes}` : undefined
              });
          } else if (action === 'FINISH') {
              await finishBlock(today, blockId, {
                  status: completionStatus || 'COMPLETED',
                  pagesCovered: pagesCovered || [],
                  carryForwardPages: carryForwardPages || [],
                  notes: notes || ''
              });
          }
          // Refresh local context
          await loadTodaysBlocks();
          return true;
      } catch (e) {
          console.error("Failed to execute block action via AI", e);
          return false;
      }
  };

  const handleSend = async () => {
      if (!input.trim() && !attachedImage) return;
      
      const textToSend = input;
      const msgId = generateId();
      const timestamp = new Date().toISOString();

      // --- LONG TEXT SAVING LOGIC ---
      // If text is long (> 300 chars), save it as a Study Material first
      if (mode === 'MENTOR' && textToSend.length > 300) {
          try {
              const title = textToSend.substring(0, 30) + "...";
              const newMaterial: StudyMaterial = {
                  id: generateId(),
                  title: `Note: ${title} (${new Date().toLocaleDateString()})`,
                  text: textToSend,
                  sourceType: 'TEXT',
                  createdAt: timestamp,
                  isActive: false,
                  source: 'MENTOR',
                  tokenEstimate: textToSend.length / 4
              };
              await saveStudyMaterial(newMaterial);
              setAllMaterials(prev => [...prev, newMaterial]);
              
              // Notify User locally
              const sysMsg: MentorMessage = {
                  id: generateId(),
                  role: 'model',
                  text: `📂 I've saved this long note to your Info Files so I don't forget it.`,
                  timestamp: new Date().toISOString(),
                  isSystemAction: true
              };
              setMentorMessages(prev => [...prev, sysMsg]);
              await saveMentorMessage(sysMsg);
          } catch (e) {
              console.error("Failed to auto-save long text", e);
          }
      }

      const userMsg: MentorMessage = {
          id: msgId,
          role: 'user',
          text: textToSend,
          timestamp: timestamp
      };

      setInput('');
      setIsTyping(true);
      
      const currentAttachment = attachedImage;
      const attachmentForApi = (currentAttachment && currentAttachment.mimeType.startsWith('image/') && currentAttachment.data) 
          ? { data: currentAttachment.data, mimeType: currentAttachment.mimeType } 
          : undefined;
      setAttachedImage(null);

      if (mode === 'MENTOR') {
          setMentorMessages(prev => [...prev, userMsg]);
          await saveMentorMessage(userMsg);
          
          try {
              await loadTodaysBlocks();

              // 1. Retrieve Relevant Context
              const retrievedContext = retrieveContext(textToSend);

              const historyForApi = mentorMessages
                  .filter(m => !m.isSystemAction)
                  .map(m => ({
                      role: m.role,
                      text: m.text
                  }));

              const response = await chatWithMentor(
                  historyForApi, 
                  textToSend, 
                  sessions, 
                  studyPlan, 
                  streak, 
                  attachmentForApi,
                  todaysBlocks,
                  mentorMemory,
                  displayName,
                  activeMaterial?.text,
                  retrievedContext, // Pass RAG context
                  aiSettings
              );
              
              if (response.toolCalls && response.toolCalls.length > 0) {
                  for (const call of response.toolCalls) {
                       if (call.name === 'logFAStudy') {
                           const args = call.args as any;
                           const parsedEntries = args.updates.map((u: any) => ({
                               pageNumber: u.pageNumber,
                               isExplicitRevision: u.isRevision,
                               topics: u.topics || [],
                               date: u.date
                           }));

                           const { results, updatedKB } = processLogEntries(parsedEntries, knowledgeBase, revisionSettings);
                           await onUpdateKnowledgeBase(updatedKB);
                       }
                       else if (call.name === 'addStudyTask') {
                           const args = call.args as any;
                           onAddToPlan({
                               date: getAdjustedDate(new Date()),
                               type: 'HYBRID',
                               pageNumber: args.pageNumber,
                               topic: args.topic,
                               estimatedMinutes: args.durationMinutes,
                               ankiCount: args.ankiCount,
                               isCompleted: false,
                               totalMinutesSpent: 0,
                               videoUrl: args.videoUrl
                           });
                       }
                       else if (call.name === 'createDayPlan') {
                           const planArgs = call.args as DayPlan;
                           
                           if (!planArgs.attachments) planArgs.attachments = [];
                           if (!planArgs.breaks) planArgs.breaks = [];
                           if (!planArgs.videos) planArgs.videos = [];
                           if (!planArgs.faPages) planArgs.faPages = [];
                           if (planArgs.date && planArgs.date.length > 10) planArgs.date = planArgs.date.substring(0, 10);

                           if (planArgs.startTimePlanned) {
                               const totalMinutes = (planArgs.totalStudyMinutesPlanned || 0) + (planArgs.totalBreakMinutes || 0);
                               planArgs.estimatedEndTime = addMinutesToTime(planArgs.startTimePlanned, totalMinutes);
                           }

                           if (!planArgs.blocks || planArgs.blocks.length === 0) {
                               planArgs.blocks = generateBlocks(planArgs, 30);
                               planArgs.blockDurationSetting = 30;
                           }

                           await saveDayPlan(planArgs);
                           setTodaysBlocks(planArgs.blocks!);
                       }
                       else if (call.name === 'controlSession') {
                           const args = call.args as any;
                           await executeBlockAction(
                               args.action, 
                               args.blockIndex, 
                               args.notes, 
                               undefined, 
                               args.completionStatus,
                               Array.isArray(args.pagesCovered) ? args.pagesCovered : [],
                               Array.isArray(args.carryForwardPages) ? args.carryForwardPages : []
                           );
                       }
                       else if (call.name === 'updateUserMemory') {
                           const memArgs = call.args as MentorMemory;
                           const newMemory = { ...mentorMemory, ...memArgs };
                           setMentorMemory(newMemory);
                           await saveMentorMemoryData(newMemory);
                       }
                       else if (call.name === 'deleteDayPlan') {
                           const args = call.args as any;
                           const dateToDelete = args.date || getAdjustedDate(new Date());
                           await deleteDayPlan(dateToDelete);
                           
                           const today = getAdjustedDate(new Date());
                           if (dateToDelete === today) {
                               setTodaysBlocks([]); // Clear local blocks
                           }
                       }
                  }
              }

              if (response.text) {
                  const modelMsg: MentorMessage = {
                      id: generateId(),
                      role: 'model',
                      text: response.text,
                      timestamp: new Date().toISOString()
                  };
                  setMentorMessages(prev => [...prev, modelMsg]);
                  await saveMentorMessage(modelMsg);
              }
          } catch (error: any) {
              console.error("Chat error", error);
              const errorMsg: MentorMessage = {
                  id: generateId(),
                  role: 'model',
                  text: error.text || "I'm having trouble connecting right now. Please try again.",
                  timestamp: new Date().toISOString(),
                  isSystemAction: true
              };
              setMentorMessages(prev => [...prev, errorMsg]);
          } finally {
              setIsTyping(false);
          }

      } else {
          const buddyUserMsg = { ...userMsg, timestamp: new Date() }; 
          setBuddyMessages(prev => [...prev, buddyUserMsg]);

          if (!activeMaterial) {
               const warningMsg = {
                   id: generateId(),
                   role: 'model',
                   text: "No active material found. Please go to the Info Files section and set a material as 'Active' or upload new content.",
                   timestamp: new Date(),
                   isSystemAction: true
               };
               setBuddyMessages(prev => [...prev, warningMsg]);
               setIsTyping(false);
               return;
          }

          try {
              await saveMaterialChat(activeMaterial.id, {
                  id: userMsg.id,
                  role: 'user',
                  text: userMsg.text,
                  timestamp: userMsg.timestamp
              });
          } catch (e) { console.warn("Failed to save chat history", e); }

          try {
              const historyForApi = buddyMessages
                  .filter(m => !m.isSystemAction)
                  .map(m => ({ role: m.role, text: m.text }));
              
              const response = await chatWithStudyBuddy(historyForApi, textToSend, activeMaterial.text);
              
              const modelMsg = {
                  id: generateId(),
                  role: 'model',
                  text: response.text,
                  timestamp: new Date()
              };
              setBuddyMessages(prev => [...prev, modelMsg]);
              
              await saveMaterialChat(activeMaterial.id, {
                  id: modelMsg.id,
                  role: 'model',
                  text: modelMsg.text,
                  timestamp: modelMsg.timestamp.toISOString()
              });

          } catch (error) {
               console.error("Buddy Chat error", error);
               setBuddyMessages(prev => [...prev, {
                   id: generateId(),
                   role: 'model',
                   text: "Error connecting to Study Buddy service.",
                   timestamp: new Date(),
                   isSystemAction: true
               }]);
          } finally {
              setIsTyping(false);
          }
      }
  };

  const formatMessageText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <span key={idx} className="font-extrabold text-black dark:text-white drop-shadow-sm">{part.slice(2, -2)}</span>;
        }
        return part;
    });
  };

  const currentMessages = mode === 'MENTOR' ? mentorMessages : buddyMessages;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-slate-700/50 shadow-2xl overflow-hidden animate-fade-in relative">
        <div className="p-3 border-b border-white/20 dark:border-slate-700/50 bg-white/30 dark:bg-slate-800/30 backdrop-blur-md z-10 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl text-white shadow-lg ${mode === 'MENTOR' ? 'bg-gradient-to-br from-indigo-500 to-fuchsia-600 shadow-indigo-500/30' : 'bg-gradient-to-br from-blue-500 to-cyan-600 shadow-cyan-500/30'}`}>
                    {mode === 'MENTOR' ? <SparklesIcon className="w-5 h-5" /> : <BookOpenIcon className="w-5 h-5" />}
                </div>
                <div>
                    <h2 className="font-bold text-slate-800 dark:text-white">{mode === 'MENTOR' ? 'AI Mentor' : 'Study Buddy'}</h2>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Powered by Gemini</p>
                </div>
            </div>

            <div className="flex gap-3 items-center">
                {mode === 'MENTOR' && (
                    <button onClick={handleClearChat} className="text-slate-400 hover:text-red-500 p-2" title="Clear History">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                )}
                <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-lg">
                    <button 
                        onClick={() => setMode('MENTOR')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${mode === 'MENTOR' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                    >
                        Mentor
                    </button>
                    <button 
                        onClick={() => setMode('BUDDY')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${mode === 'BUDDY' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                    >
                        Study Buddy
                    </button>
                </div>
            </div>
        </div>

        {(mode === 'BUDDY' || (mode === 'MENTOR' && activeMaterial)) && (
            <div className="p-2 bg-blue-50/50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/30 flex items-center justify-between px-4">
                <div className="flex items-center gap-2 overflow-hidden">
                    <DocumentTextIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">
                        {activeMaterial ? `Using: ${activeMaterial.title}` : "No active material selected"}
                    </span>
                </div>
                <button onClick={loadMaterials} className="text-[10px] text-blue-600 hover:underline">Refresh</button>
            </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-6 relative z-0" ref={scrollRef}>
            {currentMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`relative group max-w-[85%] rounded-2xl p-4 shadow-sm text-sm leading-relaxed whitespace-pre-wrap transition-all duration-300 ${
                        msg.role === 'user' 
                        ? mode === 'MENTOR' 
                             ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-tr-none shadow-indigo-500/20'
                             : 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white rounded-tr-none shadow-blue-500/20'
                        : msg.isSystemAction 
                            ? 'bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center gap-2 backdrop-blur-sm'
                            : 'bg-white/80 dark:bg-slate-700/80 backdrop-blur-md border border-white/50 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-tl-none shadow-lg'
                    }`}>
                        {msg.isSystemAction ? (
                             <div className="flex flex-col w-full">
                                 <div className="flex items-center gap-2">
                                     <CheckCircleIcon className="w-4 h-4" /> 
                                     <span className="font-bold">Action Completed</span>
                                 </div>
                                 <p className="mt-1 opacity-90">{msg.text}</p>
                                 {msg.actionType === 'VIEW_PLAN' && msg.actionPayload?.date && (
                                     <button 
                                        onClick={() => onViewDayPlan(msg.actionPayload.date)}
                                        className="mt-3 bg-white/40 hover:bg-white/60 text-emerald-900 dark:text-emerald-100 text-xs font-bold py-2 px-3 rounded-lg text-left w-full flex items-center justify-between transition-colors border border-emerald-200 dark:border-emerald-700"
                                     >
                                        <span className="flex items-center gap-2">
                                            <CalendarIcon className="w-4 h-4" /> Open Plan for {msg.actionPayload.date}
                                        </span>
                                        <ArrowRightIcon className="w-3 h-3" />
                                     </button>
                                 )}
                             </div>
                        ) : (
                            <>
                                {formatMessageText(msg.text)}
                                {msg.role === 'model' && (
                                    <button 
                                        onClick={() => handleSpeakMessage(msg.text, msg.id)}
                                        className="absolute -bottom-8 left-0 p-1.5 text-slate-400 hover:text-indigo-500 transition-colors opacity-0 group-hover:opacity-100 bg-white/50 dark:bg-slate-800/50 rounded-full backdrop-blur-sm"
                                        title="Read Aloud"
                                    >
                                        {speakingMessageId === msg.id ? <StopCircleIcon className="w-4 h-4 text-red-500" /> : <SpeakerWaveIcon className="w-4 h-4" />}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            ))}
            {isTyping && (
                <div className="flex justify-start">
                    <div className="bg-white/60 dark:bg-slate-700/60 backdrop-blur-md rounded-2xl rounded-tl-none p-4 border border-white/40 dark:border-slate-600 shadow-sm">
                        <div className="flex gap-1.5">
                            <span className={`w-2 h-2 rounded-full animate-bounce ${mode === 'MENTOR' ? 'bg-indigo-400' : 'bg-blue-400'}`} style={{ animationDelay: '0s' }}></span>
                            <span className={`w-2 h-2 rounded-full animate-bounce ${mode === 'MENTOR' ? 'bg-purple-400' : 'bg-cyan-400'}`} style={{ animationDelay: '0.2s' }}></span>
                            <span className={`w-2 h-2 rounded-full animate-bounce ${mode === 'MENTOR' ? 'bg-pink-400' : 'bg-sky-400'}`} style={{ animationDelay: '0.4s' }}></span>
                        </div>
                    </div>
                </div>
            )}
        </div>
        
        {attachedImage && (
            <div className="absolute bottom-20 left-4 right-4 z-20 flex items-center gap-3 bg-indigo-100 dark:bg-slate-700 p-2 rounded-lg border border-indigo-200 dark:border-slate-600 shadow-md animate-fade-in-up">
                {attachedImage.mimeType.startsWith('image/') ? (
                    <img src={`data:${attachedImage.mimeType};base64,${attachedImage.data}`} alt="preview" className="w-8 h-8 rounded object-cover" />
                ) : (
                    <DocumentTextIcon className="w-8 h-8 text-red-500 p-1" />
                )}
                <span className="text-xs font-bold truncate flex-1 text-indigo-800 dark:text-indigo-200">{attachedImage.filename}</span>
                <button onClick={handleRemoveAttachment} className="hover:bg-indigo-200 dark:hover:bg-slate-600 rounded-full p-1 text-indigo-500 dark:text-indigo-300">
                    <XMarkIcon className="w-4 h-4" />
                </button>
            </div>
        )}

        <div className="p-2 bg-white/40 dark:bg-slate-800/40 backdrop-blur-lg border-t border-white/20 dark:border-slate-700 z-10">
            <div className="flex items-end gap-2">
                <label className={`p-3.5 rounded-xl transition-all cursor-pointer hover:bg-white/50 dark:hover:bg-slate-700 ${isUploadingFile ? 'opacity-50 cursor-wait' : ''}`} title="Attach Photo or PDF">
                    {isUploadingFile ? (
                         <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                         <PaperClipIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    )}
                    <input type="file" accept="image/*,application/pdf" onChange={handleFileSelect} className="hidden" disabled={isUploadingFile} />
                </label>
                
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder={mode === 'MENTOR' ? "Ask Mentor to plan your day..." : "Ask Study Buddy about the content..."}
                    className="flex-1 p-3.5 rounded-xl border border-white/50 dark:border-slate-600 bg-white/70 dark:bg-slate-900/70 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none placeholder-slate-400 shadow-inner resize-none max-h-36 custom-scrollbar text-sm"
                    disabled={isTyping}
                    rows={1}
                />
                
                <button 
                    onClick={handleSend}
                    disabled={isTyping || (!input.trim() && !attachedImage)}
                    className={`p-3.5 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:scale-105 active:scale-95 self-end ${mode === 'MENTOR' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'}`}
                >
                    <PaperAirplaneIcon className="w-5 h-5 transform rotate-90" />
                </button>
            </div>
        </div>
    </div>
  );
};