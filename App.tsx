import React, { useState, useEffect, useMemo } from 'react';
import { StudySession, FilterType, StudyLog, ToDoItem, KnowledgeBaseEntry, StudyPlanItem, VideoResource, CATEGORIES, SYSTEMS, PlanLog, getAdjustedDate, DEFAULT_INTERVALS, AppSettings, ThemeColor, Attachment } from './types';
import { PlusIcon, ChartBarIcon, CalendarIcon, ListCheckIcon, DatabaseIcon, CalendarPlusIcon, Bars3Icon, FireIcon, XMarkIcon, ArrowPathIcon, Cog6ToothIcon, TrophyIcon, ChatBubbleLeftRightIcon } from './components/Icons';
import SessionModal from './components/SessionModal';
import SessionRow from './components/SessionRow';
import StatsCard from './components/StatsCard';
import RevisionForecast from './components/RevisionForecast';
import LogRevisionModal from './components/LogRevisionModal';
import DailyViewModal from './components/DailyViewModal';
import GlobalTaskList from './components/GlobalTaskList';
import KnowledgeBaseView from './components/KnowledgeBaseView';
import PlannerView from './components/PlannerView';
import TimerModal from './components/TimerModal';
import PageAnalysisModal from './components/PageAnalysisModal';
import RevisionView from './components/RevisionView';
import SettingsView from './components/SettingsView';
import { PageDetailModal } from './components/PageDetailModal'; 
import { CalendarView } from './components/CalendarView';
import { DashboardAIWidget } from './components/DashboardAIWidget';
import { AIChatView } from './components/AIChatView';
import { analyzeProgress } from './services/geminiService';
import { getData, saveData } from './services/dbService';

type ViewMode = 'DASHBOARD' | 'TASKS' | 'DATABASE' | 'PLANNER' | 'CALENDAR' | 'REVISION' | 'SETTINGS' | 'AI_CHAT';

const COLORS_RGB: Record<ThemeColor, string> = {
    indigo: '79 70 229',
    emerald: '16 185 129',
    rose: '244 63 94',
    amber: '245 158 11',
    sky: '14 165 233',
    violet: '139 92 246'
};

