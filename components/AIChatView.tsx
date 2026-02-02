
import React, { useState, useEffect, useRef } from 'react';
import { StudySession, StudyPlanItem, VideoResource, Attachment, getAdjustedDate, StudyMaterial, MentorMessage, Block, MentorMemory, KnowledgeBaseEntry, AISettings, RevisionSettings, TrackableItem, DayPlan } from '../types';
import { chatWithMentor, chatWithStudyBuddy, speakText } from '../services/geminiService'; // Removed extractTextFromMedia
import { SparklesIcon, PaperAirplaneIcon, CheckCircleIcon, SpeakerWaveIcon, StopCircleIcon, BookOpenIcon, ArrowRightIcon, DocumentTextIcon, CalendarIcon, TrashIcon, PaperClipIcon, XMarkIcon, DatabaseIcon, PlusIcon } from './Icons';
import { getStudyMaterials, saveMaterialChat, auth, saveDayPlan, saveMentorMessage, getMentorMessages, clearMentorMessages, getDayPlan, getMentorMemoryData, saveMentorMemoryData, saveStudyMaterial, getAISettings, getRevisionSettings, deleteDayPlan, saveKnowledgeBase } from '../services/firebase';
import { generateBlocks } from '../services/blockGenerator';
import { startBlock, updateBlockInPlan, finishBlock } from '../services/planService';
import { processLogEntries } from '../services/faLoggerService';
import { parseSchedule } from '../services/scheduleParser';

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

const parseTimeMinutes = (timeStr: string): number => {
    try {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    } catch (e) { return 0; }
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
  viewState: {
      mode: 'MENTOR' | 'BUDDY';
      input: string;
  };
  setViewState: React.Dispatch<React.SetStateAction<{
      mode: 'MENTOR' | 'BUDDY';
      input: string;
  }>>;
}

type ChatMode = 'MENTOR' | 'BUDDY';

