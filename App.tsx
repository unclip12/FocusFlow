
import React, { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, getUserProfile as getFirebaseUserProfile, saveUserProfile as saveFirebaseUserProfile, getKnowledgeBase, saveKnowledgeBase, getRevisionSettings, getDayPlan } from './services/firebase';
import { 
  StudySession, StudyPlanItem, KnowledgeBaseEntry, AppSettings, 
  getAdjustedDate, VideoResource, Attachment, ToDoItem,
  UserProfile,
  TrackableItem,
  RevisionLog,
  RevisionSettings,
  DayPlan
} from './types';
import { getData, saveData } from './services/dbService';
import { calculateNextRevisionDate } from './services/srsService';


// Components
import { LoginView } from './components/LoginView';
import { AppLogo, ChartBarIcon, CalendarPlusIcon, CalendarIcon, ArrowPathIcon, BookOpenIcon, DocumentTextIcon, ChatBubbleLeftRightIcon, Cog6ToothIcon, FireIcon, ChevronRightIcon, Bars3Icon, XMarkIcon, ListCheckIcon, BrainIcon, ClockIcon, ClipboardDocumentCheckIcon } from './components/Icons';
import { TodayGlance, StatsGrid } from './components/StatsCard';
import { ActivityGraphs } from './components/ActivityGraphs';
import SessionModal from './components/SessionModal';
import LogRevisionModal from './components/LogRevisionModal';
import { PageDetailModal } from './components/PageDetailModal';
import TimerModal from './components/TimerModal';
import { InstallPrompt } from './components/InstallPrompt';

// Views
import { CalendarView } from './components/CalendarView';
import PlannerView from './components/PlannerView';
import RevisionView from './components/RevisionView';
import KnowledgeBaseView from './components/KnowledgeBaseView';
import { DataView } from './components/DataView';
import { AIChatView } from './components/AIChatView';
import { SettingsView } from './components/SettingsView';
import { TodaysPlanView } from './components/TodaysPlanView';
import { AIMemoryView } from './components/AIMemoryView'; 
import { FALoggerView } from './components/FALoggerView';
import { TimeLoggerView } from './components/TimeLoggerView';
import { DailyTrackerView } from './components/DailyTrackerView';
import { toggleMaterialActive } from './services/firebase';

// Services
import { requestNotificationPermission } from './services/notificationService';