const App: React.FC = () => {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseEntry[]>([]);
  const [studyPlan, setStudyPlan] = useState<StudyPlanItem[]>([]);
  
  // Settings State
  const [settings, setSettings] = useState<AppSettings>({
      darkMode: false,
      primaryColor: 'indigo',
      fontSize: 'medium'
  });

  const [filter, setFilter] = useState<FilterType>(FilterType.ALL);
  
  // Navigation State
  const [viewMode, setViewMode] = useState<ViewMode>('DASHBOARD');
  const [previousViewMode, setPreviousViewMode] = useState<ViewMode>('DASHBOARD'); 
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [examDate, setExamDate] = useState<string | null>(null);
  const [isExamDateModalOpen, setIsExamDateModalOpen] = useState(false);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [isPageAnalysisOpen, setIsPageAnalysisOpen] = useState(false);
  const [dailyViewDate, setDailyViewDate] = useState<Date | null>(null);
  
  // Page Detail Modal State
  const [selectedPageDetail, setSelectedPageDetail] = useState<string | null>(null);

  // Timer
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [activePlanItem, setActivePlanItem] = useState<StudyPlanItem | null>(null);

  const [editingSession, setEditingSession] = useState<StudySession | null>(null);
  const [revisingSession, setRevisingSession] = useState<StudySession | null>(null);
  
  // Prefill State
  const [sessionPrefill, setSessionPrefill] = useState<(Partial<StudySession> & { startTime?: string; endTime?: string }) | null>(null);

  // Load Data (Async from IndexedDB)
  useEffect(() => {
    const initializeData = async () => {
        try {
            // 1. Try loading from IndexedDB
            const dbSessions = await getData<StudySession[]>('sessions');
            const dbKB = await getData<KnowledgeBaseEntry[]>('knowledgeBase');
            const dbPlan = await getData<StudyPlanItem[]>('studyPlan');
            const dbSettings = await getData<AppSettings>('settings');
            const dbExamDate = await getData<string>('examDate');

            // If data exists, load it
            if (dbSessions) setSessions(dbSessions);
            if (dbKB) setKnowledgeBase(dbKB);
            if (dbPlan) setStudyPlan(dbPlan);
            if (dbSettings) setSettings(dbSettings);
            if (dbExamDate) setExamDate(dbExamDate);

            // 2. Check if we need to Seed Data (First Run or Empty DB)
            // If sessions are empty/null, we assume it's a fresh start and populate seed data
            if (!dbSessions || dbSessions.length === 0) {
                // Check local storage for migration before seeding
                const lsSessions = localStorage.getItem('focusflow_sessions_v2');
                if (lsSessions) {
                     // Migration path
                     const parsed = JSON.parse(lsSessions);
                     setSessions(parsed);
                     await saveData('sessions', parsed);
                     // Load other LS items...
                     const lsKB = localStorage.getItem('focusflow_kb_v1');
                     if (lsKB) {
                         const parsedKB = JSON.parse(lsKB);
                         setKnowledgeBase(parsedKB);
                         await saveData('knowledgeBase', parsedKB);
                     }
                } else {
                    // Total fresh start -> Seed
                    await generateSeedData();
                }
            }

        } catch (e) {
            console.error("Failed to initialize data:", e);
        }
    };

    initializeData();
  }, []);

  // Apply Settings Effect
  useEffect(() => {
      const root = document.documentElement;
      
      // Dark Mode
      if (settings.darkMode) {
          root.classList.add('dark');
      } else {
          root.classList.remove('dark');
      }

      // Primary Color
      const rgb = COLORS_RGB[settings.primaryColor] || COLORS_RGB['indigo'];
      root.style.setProperty('--color-primary', rgb);

      // Font Size
      let scale = '100%';
      if (settings.fontSize === 'small') scale = '87.5%';
      if (settings.fontSize === 'large') scale = '112.5%';
      root.style.fontSize = scale;

      saveData('settings', settings);
  }, [settings]);

  const generateSeedData = async () => {
      const systemsMap: Record<string, string[]> = {
        'Cardiovascular': ['Heart Failure', 'Hypertension', 'Shock Types', 'EKG Basics', 'Valvular Diseases', 'Cardiomyopathy'],
        'Respiratory': ['Pneumonia', 'Asthma vs COPD', 'Lung Cancer', 'ARDS', 'Pulmonary Embolism'],
        'Neurology': ['Stroke Syndromes', 'Seizures', 'Headache Types', 'Neurodegenerative Diseases', 'Cranial Nerves'],
        'Renal': ['AKI vs CKD', 'Glomerulonephritis', 'Acid-Base Balance', 'Electrolyte Disorders'],
        'Gastrointestinal': ['IBD: Crohn\'s vs UC', 'Liver Cirrhosis', 'Pancreatitis', 'Malabsorption'],
        'Endocrine': ['Diabetes Mellitus', 'Thyroid Disorders', 'Adrenal Disorders', 'Calcium Homeostasis'],
        'Hematology/Oncology': ['Anemias', 'Leukemias', 'Coagulation Cascade', 'Lymphomas'],
        'Infectious Disease': ['Antibiotics Classes', 'HIV/AIDS', 'Tuberculosis', 'Sepsis Guidelines']
      };

      const sessionsMap = new Map<string, StudySession>();
      const kbMap = new Map<string, KnowledgeBaseEntry>();

      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 2); // 2 Years ago
      const today = new Date();
      
      let currentDate = new Date(startDate);
      
      // Iterate day by day
      while (currentDate <= today) {
          // 40% chance to study on any given day
          if (Math.random() > 0.4) {
              const dailySessionsCount = Math.floor(Math.random() * 3) + 1; // 1-3 topics
              
              for (let i = 0; i < dailySessionsCount; i++) {
                  const sysKeys = Object.keys(systemsMap);
                  const system = sysKeys[Math.floor(Math.random() * sysKeys.length)];
                  const topics = systemsMap[system];
                  const topic = topics[Math.floor(Math.random() * topics.length)];
                  
                  // Consistent page number for topic
                  let pageNum = (100 + topics.indexOf(topic) * 15 + sysKeys.indexOf(system) * 50).toString(); 

                  const duration = 20 + Math.floor(Math.random() * 100);
                  const startTime = new Date(currentDate);
                  startTime.setHours(9 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60)); // 9AM - 9PM
                  const endTime = new Date(startTime.getTime() + duration * 60000);
                  const startISO = startTime.toISOString();
                  const endISO = endTime.toISOString();

                  const log: StudyLog = {
                      id: crypto.randomUUID(),
                      date: startISO,
                      startTime: startISO,
                      endTime: endISO,
                      durationMinutes: duration,
                      type: 'INITIAL',
                      notes: Math.random() > 0.8 ? "Key concepts revised." : undefined,
                      ankiDelta: Math.floor(Math.random() * 15)
                  };

                  if (sessionsMap.has(topic)) {
                      // Revision
                      const s = sessionsMap.get(topic)!;
                      log.type = 'REVISION';
                      
                      // Update Interval
                      let nextIdx = s.currentIntervalIndex + 1;
                      if (nextIdx >= s.revisionIntervals.length) nextIdx = s.revisionIntervals.length - 1;
                      
                      // Next revision date relative to THIS log's end time
                      const hours = s.revisionIntervals[nextIdx];
                      const nextRev = new Date(endTime.getTime() + hours * 60 * 60 * 1000).toISOString();

                      sessionsMap.set(topic, {
                          ...s,
                          history: [log, ...s.history],
                          currentIntervalIndex: nextIdx,
                          nextRevisionDate: nextRev,
                          lastStudied: startISO,
                          ankiCovered: Math.min(s.ankiTotal || 50, (s.ankiCovered || 0) + (log.ankiDelta || 0))
                      });
                  } else {
                      // New
                      const newSession: StudySession = {
                          id: crypto.randomUUID(),
                          topic: topic,
                          pageNumber: pageNum,
                          category: 'Pathology',
                          system: system,
                          revisionIntervals: DEFAULT_INTERVALS,
                          currentIntervalIndex: 0,
                          nextRevisionDate: new Date(endTime.getTime() + 24 * 60 * 60 * 1000).toISOString(),
                          ankiDone: false,
                          ankiTotal: 30 + Math.floor(Math.random() * 20),
                          ankiCovered: log.ankiDelta || 0,
                          history: [log],
                          lastStudied: startISO,
                          notes: `Study notes for ${topic}`
                      };
                      sessionsMap.set(topic, newSession);
                  }
              }
          }
          currentDate.setDate(currentDate.getDate() + 1);
      }

      const finalSessions = Array.from(sessionsMap.values());
      
      // Build Knowledge Base
      finalSessions.forEach(s => {
          kbMap.set(s.pageNumber, {
              pageNumber: s.pageNumber,
              topic: s.topic,
              subject: s.category,
              system: s.system || 'General',
              ankiTotal: s.ankiTotal || 0,
              videoLinks: [],
              tags: [s.system || ''],
              notes: s.notes || '',
              attachments: []
          });
      });
      
      const finalKB = Array.from(kbMap.values());

      // Update State & DB
      setSessions(finalSessions);
      setKnowledgeBase(finalKB);
      
      await saveData('sessions', finalSessions);
      await saveData('knowledgeBase', finalKB);
      console.log(`Seeded ${finalSessions.length} sessions over 2 years.`);
  };

  // Save Data (Async) - Use effects to trigger saves on state change
  useEffect(() => { saveData('sessions', sessions); }, [sessions]);
  useEffect(() => { saveData('knowledgeBase', knowledgeBase); }, [knowledgeBase]);
  useEffect(() => { saveData('studyPlan', studyPlan); }, [studyPlan]);
  useEffect(() => { 
      if (examDate) {
          saveData('examDate', examDate); 
      } else {
          saveData('examDate', null);
      }
  }, [examDate]);

  const streak = useMemo(() => {
    const dates = new Set<string>();
    sessions.forEach(s => {
        s.history.forEach(h => {
            dates.add(getAdjustedDate(h.startTime));
        });
    });

    const sortedDates = Array.from(dates).sort().reverse();
    if (sortedDates.length === 0) return 0;
    
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const todayStr = getAdjustedDate(new Date());
    const yesterdayStr = getAdjustedDate(yesterdayDate);

    if (!dates.has(todayStr) && !dates.has(yesterdayStr)) return 0;

    let currentStreak = 0;
    let checkDate = new Date();
    if (checkDate.getHours() < 4) checkDate.setDate(checkDate.getDate() - 1);

    const checkDateStr = getAdjustedDate(checkDate);
    if (!dates.has(checkDateStr)) {
        checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
        const dateStr = getAdjustedDate(checkDate);
        if (dates.has(dateStr)) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }
    return currentStreak;
  }, [sessions]);

  const bestStreakInfo = useMemo(() => {
      const dates = new Set<string>();
      sessions.forEach(s => {
          s.history.forEach(h => {
              dates.add(getAdjustedDate(h.startTime));
          });
      });

      const sortedDates = Array.from(dates).sort();
      if (sortedDates.length === 0) return { count: 0, endDate: null };

      let maxStreak = 0;
      let currentStreak = 0;
      let maxStreakEndDate = sortedDates[0];
      
      // Using simple consecutive day check on sorted ISO strings
      let prevDateVal: number | null = null;

      for (const dateStr of sortedDates) {
          const d = new Date(dateStr);
          // Set to midnight to avoid DST issues, although ISO string parsing usually works for YYYY-MM-DD
          // Using getTime() on the date part ensures safe math
          const currentVal = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

          if (prevDateVal === null) {
              currentStreak = 1;
          } else {
              // 86400000 ms in a day
              const diff = (currentVal - prevDateVal) / 86400000;
              if (Math.round(diff) === 1) {
                  currentStreak++;
              } else {
                  currentStreak = 1;
              }
          }

          if (currentStreak >= maxStreak) {
              maxStreak = currentStreak;
              maxStreakEndDate = dateStr;
          }
          prevDateVal = currentVal;
      }

      return { count: maxStreak, endDate: maxStreakEndDate };
  }, [sessions]);

  const daysLeft = useMemo(() => {
      if (!examDate) return null;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const [y, m, d] = examDate.split('-').map(Number);
      const target = new Date(y, m - 1, d);
      const diffTime = target.getTime() - today.getTime();
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return days >= 0 ? days : 0;
  }, [examDate]);

  const todayDateDisplay = useMemo(() => {
      const adjString = getAdjustedDate(new Date());
      const [y, m, d] = adjString.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return {
          month: dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
          day: dateObj.getDate()
      };
  }, []);

  const toggleCalendarView = () => {
      if (viewMode === 'CALENDAR') {
          setViewMode(previousViewMode);
      } else {
          setPreviousViewMode(viewMode);
          setViewMode('CALENDAR');
      }
  };

  const handleViewPageDetail = (pageNumber: string) => {
      setSelectedPageDetail(pageNumber);
  };

  const handleSaveSession = (data: any) => {
    const existingIndex = sessions.findIndex(s => s.pageNumber === data.pageNumber);
    let updatedSessions = [...sessions];
    const latestLog = data.history[0]; 
    if (!latestLog) return;

    if (existingIndex >= 0) {
        const existing = sessions[existingIndex];
        const isDue = existing.nextRevisionDate && new Date(existing.nextRevisionDate) <= new Date();
        let nextIndex = existing.currentIntervalIndex;
        let nextRevision = existing.nextRevisionDate;
        
        if (isDue || latestLog.type === 'REVISION') {
             nextIndex = Math.min(existing.currentIntervalIndex + 1, existing.revisionIntervals.length - 1);
             const hours = existing.revisionIntervals[nextIndex];
             nextRevision = new Date(new Date(latestLog.endTime).getTime() + hours * 60 * 60 * 1000).toISOString();
        }

        updatedSessions[existingIndex] = {
            ...existing,
            topic: data.topic,
            notes: data.notes,
            ankiCovered: data.ankiCovered,
            ankiTotal: data.ankiTotal,
            ankiDone: data.ankiDone,
            toDoList: data.toDoList, 
            history: data.history,
            currentIntervalIndex: nextIndex,
            nextRevisionDate: nextRevision,
            lastStudied: latestLog.startTime
        };
        setSessions(updatedSessions);
    } else {
        const intervalHours = data.revisionIntervals[0] || 24;
        const nextDue = new Date(new Date(latestLog.endTime).getTime() + intervalHours * 60 * 60 * 1000).toISOString();

        const newSession: StudySession = {
            id: crypto.randomUUID(),
            topic: data.topic,
            pageNumber: data.pageNumber,
            category: data.category,
            system: data.system,
            ankiDone: data.ankiDone,
            ankiTotal: data.ankiTotal,
            ankiCovered: data.ankiCovered,
            toDoList: data.toDoList,
            revisionIntervals: data.revisionIntervals,
            currentIntervalIndex: 0,
            nextRevisionDate: nextDue,
            history: data.history,
            notes: data.notes,
            lastStudied: latestLog.startTime
        };
        setSessions([newSession, ...sessions]);
    }

    updateKnowledgeBase(data);
    
    if (activePlanItem) {
        const planUpdates = data.planUpdates;
        setStudyPlan(prev => prev.map(p => {
            if (p.id !== activePlanItem.id) return p;
            const planLog: PlanLog = {
                id: crypto.randomUUID(),
                date: latestLog.date,
                startTime: latestLog.startTime,
                endTime: latestLog.endTime,
                durationMinutes: latestLog.durationMinutes,
                notes: latestLog.notes
            };
            let updatedSubTasks = p.subTasks;
            if (planUpdates && planUpdates.completedSubTaskIds) {
                updatedSubTasks = p.subTasks?.map(t => ({
                    ...t,
                    done: planUpdates.completedSubTaskIds.includes(t.id)
                }));
            }
            
            const isFinished = planUpdates ? planUpdates.isFinished : p.isCompleted;
            
            return {
                ...p,
                logs: [...(p.logs || []), planLog],
                totalMinutesSpent: (p.totalMinutesSpent || 0) + latestLog.durationMinutes,
                subTasks: updatedSubTasks,
                isCompleted: isFinished,
                // Set completedAt timestamp if finishing now
                completedAt: isFinished && !p.isCompleted ? new Date().toISOString() : p.completedAt
            };
        }));
        setActivePlanItem(null);
    }
  };

  const updateKnowledgeBase = (data: any) => {
    setKnowledgeBase(prev => {
        const existingIndex = prev.findIndex(k => k.pageNumber === data.pageNumber);
        if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = {
                ...updated[existingIndex],
                topic: data.topic,
                subject: data.category || data.subject,
                system: data.system,
                ankiTotal: data.ankiTotal || updated[existingIndex].ankiTotal,
                notes: data.notes ? data.notes : updated[existingIndex].notes,
                attachments: data.attachments !== undefined ? data.attachments : updated[existingIndex].attachments
            };
            return updated;
        } else {
            return [...prev, {
                pageNumber: data.pageNumber,
                topic: data.topic,
                subject: data.category || data.subject || 'Other',
                system: data.system || 'General Principles',
                ankiTotal: data.ankiTotal || 0,
                videoLinks: [],
                tags: [],
                notes: data.notes || '',
                attachments: data.attachments || []
            }];
        }
    });
  };

  const handleAddToPlan = (item: Omit<StudyPlanItem, 'id'>, newVideo?: VideoResource, attachments?: Attachment[]) => {
    // 1. Update Plan State
    setStudyPlan(prev => [...prev, { 
        ...item, 
        id: crypto.randomUUID(), 
        attachments,
        createdAt: new Date().toISOString() // Add creation timestamp
    }]);

    // 2. Update Knowledge Base (Sync Resources)
    if (item.pageNumber) {
        setKnowledgeBase(prev => {
            const existingIndex = prev.findIndex(k => k.pageNumber === item.pageNumber);
            
            if (existingIndex >= 0) {
                const entry = prev[existingIndex];
                const updatedVideoLinks = [...entry.videoLinks];
                
                if (newVideo && !updatedVideoLinks.some(v => v.url === newVideo.url)) {
                    updatedVideoLinks.push(newVideo);
                }

                const updatedAttachments = [...(entry.attachments || [])];
                if (attachments) {
                    updatedAttachments.push(...attachments);
                }

                const updatedKB = [...prev];
                updatedKB[existingIndex] = {
                    ...entry,
                    videoLinks: updatedVideoLinks,
                    attachments: updatedAttachments
                };
                return updatedKB;
            } else {
                // Create new entry if it doesn't exist
                return [...prev, {
                    pageNumber: item.pageNumber,
                    topic: item.topic,
                    subject: 'Other',
                    system: 'General Principles',
                    ankiTotal: item.ankiCount || 0,
                    videoLinks: newVideo ? [newVideo] : [],
                    tags: [],
                    notes: '',
                    attachments: attachments || []
                }];
            }
        });
    }
  };

  const handleUpdatePlanItem = (item: StudyPlanItem) => {
      setStudyPlan(prev => prev.map(p => p.id === item.id ? item : p));
  };

  const handleTogglePlanSubTask = (planId: string, subTaskId: string) => {
      setStudyPlan(prev => prev.map(p => {
          if (p.id !== planId) return p;
          return {
              ...p,
              subTasks: p.subTasks?.map(t => t.id === subTaskId ? { ...t, done: !t.done } : t)
          };
      }));
  };

  const handleDeletePlanLog = (planId: string, logId: string) => {
      if(!confirm("Delete this history entry from the plan?")) return;
      setStudyPlan(prev => prev.map(p => {
          if (p.id !== planId) return p;
          const log = p.logs?.find(l => l.id === logId);
          const duration = log ? log.durationMinutes : 0;
          return {
              ...p,
              logs: p.logs?.filter(l => l.id !== logId),
              totalMinutesSpent: Math.max(0, (p.totalMinutesSpent || 0) - duration)
          };
      }));
  };

  const handleStartTask = (item: StudyPlanItem) => {
      setActivePlanItem(item);
      setIsTimerOpen(true);
  };

  const handleCompletePlanItem = (item: StudyPlanItem) => {
      setActivePlanItem(item);
      setSessionPrefill({
          topic: item.topic,
          pageNumber: item.pageNumber,
          ankiTotal: item.ankiCount || 0,
      });
      setEditingSession(null);
      setIsModalOpen(true);
  };

  const handleManageSession = (session: StudySession) => {
      setEditingSession(session);
      setIsModalOpen(true);
  }

  const handleTimerFinish = (startTime: string, endTime: string) => {
      setIsTimerOpen(false);
      setSessionPrefill({
          topic: activePlanItem?.topic || '',
          pageNumber: activePlanItem?.pageNumber || '',
          ankiTotal: activePlanItem?.ankiCount || 0,
          startTime: startTime, 
          endTime: endTime      
      });
      setEditingSession(null);
      setIsModalOpen(true);
  };

  const handleDeleteSession = (id: string) => {
      if (confirm('Delete study history?')) setSessions(prev => prev.filter(s => s.id !== id));
  };
  
  const handleRevisionComplete = (startISO: string, endISO: string, updatedNotes?: string, updatedTodos?: ToDoItem[]) => {
     if (!revisingSession) return;
     const start = new Date(startISO);
     const end = new Date(endISO);
     const duration = Math.round((end.getTime() - start.getTime()) / 60000);

     const newLog: StudyLog = {
         id: crypto.randomUUID(),
         date: startISO,
         startTime: startISO,
         endTime: endISO,
         durationMinutes: duration,
         type: 'REVISION'
     };

     const nextIndex = revisingSession.currentIntervalIndex + 1;
     let nextDate: string | null = null;
     if (nextIndex < revisingSession.revisionIntervals.length) {
         const hoursToAdd = revisingSession.revisionIntervals[nextIndex];
         nextDate = new Date(end.getTime() + hoursToAdd * 60 * 60 * 1000).toISOString();
     }

     const updatedSession: StudySession = {
         ...revisingSession,
         history: [newLog, ...revisingSession.history],
         currentIntervalIndex: nextIndex,
         nextRevisionDate: nextDate,
         lastStudied: endISO,
         notes: updatedNotes !== undefined ? updatedNotes : revisingSession.notes,
         toDoList: updatedTodos !== undefined ? updatedTodos : revisingSession.toDoList
     };

     setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
     setRevisingSession(null);
     
     if (updatedNotes) {
         setKnowledgeBase(prev => prev.map(k => k.pageNumber === revisingSession.pageNumber ? { ...k, notes: updatedNotes } : k));
     }
  };

  const filteredSessions = useMemo(() => {
    let result = [...sessions];
    result.sort((a, b) => (a.nextRevisionDate ? new Date(a.nextRevisionDate).getTime() : Number.MAX_VALUE) - (b.nextRevisionDate ? new Date(b.nextRevisionDate).getTime() : Number.MAX_VALUE));
    
    if (filter === FilterType.DUE_TODAY) {
        const now = new Date();
        return result.filter(s => s.nextRevisionDate && new Date(s.nextRevisionDate) <= now);
    }
    if (filter === FilterType.MASTERED) return result.filter(s => !s.nextRevisionDate && s.currentIntervalIndex > 0);
    if (filter === FilterType.UPCOMING) return result.filter(s => s.nextRevisionDate);
    return result;
  }, [sessions, filter]);

  return (
    <div className="min-h-screen bg-background dark:bg-dark-bg text-slate-800 dark:text-dark-text font-sans selection:bg-primary/20 transition-colors duration-200">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 bg-white/90 dark:bg-dark-surface/90 backdrop-blur-md border-b border-slate-200 dark:border-dark-border">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between">
          <button 
            onClick={() => setIsSidebarOpen(true)} 
            className="p-2 flex-shrink-0 rounded-lg bg-primary text-white shadow-md shadow-indigo-200/50 hover:bg-indigo-600 transition-all active:scale-95"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>

          {/* Mobile Optimized Widget Area */}
          <div className="flex items-center gap-2 sm:gap-5 overflow-x-auto hide-scrollbar mask-linear-fade pl-2 py-1 max-w-[calc(100%-3rem)]">
            
            {/* Calendar Widget */}
            <div 
                onClick={toggleCalendarView}
                className={`flex flex-col flex-shrink-0 items-center bg-white dark:bg-dark-surface rounded-lg border shadow-sm w-10 sm:w-12 overflow-hidden cursor-pointer transition-all ${viewMode === 'CALENDAR' ? 'ring-2 ring-primary border-primary' : 'border-slate-200 dark:border-dark-border hover:ring-2 hover:ring-primary/30'}`}
                title={viewMode === 'CALENDAR' ? "Close Calendar" : "Open Calendar"}
            >
                <div className="bg-red-500 text-white text-[9px] sm:text-[10px] font-bold w-full text-center py-0.5 truncate">
                    {todayDateDisplay.month}
                </div>
                <div className="text-base sm:text-xl font-bold text-slate-800 dark:text-slate-200 pb-0.5">
                    {todayDateDisplay.day}
                </div>
            </div>

            {/* Exam Countdown */}
            <div 
                className="relative flex flex-shrink-0 items-center gap-2 cursor-pointer group"
                onClick={() => setIsExamDateModalOpen(true)}
            >
                <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path className="text-slate-100 dark:text-slate-700" strokeDasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth="3" />
                        <path className="text-primary" strokeDasharray={`${Math.min(100, (daysLeft || 0))}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth="3" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                         <span className="text-xs sm:text-sm font-bold text-primary leading-none">{daysLeft !== null ? daysLeft : '?'}</span>
                         <span className="text-[7px] sm:text-[8px] text-slate-400 font-bold uppercase">Days</span>
                    </div>
                </div>
            </div>

            {/* Streak & Best Streak */}
            <div className="flex flex-shrink-0 items-center gap-2">
                {/* Current Streak */}
                <div className={`flex flex-col items-center justify-center rounded-xl w-12 h-12 sm:w-14 sm:h-14 shadow-sm transition-all transform hover:scale-105 ${streak > 0 ? 'bg-gradient-to-br from-orange-500 to-red-600 text-white ring-1 ring-orange-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                    <FireIcon className={`w-5 h-5 sm:w-6 sm:h-6 ${streak > 0 ? 'text-yellow-300 fill-yellow-300 animate-pulse' : 'text-slate-300 dark:text-slate-600'}`} />
                    <span className={`text-xs sm:text-sm font-extrabold ${streak > 0 ? 'text-white' : 'text-slate-500 dark:text-slate-500'}`}>{streak}</span>
                </div>

                {/* Best Streak (New) */}
                {bestStreakInfo.count > 0 && (
                    <div className="flex flex-col items-start justify-center h-12 sm:h-14 px-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm min-w-[70px]">
                        <div className="flex items-center gap-1 text-yellow-500">
                            <TrophyIcon className="w-3 h-3" />
                            <span className="text-[9px] sm:text-[10px] font-bold uppercase truncate">Best</span>
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight">
                            {bestStreakInfo.count} d
                        </div>
                    </div>
                )}
            </div>

          </div>
        </div>
      </nav>

      {/* Sidebar */}
      <div className={`fixed inset-0 z-40 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
          <div className={`absolute inset-y-0 left-0 w-64 bg-white dark:bg-dark-surface shadow-2xl transform transition-transform duration-300 flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
               <div className="p-6 border-b border-slate-100 dark:border-dark-border flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <CalendarIcon className="text-white w-5 h-5" />
                        </div>
                        <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">FocusFlow</span>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
               </div>
               <div className="p-4 space-y-2 flex-grow overflow-y-auto">
                    {[
                        { id: 'DASHBOARD', label: 'Dashboard', icon: ChartBarIcon },
                        { id: 'AI_CHAT', label: 'AI Mentor Chat', icon: ChatBubbleLeftRightIcon },
                        { id: 'CALENDAR', label: 'Calendar', icon: CalendarIcon },
                        { id: 'REVISION', label: 'Revision', icon: ArrowPathIcon },
                        { id: 'PLANNER', label: 'Planner', icon: CalendarPlusIcon },
                        { id: 'TASKS', label: 'Global Tasks', icon: ListCheckIcon },
                        { id: 'DATABASE', label: 'Database', icon: DatabaseIcon },
                        { id: 'SETTINGS', label: 'Settings', icon: Cog6ToothIcon },
                    ].map(item => (
                         <button 
                            key={item.id}
                            onClick={() => { setViewMode(item.id as ViewMode); setIsSidebarOpen(false); }} 
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${viewMode === item.id ? 'bg-indigo-50 dark:bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        >
                            <item.icon className="w-5 h-5" /> {item.label}
                        </button>
                    ))}
               </div>
          </div>
      </div>

      {/* Exam Date Input Modal */}
      {isExamDateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-dark-surface rounded-2xl p-6 w-full max-w-sm shadow-xl animate-fade-in-up border border-slate-100 dark:border-dark-border">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Set Exam Target Date</h3>
                  <input 
                    type="date" 
                    value={examDate || ''} 
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full p-3 rounded-lg border border-slate-200 dark:border-dark-border dark:bg-slate-800 dark:text-white mb-4 text-slate-700 font-medium"
                  />
                  <div className="flex gap-3">
                      {examDate && (
                          <button onClick={() => { setExamDate(null); setIsExamDateModalOpen(false); }} className="px-4 py-2 rounded-lg border border-red-100 dark:border-red-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 font-medium">Clear</button>
                      )}
                      <button onClick={() => setIsExamDateModalOpen(false)} className="flex-1 py-2 rounded-lg bg-primary text-white font-bold shadow-md hover:bg-indigo-600 transition-all">Save Date</button>
                  </div>
              </div>
          </div>
      )}

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-8 pb-20 sm:pb-8">
        {viewMode === 'SETTINGS' && (
            <SettingsView settings={settings} onUpdateSettings={setSettings} />
        )}

        {viewMode === 'AI_CHAT' && (
            <AIChatView 
                sessions={sessions} 
                studyPlan={studyPlan} 
                streak={streak}
                onAddToPlan={handleAddToPlan} 
            />
        )}

        {viewMode === 'DASHBOARD' && (
            <>
                <DashboardAIWidget 
                    sessions={sessions} 
                    studyPlan={studyPlan} 
                    streak={streak} 
                    onOpenChat={() => setViewMode('AI_CHAT')}
                />
                <StatsCard 
                    sessions={sessions} 
                    studyPlan={studyPlan} 
                    onNavigateToPlanner={() => setViewMode('PLANNER')}
                    onViewAllPages={() => setIsPageAnalysisOpen(true)}
                    onNavigateToRevision={() => setViewMode('REVISION')}
                />
                <RevisionForecast sessions={sessions} onSelectDay={(d) => setDailyViewDate(d)} />
                
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div className="flex gap-2 overflow-x-auto pb-1 max-w-full hide-scrollbar">
                        {[{ label: 'All', val: FilterType.ALL }, { label: 'Due', val: FilterType.DUE_TODAY }, { label: 'Upcoming', val: FilterType.UPCOMING }, { label: 'Mastered', val: FilterType.MASTERED }].map((opt) => (
                            <button key={opt.val} onClick={() => setFilter(opt.val as FilterType)} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap flex-shrink-0 ${filter === opt.val ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-800' : 'bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border text-slate-500 dark:text-slate-400'}`}>{opt.label}</button>
                        ))}
                    </div>
                    <button 
                        onClick={() => { setEditingSession(null); setSessionPrefill(null); setIsModalOpen(true); }}
                        className="w-full sm:w-auto bg-primary hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 active:scale-95"
                    >
                    <PlusIcon className="w-4 h-4" /> Log Session
                    </button>
                </div>

                <div className="space-y-3">
                {filteredSessions.map(session => (
                    <SessionRow
                        key={session.id}
                        session={session}
                        knowledgeBase={knowledgeBase}
                        onDelete={handleDeleteSession}
                        onEdit={(s) => { setEditingSession(s); setSessionPrefill(null); setIsModalOpen(true); }}
                        onLogRevision={(s) => { setRevisingSession(s); setIsRevisionModalOpen(true); }}
                        onViewPage={(p) => handleViewPageDetail(p)}
                    />
                ))}
                </div>
            </>
        )}

        {viewMode === 'CALENDAR' && (
            <CalendarView sessions={sessions} studyPlan={studyPlan} onSelectDate={(date) => setDailyViewDate(date)} />
        )}

        {viewMode === 'PLANNER' && (
            <PlannerView 
                plan={studyPlan} 
                sessions={sessions}
                knowledgeBase={knowledgeBase} 
                onAddToPlan={handleAddToPlan}
                onUpdatePlanItem={handleUpdatePlanItem}
                onCompleteTask={handleCompletePlanItem}
                onStartTask={handleStartTask}
                onManageSession={handleManageSession}
                onToggleSubTask={handleTogglePlanSubTask}
                onDeleteLog={handleDeletePlanLog}
                onViewPage={(p) => handleViewPageDetail(p)}
            />
        )}

        {viewMode === 'REVISION' && (
            <RevisionView 
                sessions={sessions} 
                knowledgeBase={knowledgeBase}
                onEditSession={(s) => { setEditingSession(s); setIsModalOpen(true); }}
                onLogRevision={(s) => { setRevisingSession(s); setIsRevisionModalOpen(true); }}
                onDeleteSession={handleDeleteSession}
                onViewPage={(p) => handleViewPageDetail(p)}
            />
        )}

        {viewMode === 'DATABASE' && (
            <KnowledgeBaseView 
                data={knowledgeBase} 
                sessions={sessions}
                onUpdateEntry={(entry) => setKnowledgeBase(prev => prev.map(k => k.pageNumber === entry.pageNumber ? entry : k))} 
                onViewPage={(p) => handleViewPageDetail(p)}
            />
        )}

        {viewMode === 'TASKS' && <GlobalTaskList sessions={sessions} onToggleTask={(sid, tid) => {
             setSessions(prev => prev.map(s => s.id !== sid ? s : { ...s, toDoList: s.toDoList?.map(t => t.id === tid ? { ...t, done: !t.done } : t) }));
        }} />}
      </main>

      {/* Modals */}
      <SessionModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setTimeout(() => { setEditingSession(null); setSessionPrefill(null); setActivePlanItem(null); }, 300); }}
        onSave={(data) => handleSaveSession(data)}
        initialData={editingSession}
        prefillData={sessionPrefill}
        knowledgeBase={knowledgeBase}
        planContext={activePlanItem ? { planId: activePlanItem.id, subTasks: activePlanItem.subTasks || [] } : null}
      />

      <TimerModal 
          isOpen={isTimerOpen}
          onClose={() => setIsTimerOpen(false)}
          onFinish={handleTimerFinish}
          topic={activePlanItem?.topic || 'Study Session'}
      />

      <PageAnalysisModal 
          isOpen={isPageAnalysisOpen}
          onClose={() => setIsPageAnalysisOpen(false)}
          sessions={sessions}
          knowledgeBase={knowledgeBase}
          onViewPage={(p) => handleViewPageDetail(p)}
      />

      {/* The Ultimate Page Detail Modal */}
      <PageDetailModal
        isOpen={!!selectedPageDetail}
        onClose={() => setSelectedPageDetail(null)}
        pageNumber={selectedPageDetail}
        knowledgeBase={knowledgeBase}
        sessions={sessions}
      />

      {revisingSession && (
          <LogRevisionModal
            isOpen={isRevisionModalOpen}
            onClose={() => { setIsRevisionModalOpen(false); setRevisingSession(null); }}
            onConfirm={handleRevisionComplete}
            session={revisingSession}
          />
      )}

      <DailyViewModal
          isOpen={!!dailyViewDate}
          date={dailyViewDate}
          onClose={() => setDailyViewDate(null)}
          sessions={sessions}
          studyPlan={studyPlan}
          onEditSession={(s) => { setEditingSession(s); setIsModalOpen(true); }}
      />
    </div>
  );
};

export default App;