export const AIChatView: React.FC<AIChatViewProps> = ({ sessions, studyPlan, streak, onAddToPlan, onViewDayPlan, displayName, knowledgeBase, onUpdateKnowledgeBase, viewState, setViewState }) => {
  const { mode, input } = viewState;
  const setMode = (m: ChatMode) => setViewState(prev => ({ ...prev, mode: m }));
  const setInput = (i: string) => setViewState(prev => ({ ...prev, input: i }));

  const [selectedModel, setSelectedModel] = useState<string>('chatbot');
  
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

  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [stopAudio, setStopAudio] = useState<(() => void) | null>(null);

  // const [isUploadingFile, setIsUploadingFile] = useState(false); // Removed
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

  useEffect(() => {
    if (mode === 'BUDDY' && selectedModel === 'chatbot') {
        setSelectedModel('gemini-2.5-flash');
    }
  }, [mode, selectedModel]);

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

  /* REMOVED FILE SELECT HANDLER
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Disabled
  };
  */

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

  // --- DATA IMPORT HANDLER ---
  const handleImportAction = async (action: 'KB' | 'PLAN' | 'BOTH', data: any) => {
      try {
          // Support batch array import
          const importItems = Array.isArray(data) ? data : [data];
          
          // To report feedback to user
          let detectedSystem = '';
          let detectedSubject = '';

          // 1. Update Knowledge Base
          if (action === 'KB' || action === 'BOTH') {
              // Work on a copy of the current KB
              let updatedKB = [...knowledgeBase];
              
              for (const item of importItems) {
                  const { pageNumber, title, system, subject, topics, keyPoints } = item;
                  const pageStr = String(pageNumber);
                  
                  // Capture meta for feedback
                  if (system && !detectedSystem) detectedSystem = system;
                  if (subject && !detectedSubject) detectedSubject = subject;

                  let newTopics: TrackableItem[] = [];

                  if (Array.isArray(topics) && topics.length > 0 && typeof topics[0] === 'string') {
                      // Format: { topics: ["Name"], keyPoints: ["Point 1", "Point 2"] }
                      newTopics = topics.map((topicName: string) => ({
                          id: generateId(),
                          name: topicName,
                          content: keyPoints, // Assign the keyPoints as content
                          revisionCount: 0,
                          lastStudiedAt: null,
                          nextRevisionAt: null,
                          currentRevisionIndex: 0,
                          logs: []
                      }));
                  } else if (Array.isArray(topics)) {
                      // Complex object format
                      newTopics = topics.map((t: any) => {
                          const name = typeof t === 'string' ? t : t.name;
                          const content = typeof t === 'object' && t.content ? t.content : undefined;
                          
                          return {
                              id: generateId(),
                              name: name,
                              content: content, // Store detailed content
                              revisionCount: 0,
                              lastStudiedAt: null,
                              nextRevisionAt: null,
                              currentRevisionIndex: 0,
                              logs: []
                          };
                      });
                  }

                  const existingIndex = updatedKB.findIndex(k => k.pageNumber === pageStr);
                  
                  if (existingIndex >= 0) {
                      // Update existing
                      const kbEntry = updatedKB[existingIndex];
                      
                      // Smart Merge Topics: Update content if topic exists, append if new
                      const mergedTopics = [...kbEntry.topics];
                      for (const newTopic of newTopics) {
                          const existingTopicIdx = mergedTopics.findIndex(t => t.name === newTopic.name);
                          if (existingTopicIdx >= 0) {
                              // Update existing content if new content is provided
                              if (newTopic.content && newTopic.content.length > 0) {
                                  mergedTopics[existingTopicIdx] = {
                                      ...mergedTopics[existingTopicIdx],
                                      content: newTopic.content
                                  };
                              }
                          } else {
                              mergedTopics.push(newTopic);
                          }
                      }

                      updatedKB[existingIndex] = {
                          ...kbEntry,
                          title: title || kbEntry.title,
                          system: system || kbEntry.system,
                          subject: subject || kbEntry.subject,
                          topics: mergedTopics,
                          keyPoints: keyPoints || kbEntry.keyPoints || []
                      };
                  } else {
                      // Create new
                      updatedKB.push({
                          pageNumber: pageStr,
                          title: title || `Page ${pageStr}`,
                          subject: subject || 'Uncategorized',
                          system: system || 'General',
                          revisionCount: 0,
                          firstStudiedAt: null,
                          lastStudiedAt: null,
                          nextRevisionAt: null,
                          currentRevisionIndex: 0,
                          ankiTotal: 0,
                          ankiCovered: 0,
                          videoLinks: [],
                          tags: [],
                          notes: '',
                          logs: [],
                          topics: newTopics,
                          attachments: [],
                          keyPoints: keyPoints || [] 
                      });
                  }
              }
              
              await onUpdateKnowledgeBase(updatedKB);
              await saveKnowledgeBase(updatedKB); // Force Firestore sync
          }

          // 2. Update Today's Plan
          if (action === 'PLAN' || action === 'BOTH') {
              // Loop and add items
              for (const item of importItems) {
                  const { pageNumber, title, topics } = item;
                  const pageStr = String(pageNumber);
                  
                  // Map topics for subtasks, checking if object or string
                  const subTaskTexts = Array.isArray(topics) ? topics.map((t: any) => typeof t === 'string' ? t : t.name) : [];

                  onAddToPlan({
                      date: getAdjustedDate(new Date()),
                      type: 'PAGE',
                      pageNumber: pageStr,
                      topic: title || `Study Page ${pageStr}`,
                      estimatedMinutes: 45,
                      isCompleted: false,
                      ankiCount: 0,
                      totalMinutesSpent: 0,
                      subTasks: subTaskTexts.map((t: string) => ({ id: generateId(), text: t, done: false }))
                  });
              }
          }

          // Log confirmation with specific details
          const count = importItems.length;
          let confirmText = `✅ Successfully processed ${count} page${count > 1 ? 's' : ''} into ${action === 'BOTH' ? 'Knowledge Base and Plan' : (action === 'KB' ? 'Knowledge Base' : 'Today\'s Plan')}.`;
          
          if (detectedSystem || detectedSubject) {
              confirmText += `\n\n**Categorized as:**\nSystem: ${detectedSystem || 'Unchanged'}\nSubject: ${detectedSubject || 'Unchanged'}`;
          }

          const msg: MentorMessage = {
              id: generateId(),
              role: 'model',
              text: confirmText,
              timestamp: new Date().toISOString(),
              isSystemAction: true
          };
          setMentorMessages(prev => [...prev, msg]);
          await saveMentorMessage(msg);

      } catch (e) {
          console.error("Import error", e);
          const err: MentorMessage = {
              id: generateId(),
              role: 'model',
              text: "❌ Error importing data. Please check the format.",
              timestamp: new Date().toISOString()
          };
          setMentorMessages(prev => [...prev, err]);
      }
  };

  const cleanJsonInput = (input: string): string => {
      // Remove markdown code blocks
      let text = input.replace(/```json/g, '').replace(/```/g, '');
      // Replace smart quotes with standard double quotes
      text = text.replace(/[\u201C\u201D]/g, '"');
      // Replace non-breaking spaces which can break JSON parsing
      text = text.replace(/\u00A0/g, ' ');
      return text.trim();
  };

  const handleSend = async () => {
      if (!input.trim() && !attachedImage) return;
      
      const textToSend = input;
      const msgId = generateId();
      const timestamp = new Date().toISOString();

      const userMsg: MentorMessage = {
          id: msgId,
          role: 'user',
          text: textToSend,
          timestamp: timestamp
      };

      setInput('');
      setIsTyping(true);

      // --- LOCAL CHAT BOT INTERCEPTION ---
      if (mode === 'MENTOR' && selectedModel === 'chatbot') {
        setMentorMessages(prev => [...prev, userMsg]);
        await saveMentorMessage(userMsg);
        
        // 1. Try JSON Parsing for Knowledge Base Update
        try {
            const cleanedText = cleanJsonInput(textToSend);
            
            // Find potential JSON start/end
            const firstBrace = cleanedText.indexOf('{');
            const lastBrace = cleanedText.lastIndexOf('}');
            const firstBracket = cleanedText.indexOf('[');
            const lastBracket = cleanedText.lastIndexOf(']');
            
            let jsonCandidate = "";
            
            // Determine if Object or Array is more likely (earliest start)
            // Case 1: Array
            if (firstBracket !== -1 && lastBracket > firstBracket && (firstBrace === -1 || firstBracket < firstBrace)) {
                jsonCandidate = cleanedText.substring(firstBracket, lastBracket + 1);
            } 
            // Case 2: Object
            else if (firstBrace !== -1 && lastBrace > firstBrace) {
                jsonCandidate = cleanedText.substring(firstBrace, lastBrace + 1);
            }

            if (jsonCandidate) {
                const data = JSON.parse(jsonCandidate);
                
                // Validate: Single Object vs Array
                const isValidSingle = !Array.isArray(data) && data.pageNumber && (data.topics || data.title);
                const isValidArray = Array.isArray(data) && data.length > 0 && data[0].pageNumber;

                if (isValidSingle || isValidArray) {
                    const count = Array.isArray(data) ? data.length : 1;
                    const firstPage = Array.isArray(data) ? data[0].pageNumber : data.pageNumber;
                    
                    // Check for deep content
                    const hasDeepContent = Array.isArray(data) 
                        ? data.some((d:any) => d.topics?.some((t:any) => t.content && t.content.length > 0) || (d.keyPoints && d.keyPoints.length > 0)) 
                        : (data.topics?.some((t:any) => t.content && t.content.length > 0) || (data.keyPoints && data.keyPoints.length > 0));

                    const confirmMsg: MentorMessage = {
                        id: generateId(),
                        role: 'model',
                        text: `I recognized structured data for **${count} page(s)** starting from Page ${firstPage}.${hasDeepContent ? ' \n\n✨ **Deep content detected** (bullet points & details).' : ''}\n\nWhat would you like to do with this batch?`,
                        timestamp: new Date().toISOString(),
                        isSystemAction: true,
                        actionType: 'CONFIRM_IMPORT',
                        actionPayload: data
                    };
                    setMentorMessages(prev => [...prev, confirmMsg]);
                    await saveMentorMessage(confirmMsg);
                    setIsTyping(false);
                    return;
                }
            }
        } catch (e) {
            // Not JSON, continue to schedule parser
        }

        // 2. Schedule Parsing (Existing Logic)
        // CRITICAL: Use getAdjustedDate to ensure we parse relative to local date
        const todayStr = getAdjustedDate(new Date());
        const parsedPlans = parseSchedule(textToSend, todayStr);
        
        if (parsedPlans && parsedPlans.length > 0) {
            // Iterate and save ALL days found
            let summaryText = `✅ Schedule Parsed Successfully! I've created detailed plans for ${parsedPlans.length} days:\n\n`;
            
            // Removed Auto Snapshot

            for (const plan of parsedPlans) {
                // MERGE LOGIC START: Preserve existing completed history
                // Fetch existing plan for that day first
                const existingPlan = await getDayPlan(plan.date);

                if (existingPlan && existingPlan.blocks && existingPlan.blocks.length > 0) {
                    // Identify Protected Blocks (Completed/Active)
                    // We want to keep anything that is marked DONE, IN_PROGRESS, or PAUSED
                    const lockedBlocks = existingPlan.blocks.filter(b => 
                        b.status === 'DONE' || 
                        b.status === 'IN_PROGRESS' || 
                        b.status === 'PAUSED' ||
                        b.completionStatus === 'PARTIAL' ||
                        b.completionStatus === 'COMPLETED'
                    );

                    // The AI parser generates fresh blocks. We should append them, but check for overlap.
                    // If AI generates a block at 9:00, and we have a DONE block at 9:00, we KEEP the DONE block.
                    // We remove the AI block if it strictly conflicts with a LOCKED block.
                    
                    const newBlocksFiltered = (plan.blocks || []).filter(newB => {
                        const newStart = parseTimeMinutes(newB.plannedStartTime);
                        const newEnd = parseTimeMinutes(newB.plannedEndTime);
                        
                        // Check intersection with ANY locked block
                        const hasOverlap = lockedBlocks.some(lockedB => {
                            const lockedStart = parseTimeMinutes(lockedB.plannedStartTime);
                            const lockedEnd = parseTimeMinutes(lockedB.plannedEndTime);
                            // Standard Overlap: (StartA < EndB) and (EndA > StartB)
                            return newStart < lockedEnd && newEnd > lockedStart;
                        });
                        
                        return !hasOverlap;
                    });

                    // Merge & Sort
                    const mergedBlocks = [...lockedBlocks, ...newBlocksFiltered].sort((a, b) => 
                        parseTimeMinutes(a.plannedStartTime) - parseTimeMinutes(b.plannedStartTime)
                    );

                    // Re-index
                    mergedBlocks.forEach((b, idx) => b.index = idx);

                    // Update Plan
                    plan.blocks = mergedBlocks;
                    plan.totalStudyMinutesPlanned = mergedBlocks.reduce((acc, b) => b.type !== 'BREAK' ? acc + b.plannedDurationMinutes : acc, 0);
                }
                // MERGE LOGIC END

                await saveDayPlan(plan);
                summaryText += `📅 **${plan.date}**: ${plan.blocks?.length} blocks (inc. video speeds)\n`;
            }
            summaryText += `\nYou can view them in the "Today's Plan" section or Calendar.`;

            // Refresh current day blocks if today was updated
            if (parsedPlans.some(p => p.date === todayStr)) {
                await loadTodaysBlocks();
            }

            const modelMsg: MentorMessage = {
                id: generateId(),
                role: 'model',
                text: summaryText,
                timestamp: new Date().toISOString(),
                isSystemAction: true,
                actionType: 'VIEW_PLAN',
                actionPayload: { date: parsedPlans[0].date } // Link to first day found
            };
            setMentorMessages(prev => [...prev, modelMsg]);
            await saveMentorMessage(modelMsg);
        } else {
            const errorMsg: MentorMessage = {
                id: generateId(),
                role: 'model',
                text: "I couldn't parse that command.\n\n**To update Knowledge Base:** Paste a JSON object (or Array) with `pageNumber`, `title`, `topics`, `keyPoints`.\n**To create a schedule:** Use 'HH:MM - HH:MM -> Task'.",
                timestamp: new Date().toISOString(),
            };
            setMentorMessages(prev => [...prev, errorMsg]);
        }
        setIsTyping(false);
        return;
    }


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
                  aiSettings,
                  selectedModel // Pass selected model
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

                           // If the AI provided detailed blocks (from schedule parsing), use them.
                           // Otherwise generate default blocks from summary
                           if (!planArgs.blocks || planArgs.blocks.length === 0) {
                               planArgs.blocks = generateBlocks(planArgs, 30);
                               planArgs.blockDurationSetting = 30;
                           } else {
                               // Ensure AI provided blocks have IDs and indexes
                               planArgs.blocks = planArgs.blocks.map((b, idx) => ({
                                   ...b,
                                   id: generateId(),
                                   index: idx,
                                   status: 'NOT_STARTED',
                                   // Calculate duration if missing based on times
                                   plannedDurationMinutes: b.plannedDurationMinutes || 
                                       (b.plannedStartTime && b.plannedEndTime ? 
                                           (parseInt(b.plannedEndTime.split(':')[0])*60 + parseInt(b.plannedEndTime.split(':')[1])) - 
                                           (parseInt(b.plannedStartTime.split(':')[0])*60 + parseInt(b.plannedStartTime.split(':')[1])) 
                                       : 30),
                                   tasks: b.tasks?.map(t => ({
                                       ...t,
                                       id: generateId(),
                                       completed: false
                                   }))
                               }));
                           }

                           // Removed Auto Snapshot

                           // MERGE LOGIC START: Preserve existing history
                           const existingPlan = await getDayPlan(planArgs.date);

                           if (existingPlan && existingPlan.blocks && existingPlan.blocks.length > 0) {
                               // 1. Identify Protected Blocks (Completed/Active)
                               const lockedBlocks = existingPlan.blocks.filter(b => 
                                   b.status === 'DONE' || 
                                   b.status === 'IN_PROGRESS' || 
                                   b.status === 'PAUSED' ||
                                   b.completionStatus === 'PARTIAL' ||
                                   b.completionStatus === 'NOT_DONE' ||
                                   b.completionStatus === 'COMPLETED'
                               );

                               // 2. Filter New Blocks (Remove overlaps with locked blocks)
                               const newBlocksFiltered = (planArgs.blocks || []).filter(newB => {
                                   const newStart = parseTimeMinutes(newB.plannedStartTime);
                                   const newEnd = parseTimeMinutes(newB.plannedEndTime);
                                   
                                   // Check intersection with ANY locked block
                                   const hasOverlap = lockedBlocks.some(lockedB => {
                                       const lockedStart = parseTimeMinutes(lockedB.plannedStartTime);
                                       const lockedEnd = parseTimeMinutes(lockedB.plannedEndTime);
                                       // Overlap condition: (StartA < EndB) and (EndA > StartB)
                                       return newStart < lockedEnd && newEnd > lockedStart;
                                   });
                                   
                                   // If no overlap, keep it
                                   return !hasOverlap;
                               });

                               // 3. Merge & Sort
                               const mergedBlocks = [...lockedBlocks, ...newBlocksFiltered].sort((a, b) => 
                                   parseTimeMinutes(a.plannedStartTime) - parseTimeMinutes(b.plannedStartTime)
                               );

                               // 4. Re-index
                               mergedBlocks.forEach((b, idx) => b.index = idx);

                               // 5. Update Plan Args
                               planArgs.blocks = mergedBlocks;
                               
                               // Recalculate total minutes based on merged blocks
                               planArgs.totalStudyMinutesPlanned = mergedBlocks.reduce((acc, b) => {
                                   return b.type !== 'BREAK' ? acc + b.plannedDurationMinutes : acc;
                               }, 0);
                           }
                           // MERGE LOGIC END

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
                           // Removed Auto Snapshot
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
              
              const response = await chatWithStudyBuddy(
                  historyForApi, 
                  textToSend, 
                  activeMaterial.text, 
                  selectedModel // Pass selected model
              );
              
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
    <div className="flex flex-col h-full card-3d rounded-2xl overflow-hidden relative">
        <div className="p-4 border-b border-white/20 dark:border-slate-700/50 bg-white/20 dark:bg-black/10 backdrop-blur-sm z-10 flex flex-col sm:flex-row justify-between items-center gap-3">
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
                {/* Model Selector */}
                <select 
                    value={selectedModel} 
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="bg-slate-100/50 dark:bg-slate-900/50 border-none text-xs font-bold text-slate-600 dark:text-slate-300 rounded-lg py-1.5 pl-2 pr-6 cursor-pointer focus:ring-0 outline-none backdrop-blur-sm"
                >
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                    {mode === 'MENTOR' && <option value="chatbot">Chat Bot (Local)</option>}
                </select>

                {mode === 'MENTOR' && (
                    <button onClick={handleClearChat} className="text-slate-400 hover:text-red-500 p-2" title="Clear History">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                )}
                <div className="flex bg-slate-100/50 dark:bg-slate-900/50 p-1 rounded-lg backdrop-blur-sm">
                    <button 
                        onClick={() => setMode('MENTOR')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${mode === 'MENTOR' ? 'bg-white/80 dark:bg-slate-700/80 text-indigo-600 dark:text-indigo-300 shadow-sm backdrop-blur-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                    >
                        Mentor
                    </button>
                    <button 
                        onClick={() => setMode('BUDDY')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${mode === 'BUDDY' ? 'bg-white/80 dark:bg-slate-700/80 text-blue-600 dark:text-blue-300 shadow-sm backdrop-blur-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                    >
                        Study Buddy
                    </button>
                </div>
            </div>
        </div>

        {(mode === 'BUDDY' || (mode === 'MENTOR' && activeMaterial)) && (
            <div className="p-2 bg-blue-50/50 dark:bg-blue-900/10 border-b border-white/20 dark:border-slate-700/50 flex items-center justify-between px-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 overflow-hidden">
                    <DocumentTextIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">
                        {activeMaterial ? `Using: ${activeMaterial.title}` : "No active material selected"}
                    </span>
                </div>
                <button onClick={loadMaterials} className="text-[10px] text-blue-600 hover:underline">Refresh</button>
            </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-6 relative z-0 custom-scrollbar" ref={scrollRef}>
            {currentMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`relative group max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-sm text-sm leading-relaxed whitespace-pre-wrap transition-all duration-300 ${
                        msg.role === 'user' 
                        ? mode === 'MENTOR' 
                             ? 'bg-indigo-600 text-white rounded-tr-none'
                             : 'bg-blue-600 text-white rounded-tr-none'
                        : msg.isSystemAction 
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center gap-2'
                            : 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-white/20 dark:border-slate-700/50 text-slate-700 dark:text-slate-200 rounded-tl-none'
                    }`}>
                        {msg.isSystemAction ? (
                             <div className="flex flex-col w-full">
                                 <div className="flex items-center gap-2">
                                     <CheckCircleIcon className="w-4 h-4" /> 
                                     <span className="font-bold">{msg.actionType === 'CONFIRM_IMPORT' ? 'Data Recognized' : 'Action Completed'}</span>
                                 </div>
                                 <p className="mt-1 opacity-90">{msg.text}</p>
                                 
                                 {msg.actionType === 'VIEW_PLAN' && msg.actionPayload?.date && (
                                     <button 
                                        onClick={() => onViewDayPlan(msg.actionPayload.date)}
                                        className="mt-3 bg-white/40 hover:bg-white/60 text-emerald-900 dark:text-emerald-100 text-xs font-bold py-2 px-3 rounded-lg text-left w-full flex items-center justify-between transition-colors border border-emerald-200 dark:border-emerald-700 backdrop-blur-sm"
                                     >
                                        <span className="flex items-center gap-2">
                                            <CalendarIcon className="w-4 h-4" /> Open Plan for {msg.actionPayload.date}
                                        </span>
                                        <ArrowRightIcon className="w-3 h-3" />
                                     </button>
                                 )}

                                 {msg.actionType === 'CONFIRM_IMPORT' && msg.actionPayload && (
                                     <div className="mt-3 flex flex-wrap gap-2">
                                         <button 
                                            onClick={() => handleImportAction('KB', msg.actionPayload)}
                                            className="flex items-center gap-1 bg-white/60 hover:bg-white/80 text-indigo-700 px-3 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors backdrop-blur-sm"
                                         >
                                             <DatabaseIcon className="w-3 h-3" /> Update Knowledge Base
                                         </button>
                                         <button 
                                            onClick={() => handleImportAction('PLAN', msg.actionPayload)}
                                            className="flex items-center gap-1 bg-white/60 hover:bg-white/80 text-blue-700 px-3 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors backdrop-blur-sm"
                                         >
                                             <PlusIcon className="w-3 h-3" /> Add to Today's Plan
                                         </button>
                                         <button 
                                            onClick={() => handleImportAction('BOTH', msg.actionPayload)}
                                            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors"
                                         >
                                             <CheckCircleIcon className="w-3 h-3" /> Do Both
                                         </button>
                                     </div>
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
                        
                        <div className={`text-[10px] mt-2 font-medium opacity-70 text-right select-none ${msg.role === 'user' ? 'text-indigo-100' : 'text-slate-400'}`}>
                            {new Date(msg.timestamp).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                </div>
            ))}
            {isTyping && (
                <div className="flex justify-start">
                    <div className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl rounded-tl-none p-4 shadow-sm">
                        <div className="flex gap-1.5">
                            <span className={`w-2 h-2 rounded-full animate-bounce ${mode === 'MENTOR' ? 'bg-indigo-400' : 'bg-blue-400'}`} style={{ animationDelay: '0s' }}></span>
                            <span className={`w-2 h-2 rounded-full animate-bounce ${mode === 'MENTOR' ? 'bg-purple-400' : 'bg-cyan-400'}`} style={{ animationDelay: '0.2s' }}></span>
                            <span className={`w-2 h-2 rounded-full animate-bounce ${mode === 'MENTOR' ? 'bg-fuchsia-400' : 'bg-teal-400'}`} style={{ animationDelay: '0.4s' }}></span>
                        </div>
                    </div>
                </div>
            )}
        </div>

        <div className="p-4 border-t border-white/20 dark:border-slate-700/50 bg-white/20 dark:bg-black/10 backdrop-blur-sm z-10">
            {attachedImage && (
                <div className="mb-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-start justify-between animate-fade-in-up text-xs border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 overflow-hidden">
                        {attachedImage.mimeType.startsWith('image/') ? (
                             <img src={`data:${attachedImage.mimeType};base64,${attachedImage.data}`} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                        ) : (
                            <DocumentTextIcon className="w-8 h-8 text-slate-500 flex-shrink-0" />
                        )}
                        <span className="font-medium text-slate-700 dark:text-slate-200 truncate">{attachedImage.filename}</span>
                    </div>
                    <button onClick={handleRemoveAttachment} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full">
                        <XMarkIcon className="w-4 h-4 text-slate-500" />
                    </button>
                </div>
            )}
            <div className="relative flex items-end gap-2 w-full">
                {/* UPLOAD BUTTON REMOVED */}
                {/* 
                <label className={`flex-shrink-0 p-3 self-stretch flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${isUploadingFile ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <PaperClipIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    <input type="file" onChange={handleFileSelect} className="hidden" disabled={isUploadingFile} />
                </label>
                */}
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
                    placeholder={mode === 'MENTOR' ? "Ask your mentor anything..." : "Ask about your study material..."}
                    className="flex-1 w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl resize-none text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white max-h-[400px] shadow-inner"
                    rows={1}
                />
                <button
                    onClick={handleSend}
                    // disabled={(!input.trim() && !attachedImage) || isTyping || isUploadingFile}
                    disabled={(!input.trim() && !attachedImage) || isTyping}
                    className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:scale-95 disabled:shadow-none"
                >
                    <PaperAirplaneIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    </div>
  );
};