export default function App() {
  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string>('');

  // Data State
  const [studyPlan, setStudyPlan] = useState<StudyPlanItem[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseEntry[]>([]);
  const [todayPlan, setTodayPlan] = useState<DayPlan | null>(null); // Store today's plan for dashboard
  
  const [settings, setSettings] = useState<AppSettings>({ 
      darkMode: false, 
      primaryColor: 'indigo', 
      fontSize: 'medium',
      notifications: {
          enabled: true,
          mode: 'strict', // Default to strict C-mode
          types: {
              blockTimers: true,
              breaks: true,
              mentorNudges: true,
              dailySummary: true
          }
      },
      quietHours: {
          enabled: true,
          start: '23:00',
          end: '07:00'
      }
  });
  const [revisionSettings, setRevisionSettings] = useState<RevisionSettings>({ mode: 'balanced', targetCount: 7 });
  const [examDate, setExamDate] = useState<string | null>(null);

  // UI State
  const [currentView, setCurrentView] = useState<'DASHBOARD' | 'PLANNER' | 'CALENDAR' | 'REVISION' | 'KNOWLEDGE_BASE' | 'DATA' | 'CHAT' | 'SETTINGS' | 'TODAYS_PLAN' | 'AI_MEMORY' | 'FA_LOGGER' | 'TIME_LOGGER' | 'DAILY_TRACKER'>('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false); 
  const [targetPlanDate, setTargetPlanDate] = useState<string | undefined>(undefined);

  // Modals
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<StudySession | null>(null);
  const [sessionPrefill, setSessionPrefill] = useState<any>(null);
  const [planContext, setPlanContext] = useState<any>(null);
  
  const [isLogRevisionOpen, setIsLogRevisionOpen] = useState(false);
  const [revisionTarget, setRevisionTarget] = useState<StudySession | null>(null);
  
  const [viewingPage, setViewingPage] = useState<string | null>(null);
  const [isPageDetailOpen, setIsPageDetailOpen] = useState(false);

  // Timer
  const [activeTimerTopic, setActiveTimerTopic] = useState<string | null>(null);
  const [timerTargetMinutes, setTimerTargetMinutes] = useState<number | undefined>(undefined);

  // PWA Shared Content
  const [sharedContent, setSharedContent] = useState<string | null>(null);

  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const action = params.get('action');
      if (action === 'today') setCurrentView('TODAYS_PLAN');
      if (action === 'planner') setCurrentView('PLANNER');
      if (action === 'log') setIsSessionModalOpen(true);
  }, []);

  const loadTodayPlan = async () => {
      const today = getAdjustedDate(new Date());
      const plan = await getDayPlan(today);
      setTodayPlan(plan);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) {
        // Load from IndexedDB first for speed, then sync with Firestore
        const localPlan = await getData<StudyPlanItem[]>('studyPlan') || [];
        setStudyPlan(localPlan);
        
        const localKB = await getData<KnowledgeBaseEntry[]>('knowledgeBase_v2') || [];
        setKnowledgeBase(localKB);

        const firestoreKB = await getKnowledgeBase();
        setKnowledgeBase(firestoreKB);
        await saveData('knowledgeBase_v2', firestoreKB);

        // Load Today's Plan for Dashboard Stats
        await loadTodayPlan();

        const loadedSettings = await getData<AppSettings>('settings');
        const loadedRevSettings = await getRevisionSettings();
        if (loadedRevSettings) setRevisionSettings(loadedRevSettings);

        const loadedExamDate = await getData<string>('examDate');
        const loadedProfile = await getFirebaseUserProfile();

        if (loadedProfile?.displayName) {
            setDisplayName(loadedProfile.displayName);
        }
        
        if (loadedSettings) {
            setSettings(prev => ({ ...prev, ...loadedSettings, notifications: { ...prev.notifications, ...loadedSettings.notifications }, quietHours: { ...prev.quietHours, ...loadedSettings.quietHours } }));
        }
        if (loadedExamDate) setExamDate(loadedExamDate);
        
        if (loadedSettings?.notifications?.enabled) {
            requestNotificationPermission();
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Refresh Today Plan when viewing dashboard
  useEffect(() => {
      if (currentView === 'DASHBOARD') {
          loadTodayPlan();
      }
  }, [currentView]);

  const streak = useMemo(() => {
    const allStudyDates = new Set<string>();
    
    const gatherDates = (items: TrackableItem[]) => {
        items.forEach(item => {
            item.logs.forEach(log => {
                allStudyDates.add(getAdjustedDate(log.timestamp));
            });
            if (item.subTopics) {
                gatherDates(item.subTopics);
            }
        });
    };

    knowledgeBase.forEach(kbEntry => {
        kbEntry.logs.forEach(log => {
            allStudyDates.add(getAdjustedDate(log.timestamp));
        });
        gatherDates(kbEntry.topics);
    });

    if (allStudyDates.size === 0) {
        return 0;
    }

    let currentStreak = 0;
    let checkDate = new Date();
    const todayStr = getAdjustedDate(checkDate);
    
    // If no study today, start checking from yesterday to get current streak.
    if (!allStudyDates.has(todayStr)) {
        checkDate.setDate(checkDate.getDate() - 1);
    }

    // Loop backwards from either today or yesterday.
    while (allStudyDates.has(getAdjustedDate(checkDate))) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
    }

    return currentStreak;
  }, [knowledgeBase]);

  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  const handleUpdateDisplayName = async (newName: string) => {
      setDisplayName(newName);
      await saveFirebaseUserProfile({ displayName: newName });
  };

  const updatePlan = async (newPlan: StudyPlanItem[]) => {
      setStudyPlan(newPlan);
      await saveData('studyPlan', newPlan);
  };

  const updateKB = async (newKB: KnowledgeBaseEntry[]) => {
      setKnowledgeBase(newKB);
      await saveKnowledgeBase(newKB); // Save to Firestore
      await saveData('knowledgeBase_v2', newKB); // Also save to local IndexedDB
  };

  const handleAddToPlan = (item: Omit<StudyPlanItem, 'id'>, newVideo?: VideoResource, attachments?: Attachment[]) => {
      const newItem: StudyPlanItem = {
          ...item,
          id: Date.now().toString(36),
          createdAt: new Date().toISOString()
      };
      updatePlan([...studyPlan, newItem]);
      
      if ((newVideo || (attachments && attachments.length > 0))) {
          const existingKB = knowledgeBase.find(k => k.pageNumber === item.pageNumber);
          let updatedKB = [...knowledgeBase];
          if (existingKB) {
               updatedKB = updatedKB.map(k => k.pageNumber === item.pageNumber ? {
                   ...k,
                   videoLinks: newVideo ? [...k.videoLinks, newVideo] : k.videoLinks,
                   attachments: attachments ? [...(k.attachments || []), ...attachments] : k.attachments
               } : k);
          } else {
              updatedKB.push({
                  pageNumber: item.pageNumber,
                  title: item.topic,
                  subject: 'General', 
                  system: 'General Principles',
                  revisionCount: 0,
                  firstStudiedAt: null, 
                  lastStudiedAt: null, 
                  nextRevisionAt: null, 
                  currentRevisionIndex: 0,
                  ankiTotal: item.ankiCount || 0, ankiCovered: 0,
                  videoLinks: newVideo ? [newVideo] : [],
                  attachments: attachments || [],
                  tags: [],
                  notes: '',
                  logs: [],
                  topics: []
              });
          }
          updateKB(updatedKB);
      }
  };

  const todayFormatted = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  
  const handleViewPage = (page: string) => {
      setViewingPage(page);
      setIsPageDetailOpen(true);
  };

  const handleViewDayPlan = (date: string) => {
      setTargetPlanDate(date);
      setCurrentView('TODAYS_PLAN');
  };

  const dueNowItems = useMemo(() => {
    const items: { id: string, title: string, subtitle: string, type: 'REVISION' | 'TASK', urgent: boolean }[] = [];
    
    // This needs to be updated to scan new KB structure
    knowledgeBase.forEach(kb => {
        if (kb.nextRevisionAt && new Date(kb.nextRevisionAt) <= new Date()) {
            items.push({ id: kb.pageNumber, title: `Revise: ${kb.title}`, subtitle: `Page ${kb.pageNumber}`, type: 'REVISION', urgent: true });
        }
        kb.topics.forEach(t => {
            if (t.nextRevisionAt && new Date(t.nextRevisionAt) <= new Date()) {
                items.push({ id: t.id, title: `Revise: ${t.name}`, subtitle: `Topic on Page ${kb.pageNumber}`, type: 'REVISION', urgent: true });
            }
        });
    });

    return items;
  }, [knowledgeBase]);

  if (authLoading) return <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!user) return <LoginView />;

  const secretId = user?.email?.split('@')[0];

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans text-slate-800 dark:text-slate-200 transition-colors duration-300 relative overflow-hidden bg-slate-50 dark:bg-slate-900">
      <InstallPrompt />
      
      {/* Background Blobs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
         <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-400/20 blur-[120px] animate-pulse"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-teal-400/20 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
         <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] rounded-full bg-indigo-400/20 blur-[120px] animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>

      {/* SIDEBAR */}
      <aside className="hidden md:flex w-64 flex-col bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-r border-white/20 dark:border-slate-700/50 h-screen sticky top-0 overflow-y-auto z-20 shadow-lg">
          <div className="p-6 flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center shadow-md rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
                   <AppLogo className="w-full h-full" />
              </div>
              <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-teal-500">FocusFlow</h1>
          </div>
          <nav className="flex-1 px-4 space-y-2">
              {[
                  { id: 'DASHBOARD', label: 'Dashboard', icon: ChartBarIcon },
                  { id: 'TODAYS_PLAN', label: "Today's Plan", icon: CalendarIcon },
                  { id: 'CALENDAR', label: 'Calendar', icon: CalendarPlusIcon },
                  { id: 'TIME_LOGGER', label: 'Time Logger', icon: ClockIcon },
                  { id: 'DAILY_TRACKER', label: 'Daily Tracker', icon: ClipboardDocumentCheckIcon },
                  { id: 'FA_LOGGER', label: 'FA Logger', icon: ListCheckIcon },
                  { id: 'REVISION', label: 'Revision Hub', icon: ArrowPathIcon },
                  { id: 'KNOWLEDGE_BASE', label: 'Knowledge Base', icon: BookOpenIcon },
                  { id: 'DATA', label: 'Info Files', icon: DocumentTextIcon },
                  { id: 'CHAT', label: 'AI Mentor', icon: ChatBubbleLeftRightIcon },
                  { id: 'AI_MEMORY', label: 'My AI Memory', icon: BrainIcon },
                  { id: 'SETTINGS', label: 'Settings', icon: Cog6ToothIcon },
              ].map((item) => (
                  <button
                      key={item.id}
                      onClick={() => {
                          if (item.id === 'TODAYS_PLAN') {
                              setTargetPlanDate(undefined);
                          }
                          setCurrentView(item.id as any);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm ${currentView === item.id ? 'bg-indigo-100/60 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 shadow-sm border border-indigo-200/50 dark:border-indigo-800/50' : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                      <item.icon className="w-5 h-5" />
                      {item.label}
                  </button>
              ))}
          </nav>
      </aside>

      {/* MOBILE HEADER */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200/50 dark:border-slate-700/50 p-3 z-30 flex justify-between items-center shadow-sm">
           <div className="flex items-center gap-2">
               <div className="w-8 h-8">
                   <AppLogo className="w-full h-full" />
               </div>
               <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-teal-500">FocusFlow</span>
           </div>
           
           <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-orange-100/50 dark:bg-orange-900/20 px-2 py-1 rounded-full border border-orange-200/50 dark:border-orange-900/30" title="Current Streak">
                    <FireIcon className="w-4 h-4 text-orange-500" />
                    <span className="text-xs font-bold text-orange-600 dark:text-orange-400">{streak}</span>
                </div>
                
                <div className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-[10px] font-bold text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/50 whitespace-nowrap">
                    {todayFormatted}
                </div>

                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300">
                    <Bars3Icon className="w-6 h-6" />
                </button>
           </div>
      </div>

      {/* MOBILE MENU */}
      {isSidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setIsSidebarOpen(false)}>
              <aside className="w-64 h-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl shadow-2xl p-4 animate-slide-in-left border-r border-white/20" onClick={e => e.stopPropagation()}>
                   <div className="flex justify-between items-center mb-8">
                       <div className="flex items-center gap-2">
                           <div className="w-8 h-8">
                               <AppLogo className="w-full h-full" />
                           </div>
                           <span className="font-bold text-lg">FocusFlow</span>
                       </div>
                       <button onClick={() => setIsSidebarOpen(false)}><XMarkIcon className="w-6 h-6 text-slate-400" /></button>
                   </div>
                   <nav className="space-y-2">
                      {[
                          { id: 'DASHBOARD', label: 'Dashboard', icon: ChartBarIcon },
                          { id: 'TODAYS_PLAN', label: "Today's Plan", icon: CalendarIcon },
                          { id: 'CALENDAR', label: 'Calendar', icon: CalendarPlusIcon },
                          { id: 'TIME_LOGGER', label: 'Time Logger', icon: ClockIcon },
                          { id: 'DAILY_TRACKER', label: 'Daily Tracker', icon: ClipboardDocumentCheckIcon },
                          { id: 'FA_LOGGER', label: 'FA Logger', icon: ListCheckIcon },
                          { id: 'REVISION', label: 'Revision Hub', icon: ArrowPathIcon },
                          { id: 'KNOWLEDGE_BASE', label: 'Knowledge Base', icon: BookOpenIcon },
                          { id: 'DATA', label: 'Info Files', icon: DocumentTextIcon },
                          { id: 'CHAT', label: 'AI Mentor', icon: ChatBubbleLeftRightIcon },
                          { id: 'AI_MEMORY', label: 'My AI Memory', icon: BrainIcon },
                          { id: 'SETTINGS', label: 'Settings', icon: Cog6ToothIcon },
                      ].map((item) => (
                          <button
                              key={item.id}
                              onClick={() => { 
                                  if (item.id === 'TODAYS_PLAN') setTargetPlanDate(undefined);
                                  setCurrentView(item.id as any); 
                                  setIsSidebarOpen(false); 
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm ${currentView === item.id ? 'bg-indigo-50 dark:bg-indigo-900/20 text-primary' : 'text-slate-500 dark:text-slate-400'}`}
                          >
                              <item.icon className="w-5 h-5" />
                              {item.label}
                          </button>
                      ))}
                  </nav>
              </aside>
          </div>
      )}

      {/* MAIN AREA */}
      <main className="flex-1 pt-20 md:pt-0 p-4 md:p-8 overflow-y-auto h-screen custom-scrollbar relative z-10">
          <div className="max-w-6xl mx-auto h-full">
            
            {currentView === 'DASHBOARD' && (
                <>
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Hello, {displayName || 'Doctor'} 👋</h1>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Ready for today's session?</p>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => { setTargetPlanDate(undefined); setCurrentView('TODAYS_PLAN'); }}
                                className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 transition-all flex items-center gap-2"
                            >
                                <CalendarIcon className="w-4 h-4" />
                                Today's Plan
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                         <div className="space-y-6">
                            {/* Pass todayPlan to StatsCard for integration */}
                            <TodayGlance knowledgeBase={knowledgeBase} studyPlan={studyPlan} todayPlan={todayPlan} />
                            <ActivityGraphs knowledgeBase={knowledgeBase} />
                            <StatsGrid knowledgeBase={knowledgeBase} streak={streak} />
                         </div>
                         <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-lg rounded-2xl p-6 border border-white/50 dark:border-slate-700/50 shadow-sm">
                             <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                <ListCheckIcon className="w-5 h-5 text-indigo-500" />
                                Due Now
                             </h3>
                             <div className="space-y-3">
                                {dueNowItems.length > 0 ? dueNowItems.map(item => (
                                     <div key={item.id} className={`p-3 rounded-lg flex items-center justify-between transition-all ${item.urgent ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/50' : 'bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-700'}`}>
                                         <div>
                                             <p className="font-bold text-sm text-slate-700 dark:text-slate-200">{item.title}</p>
                                             <p className="text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</p>
                                         </div>
                                         <button className="text-primary hover:underline text-xs font-bold">View</button>
                                     </div>
                                )) : <p className="text-sm text-slate-400 italic text-center py-8">All caught up!</p>}
                             </div>
                         </div>
                    </div>
                </>
            )}

            {currentView === 'PLANNER' && (
                <PlannerView 
                    plan={studyPlan} 
                    knowledgeBase={knowledgeBase}
                    sessions={[]}
                    onAddToPlan={handleAddToPlan}
                    onUpdatePlanItem={(item) => updatePlan(studyPlan.map(p => p.id === item.id ? item : p))}
                    onCompleteTask={(item) => {
                        const updatedItem = { ...item, isCompleted: !item.isCompleted, completedAt: !item.isCompleted ? new Date().toISOString() : undefined };
                        updatePlan(studyPlan.map(p => p.id === item.id ? updatedItem : p));
                    }}
                    onStartTask={(item) => {
                        setSessionPrefill({
                            topic: item.topic,
                            pageNumber: item.pageNumber,
                            ankiTotal: item.ankiCount
                        });
                        setPlanContext({
                            planId: item.id,
                            subTasks: item.subTasks || []
                        });
                        setIsSessionModalOpen(true);
                    }}
                    onManageSession={(session) => {
                        if(session && session.pageNumber) handleViewPage(session.pageNumber);
                    }}
                    onToggleSubTask={(planId, subTaskId) => {
                        const planItem = studyPlan.find(p => p.id === planId);
                        if (planItem && planItem.subTasks) {
                            const updatedSubTasks = planItem.subTasks.map(t => t.id === subTaskId ? { ...t, done: !t.done } : t);
                            const updatedItem = { ...planItem, subTasks: updatedSubTasks };
                            updatePlan(studyPlan.map(p => p.id === planId ? updatedItem : p));
                        }
                    }}
                    onDeleteLog={(planId, logId) => {
                        const planItem = studyPlan.find(p => p.id === planId);
                        if (planItem && planItem.logs) {
                            const updatedLogs = planItem.logs.filter(l => l.id !== logId);
                            const updatedItem = { ...planItem, logs: updatedLogs };
                            updatePlan(studyPlan.map(p => p.id === planId ? updatedItem : p));
                        }
                    }}
                    onViewPage={handleViewPage}
                    sharedContent={sharedContent}
                />
            )}

            {currentView === 'TODAYS_PLAN' && (
                <TodaysPlanView 
                    targetDate={targetPlanDate} 
                    settings={settings} 
                    knowledgeBase={knowledgeBase}
                    onUpdateKnowledgeBase={updateKB} // Pass update function for synchronization
                />
            )}

            {currentView === 'CALENDAR' && (
                <CalendarView 
                    knowledgeBase={knowledgeBase} 
                    studyPlan={studyPlan} 
                    onAddToPlan={handleAddToPlan} 
                />
            )}

            {currentView === 'TIME_LOGGER' && (
                <TimeLoggerView 
                    knowledgeBase={knowledgeBase}
                    onViewPage={handleViewPage}
                />
            )}

            {currentView === 'DAILY_TRACKER' && (
                <DailyTrackerView />
            )}

            {currentView === 'FA_LOGGER' && (
                <FALoggerView 
                    knowledgeBase={knowledgeBase}
                    onUpdateKnowledgeBase={updateKB}
                    onViewPage={handleViewPage}
                />
            )}

            {currentView === 'REVISION' && (
                <RevisionView 
                    knowledgeBase={knowledgeBase}
                    onLogRevision={(item) => {
                        setSessionPrefill({
                            topic: item.title,
                            pageNumber: item.pageNumber,
                            category: item.kbEntry.subject,
                            system: item.kbEntry.system,
                            ankiTotal: item.kbEntry.ankiTotal,
                            ankiCovered: item.kbEntry.ankiCovered
                        });
                        setIsSessionModalOpen(true);
                    }}
                    onDeleteSession={() => {}}
                    onViewPage={handleViewPage}
                />
            )}

            {currentView === 'KNOWLEDGE_BASE' && (
                <KnowledgeBaseView 
                    data={knowledgeBase}
                    onUpdateEntry={(entry) => {
                        updateKB(knowledgeBase.map(k => k.pageNumber === entry.pageNumber ? entry : k));
                    }}
                    onViewPage={handleViewPage}
                />
            )}

            {currentView === 'DATA' && <DataView />}

            {currentView === 'CHAT' && (
                <AIChatView 
                    sessions={[]} // deprecated
                    studyPlan={studyPlan}
                    streak={streak}
                    onAddToPlan={handleAddToPlan}
                    onViewDayPlan={handleViewDayPlan}
                    displayName={displayName}
                    knowledgeBase={knowledgeBase}
                    onUpdateKnowledgeBase={updateKB}
                />
            )}

            {currentView === 'AI_MEMORY' && (
                <AIMemoryView displayName={displayName} onUpdateDisplayName={handleUpdateDisplayName} />
            )}

            {currentView === 'SETTINGS' && (
                <SettingsView 
                    settings={settings} 
                    onUpdateSettings={async (newSettings) => {
                        setSettings(newSettings);
                        await saveData('settings', newSettings);
                    }} 
                    secretId={secretId}
                    displayName={displayName}
                    onUpdateDisplayName={handleUpdateDisplayName}
                />
            )}

          </div>
      </main>

      {/* Modals */}
      {isSessionModalOpen && (
          <SessionModal
              isOpen={isSessionModalOpen}
              onClose={() => { setIsSessionModalOpen(false); setEditingSession(null); setSessionPrefill(null); setPlanContext(null); }}
              initialData={editingSession}
              prefillData={sessionPrefill}
              planContext={planContext}
              knowledgeBase={knowledgeBase}
              onSave={(sessionData) => {
                  const { pageNumber, topic, history, notes, ankiCovered, ankiTotal, planUpdates } = sessionData;
                  const latestLog = history && history.length > 0 ? history[0] : null;
                  
                  if (latestLog) {
                      // Update KB
                      let kbEntry = knowledgeBase.find(k => k.pageNumber === pageNumber);
                      if (!kbEntry) {
                          // Create new
                          kbEntry = {
                              pageNumber,
                              title: topic || `Page ${pageNumber}`,
                              subject: sessionData.category || 'Uncategorized',
                              system: sessionData.system || 'General',
                              revisionCount: 0,
                              firstStudiedAt: null,
                              lastStudiedAt: null,
                              nextRevisionAt: null,
                              currentRevisionIndex: 0,
                              ankiTotal: ankiTotal || 0,
                              ankiCovered: ankiCovered || 0,
                              videoLinks: [],
                              tags: [],
                              notes: notes || '',
                              logs: [],
                              topics: []
                          };
                      } else {
                          // Update existing
                          kbEntry = { ...kbEntry, notes: notes || kbEntry.notes, ankiCovered: ankiCovered || kbEntry.ankiCovered, ankiTotal: ankiTotal || kbEntry.ankiTotal };
                      }

                      // Append Log
                      const newLog: RevisionLog = {
                          id: latestLog.id,
                          timestamp: latestLog.startTime,
                          durationMinutes: latestLog.durationMinutes,
                          revisionIndex: latestLog.type === 'INITIAL' ? 0 : kbEntry.revisionCount + 1,
                          type: latestLog.type === 'INITIAL' ? 'STUDY' : 'REVISION',
                          notes: latestLog.notes,
                          source: 'MODAL',
                          // Map subtasks to topics if needed, or just use topic
                          topics: [topic].filter(Boolean),
                          attachments: latestLog.attachments
                      };
                      
                      // Recalculate SRS
                      const isRevision = newLog.type === 'REVISION';
                      const newRevCount = isRevision ? kbEntry.revisionCount + 1 : kbEntry.revisionCount;
                      const newRevIndex = isRevision ? kbEntry.currentRevisionIndex + 1 : 0;
                      
                      const nextDate = calculateNextRevisionDate(new Date(latestLog.startTime), newRevIndex, revisionSettings);
                      
                      const updatedKBEntry = {
                          ...kbEntry,
                          logs: [...kbEntry.logs, newLog],
                          revisionCount: newRevCount,
                          currentRevisionIndex: newRevIndex,
                          lastStudiedAt: latestLog.startTime,
                          firstStudiedAt: kbEntry.firstStudiedAt || latestLog.startTime,
                          nextRevisionAt: nextDate ? nextDate.toISOString() : null
                      };
                      
                      const newKB = knowledgeBase.filter(k => k.pageNumber !== pageNumber).concat(updatedKBEntry);
                      updateKB(newKB);
                  }

                  // Update Plan if contextual
                  if (planContext && planUpdates && planUpdates.completedSubTaskIds) {
                      const planItem = studyPlan.find(p => p.id === planContext.planId);
                      if (planItem) {
                          let updatedSubTasks = planItem.subTasks || [];
                          updatedSubTasks = updatedSubTasks.map(t => planUpdates.completedSubTaskIds.includes(t.id) ? { ...t, done: true } : t);
                          
                          let updatedItem = { ...planItem, subTasks: updatedSubTasks };
                          if (planUpdates.isFinished) {
                              updatedItem.isCompleted = true;
                              updatedItem.completedAt = new Date().toISOString();
                          }
                          
                          // Also append log to planItem logs for visibility
                          if (latestLog) {
                              const planLog = {
                                  id: latestLog.id,
                                  date: latestLog.date,
                                  durationMinutes: latestLog.durationMinutes,
                                  startTime: latestLog.startTime,
                                  endTime: latestLog.endTime,
                                  notes: latestLog.notes
                              };
                              updatedItem.logs = [...(updatedItem.logs || []), planLog];
                              updatedItem.totalMinutesSpent = (updatedItem.totalMinutesSpent || 0) + latestLog.durationMinutes;
                          }

                          updatePlan(studyPlan.map(p => p.id === planItem.id ? updatedItem : p));
                      }
                  }
                  
                  setIsSessionModalOpen(false);
                  setEditingSession(null);
                  setSessionPrefill(null);
                  setPlanContext(null);
              }}
          />
      )}

      <PageDetailModal 
          isOpen={isPageDetailOpen}
          onClose={() => setIsPageDetailOpen(false)}
          pageNumber={viewingPage}
          knowledgeBase={knowledgeBase}
          sessions={[]} // deprecated
          onUpdateEntry={(entry) => {
              updateKB(knowledgeBase.map(k => k.pageNumber === entry.pageNumber ? entry : k));
          }}
      />

    </div>
  );
}
