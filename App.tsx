import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';
import { auth, getUserProfile as getFirebaseUserProfile, saveUserProfile as saveFirebaseUserProfile, getKnowledgeBase, saveKnowledgeBase, deleteKnowledgeBaseEntry, getRevisionSettings, saveRevisionSettings, getDayPlan, getAppSettings, saveAppSettings, getFMGEData, saveFMGEEntry, deleteFMGEEntry, getAISettings, saveAISettings } from './services/firebase';
import { subscribeToSync } from './services/syncService';
import { haptic } from './services/hapticsService';
import { 
  StudySession, StudyPlanItem, KnowledgeBaseEntry, AppSettings, 
  getAdjustedDate, VideoResource, Attachment, ToDoItem,
  UserProfile,
  TrackableItem,
  RevisionLog,
  RevisionSettings,
  DayPlan,
  APP_THEMES,
  AppTheme,
  DEFAULT_MENU_ORDER,
  MenuItemConfig,
  RevisionItem,
  FMGEEntry,
  THEME_COLORS,
  ViewStates, 
  FALogData,
  StudyEntry
} from './types';
import { getData, saveData } from './services/dbService';
import { calculateNextRevisionDate } from './services/srsService';
import { checkAndMigrateOverdueTasks } from './services/planService';
import { performFullIntegrityCheck, recalculateEntryStats } from './services/faLoggerService';
import { createSnapshot, checkAndTriggerDailyBackup } from './services/historyService';


// Components
import { LoginView } from './components/LoginView';
import { AppLogo, ChartBarIcon, CalendarPlusIcon, CalendarIcon, ArrowPathIcon, BookOpenIcon, DocumentTextIcon, ChatBubbleLeftRightIcon, Cog6ToothIcon, FireIcon, ChevronRightIcon, Bars3Icon, XMarkIcon, ListCheckIcon, BrainIcon, ClockIcon, ClipboardDocumentCheckIcon, CheckCircleIcon, ArrowsPointingOutIcon, LayoutSidebarIcon, BoltIcon, TableCellsIcon } from './components/Icons';
import { TodayGlance } from './components/StatsCard';
import { ActivityGraphs } from './components/ActivityGraphs';
import SessionModal from './components/SessionModal';
import LogRevisionModal from './components/LogRevisionModal';
import { PageDetailModal } from './components/PageDetailModal';
import TimerModal from './components/TimerModal';
import { InstallPrompt } from './components/InstallPrompt';
import { NetworkIndicator } from './components/NetworkIndicator';
import { toggleMaterialActive } from './services/firebase';
import { DetailedLoadingScreen, useDetailedLoading } from './components/DetailedLoadingScreen';

// Lazy load views for better performance
const CalendarView = lazy(() => import('./components/CalendarView').then(m => ({ default: m.CalendarView })));
const PlannerView = lazy(() => import('./components/PlannerView').then(m => ({ default: m.PlannerView })));
const RevisionView = lazy(() => import('./components/RevisionView').then(m => ({ default: m.RevisionView })));
const KnowledgeBaseView = lazy(() => import('./components/KnowledgeBaseView'));
const DataView = lazy(() => import('./components/DataView').then(m => ({ default: m.DataView })));
const AIChatView = lazy(() => import('./components/AIChatView').then(m => ({ default: m.AIChatView })));
const SettingsView = lazy(() => import('./components/SettingsView').then(m => ({ default: m.SettingsView })));
const TodaysPlanView = lazy(() => import('./components/TodaysPlanView').then(m => ({ default: m.TodaysPlanView })));
const AIMemoryView = lazy(() => import('./components/AIMemoryView').then(m => ({ default: m.AIMemoryView })));
const FALoggerView = lazy(() => import('./components/FALoggerView').then(m => ({ default: m.FALoggerView })));
const TimeLoggerView = lazy(() => import('./components/TimeLoggerView').then(m => ({ default: m.TimeLoggerView })));
const DailyTrackerView = lazy(() => import('./components/DailyTrackerView').then(m => ({ default: m.DailyTrackerView })));
const FMGEView = lazy(() => import('./components/FMGEView').then(m => ({ default: m.FMGEView })));
const FocusTimerView = lazy(() => import('./components/FocusTimerView').then(m => ({ default: m.FocusTimerView })));
const StudyTrackerView = lazy(() => import('./components/StudyTrackerView').then(m => ({ default: m.StudyTrackerView })));

// Services
import { requestNotificationPermission } from './services/notificationService';

// Loading fallback component
const ViewLoadingFallback = () => (
  <div className="flex items-center justify-center h-full">
    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

// MENU DEFINITIONS
const ALL_MENU_ITEMS = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: ChartBarIcon },
    { id: 'STUDY_TRACKER', label: 'Study Tracker', icon: TableCellsIcon },
    { id: 'TODAYS_PLAN', label: "Today's Plan", icon: CalendarIcon },
    { id: 'FOCUS_TIMER', label: 'Focus Timer', icon: BoltIcon }, 
    { id: 'FMGE', label: "FMGE Prep", icon: BookOpenIcon },
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
];

const SyncIndicator = React.memo(() => {
    const [status, setStatus] = useState<'HIDDEN' | 'SYNCING' | 'SYNCED'>('HIDDEN');
    const timerRef = useRef<any>(null);

    useEffect(() => {
        return subscribeToSync((isActive) => {
            if (isActive) {
                if (timerRef.current) clearTimeout(timerRef.current);
                setStatus('SYNCING');
            } else {
                setStatus('SYNCED');
                timerRef.current = setTimeout(() => setStatus('HIDDEN'), 2500);
            }
        });
    }, []);

    if (status === 'HIDDEN') return null;

    return (
        <div className="flex items-center gap-1 ml-2 animate-fade-in">
            {status === 'SYNCING' ? (
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 animate-pulse flex items-center gap-1 whitespace-nowrap bg-white/50 dark:bg-slate-800/50 px-2 py-1 rounded-full shadow-inner backdrop-blur-sm">
                    <ArrowPathIcon className="w-3 h-3 animate-spin" /> Syncing...
                </span>
            ) : (
                <span className="text-[10px] font-bold text-green-600 flex items-center gap-1 whitespace-nowrap bg-green-50/50 dark:bg-green-900/20 px-2 py-1 rounded-full shadow-sm backdrop-blur-sm">
                    <CheckCircleIcon className="w-3 h-3" /> Synced
                </span>
            )}
        </div>
    );
});

export default function App() {
  // Detailed Loading
  const { currentStatus, logs, updateStatus } = useDetailedLoading();

  // Auth
  const [user, setUser] = useState<firebase.User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string>('');

  // Data State
  const [studyPlan, setStudyPlan] = useState<StudyPlanItem[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseEntry[]>([]);
  const [fmgeData, setFmgeData] = useState<FMGEEntry[]>([]); 
  const [todayPlan, setTodayPlan] = useState<DayPlan | null>(null); 
  
  const [settings, setSettings] = useState<AppSettings>({ 
      darkMode: false, 
      themeId: 'default',
      primaryColor: 'indigo', 
      fontSize: 'medium',
      notifications: {
          enabled: true,
          mode: 'strict', 
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
      },
      desktopLayout: 'sidebar', 
      menuConfiguration: DEFAULT_MENU_ORDER.map(id => ({ id, visible: true }))
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const [revisionSettings, setRevisionSettings] = useState<RevisionSettings>({ mode: 'balanced', targetCount: 7 });
  const [examDate, setExamDate] = useState<string | null>(null);

  // UI State
  const [currentView, setCurrentView] = useState<'DASHBOARD' | 'PLANNER' | 'CALENDAR' | 'REVISION' | 'KNOWLEDGE_BASE' | 'DATA' | 'CHAT' | 'SETTINGS' | 'TODAYS_PLAN' | 'AI_MEMORY' | 'FA_LOGGER' | 'TIME_LOGGER' | 'DAILY_TRACKER' | 'FMGE' | 'FOCUS_TIMER' | 'STUDY_TRACKER'>('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false); 
  const [targetPlanDate, setTargetPlanDate] = useState<string | undefined>(undefined);

  // --- CENTRALIZED VIEW STATES FOR PERSISTENCE ---
  const [viewStates, setViewStates] = useState<ViewStates>({
      kb: {
          search: '',
          selectedSystem: '',
          sortBy: 'PAGE',
          sortOrder: 'ASC',
          viewMode: 'PAGE_WISE'
      },
      fa: {
          isLogModalOpen: false,
          modalMode: 'STUDY',
          draftLog: null,
          logToEdit: null
      },
      plan: {
          currentDate: getAdjustedDate(new Date()),
          viewMode: 'blocks',
          isManualModalOpen: false
      },
      timeLog: {
          selectedDate: getAdjustedDate(new Date()),
          input: ''
      },
      revision: {
          activeTab: 'DUE',
          sortBy: 'TIME',
          sortOrder: 'ASC'
      },
      calendar: {
          currentMonth: new Date(),
          selectedDate: new Date(),
          viewMode: 'MONTH'
      },
      chat: {
          mode: 'MENTOR',
          input: ''
      },
      data: {
          filterSource: 'ALL'
      },
      studyTracker: {
          selectedDate: getAdjustedDate(new Date()),
          search: ''
      }
  });

  // Modals
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [sessionLogType, setSessionLogType] = useState<'INITIAL' | 'REVISION'>('INITIAL'); 
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

  // --- SPLASH SCREEN HANDLER ---
  useEffect(() => {
      if (!authLoading && Capacitor.isNativePlatform()) {
          SplashScreen.hide();
      }
  }, [authLoading]);

  // --- NATIVE BACK BUTTON HANDLING ---
  const stateRef = useRef({
      isSessionModalOpen,
      isPageDetailOpen,
      isSidebarOpen,
      currentView
  });

  useEffect(() => {
      stateRef.current = {
          isSessionModalOpen,
          isPageDetailOpen,
          isSidebarOpen,
          currentView
      };
  }, [isSessionModalOpen, isPageDetailOpen, isSidebarOpen, currentView]);

  useEffect(() => {
      if (Capacitor.isNativePlatform()) {
          const handleBackButton = async () => {
              const { isSessionModalOpen, isPageDetailOpen, isSidebarOpen, currentView } = stateRef.current;
              if (isSessionModalOpen) {
                  setIsSessionModalOpen(false);
                  return;
              }
              if (isPageDetailOpen) {
                  setIsPageDetailOpen(false);
                  return;
              }
              if (isSidebarOpen) {
                  setIsSidebarOpen(false);
                  return;
              }
              if (currentView !== 'DASHBOARD') {
                  setCurrentView('DASHBOARD');
                  return;
              }
              CapacitorApp.exitApp();
          };
          CapacitorApp.addListener('backButton', handleBackButton);
          return () => {
              CapacitorApp.removeAllListeners();
          };
      }
  }, []);

  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const action = params.get('action');
      if (action === 'today') setCurrentView('TODAYS_PLAN');
      if (action === 'planner') setCurrentView('PLANNER');
      if (action === 'log') setIsSessionModalOpen(true);
  }, []);

  const loadTodayPlan = useCallback(async () => {
      try {
          const today = getAdjustedDate(new Date());
          const plan = await getDayPlan(today);
          setTodayPlan(plan);
      } catch (e) {
          console.warn("Failed to load today's plan", e);
      }
  }, []);

  useEffect(() => {
      if (user) {
          checkAndTriggerDailyBackup();
          const interval = setInterval(() => {
              checkAndTriggerDailyBackup();
          }, 60 * 1000);
          return () => clearInterval(interval);
      }
  }, [user]);

  useEffect(() => {
    updateStatus('INIT', 'Initializing Firebase authentication', 5);
    
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      
      if (u) {
        updateStatus('AUTH', `Authenticated as ${u.email}`, 10);
        
        try {
            updateStatus('CONFIG', 'Loading revision & AI settings', 15);
            const [cloudRevConfig, cloudAiConfig] = await Promise.all([
                getRevisionSettings(),
                getAISettings()
            ]);

            let currentRevSettings: RevisionSettings;
            if (cloudRevConfig) {
                currentRevSettings = cloudRevConfig;
                updateStatus('CONFIG', 'Revision settings loaded from cloud', 20);
            } else {
                currentRevSettings = { mode: 'balanced', targetCount: 7 };
                await saveRevisionSettings(currentRevSettings);
                updateStatus('CONFIG', 'Created default revision settings', 20);
            }
            setRevisionSettings(currentRevSettings);

            if (!cloudAiConfig) {
                await saveAISettings({ personalityMode: 'balanced', talkStyle: 'motivational', disciplineLevel: 3 });
                updateStatus('CONFIG', 'Created default AI settings', 25);
            } else {
                updateStatus('CONFIG', 'AI settings loaded', 25);
            }

            updateStatus('DATA_LOCAL', 'Loading local study plan', 30);
            const localPlan = await getData<StudyPlanItem[]>('studyPlan') || [];
            setStudyPlan(localPlan);
            updateStatus('DATA_LOCAL', `Loaded ${localPlan.length} plan items`, 35);
            
            updateStatus('DATA_LOCAL', 'Loading local knowledge base', 40);
            const localKB = await getData<KnowledgeBaseEntry[]>('knowledgeBase_v2') || [];
            setKnowledgeBase(localKB);
            updateStatus('DATA_LOCAL', `Loaded ${localKB.length} KB entries locally`, 45);

            updateStatus('DATA_CLOUD', 'Syncing knowledge base from Firebase', 50);
            const firestoreKB = await getKnowledgeBase();
            if (firestoreKB) {
                updateStatus('DATA_CLOUD', 'Performing integrity check on KB data', 55);
                const { updated, data: checkedKB } = performFullIntegrityCheck(firestoreKB, currentRevSettings);
                setKnowledgeBase(checkedKB);
                await saveData('knowledgeBase_v2', checkedKB);
                if (updated) {
                    updateStatus('DATA_CLOUD', 'Fixed data inconsistencies, syncing back', 60);
                    await saveKnowledgeBase(checkedKB);
                } else {
                    updateStatus('DATA_CLOUD', `Synced ${checkedKB.length} KB entries`, 60);
                }
            } else {
                updateStatus('DATA_CLOUD', 'No cloud KB data found', 60);
            }

            updateStatus('DATA_CLOUD', 'Loading FMGE prep data', 65);
            const fmge = await getFMGEData();
            if (fmge) {
                setFmgeData(fmge);
                updateStatus('DATA_CLOUD', `Loaded ${fmge.length} FMGE entries`, 70);
            } else {
                updateStatus('DATA_CLOUD', 'No FMGE data found', 70);
            }

            updateStatus('MIGRATION', 'Checking for overdue task migrations', 72);
            try {
                await checkAndMigrateOverdueTasks();
                updateStatus('MIGRATION', 'Task migration complete', 75);
            } catch (e) {
                updateStatus('MIGRATION', 'Task migration skipped (non-critical)', 75);
                console.warn("Task migration failed", e);
            }

            updateStatus('PLAN', "Loading today's plan", 78);
            await loadTodayPlan();
            updateStatus('PLAN', "Today's plan loaded", 80);

            updateStatus('SETTINGS', 'Loading app settings', 82);
            try {
                const localSettings = await getData<AppSettings>('settings');
                if (localSettings) {
                    setSettings(prev => ({
                        ...prev,
                        ...localSettings,
                        notifications: { ...prev.notifications, ...(localSettings.notifications || {}) },
                        quietHours: { ...prev.quietHours, ...(localSettings.quietHours || {}) }
                    }));
                    updateStatus('SETTINGS', 'Loaded local settings', 85);
                }
                
                updateStatus('SETTINGS', 'Syncing settings with cloud', 88);
                const cloudSettings = await getAppSettings();
                if (!cloudSettings) {
                    await saveAppSettings(settings);
                    updateStatus('SETTINGS', 'Pushed local settings to cloud', 90);
                }
                
                const sourceSettings = cloudSettings || localSettings;
                if (sourceSettings) {
                    setSettings(prev => {
                        const merged = { 
                            ...prev, 
                            ...sourceSettings, 
                            notifications: { ...prev.notifications, ...(sourceSettings.notifications || {}) }, 
                            quietHours: { ...prev.quietHours, ...(sourceSettings.quietHours || {}) } 
                        };
                        if (sourceSettings.menuConfiguration) {
                            const existingIds = new Set(sourceSettings.menuConfiguration.map((m: MenuItemConfig) => m.id));
                            const newItems = DEFAULT_MENU_ORDER
                                .filter(id => !existingIds.has(id))
                                .map(id => ({ id, visible: true }));
                            merged.menuConfiguration = [...sourceSettings.menuConfiguration, ...newItems];
                        } else {
                            merged.menuConfiguration = DEFAULT_MENU_ORDER.map(id => ({ id, visible: true }));
                        }
                        return merged;
                    });
                    if (cloudSettings) await saveData('settings', cloudSettings);
                    updateStatus('SETTINGS', 'Settings synced successfully', 92);
                }
            } catch (err) {
                updateStatus('SETTINGS', 'Settings sync failed, using defaults', 92, true);
                console.error("Failed to sync settings", err);
            } finally {
                setSettingsLoaded(true);
            }

            updateStatus('PROFILE', 'Loading user profile', 94);
            const loadedProfile = await getFirebaseUserProfile();
            if (loadedProfile?.displayName) {
                setDisplayName(loadedProfile.displayName);
                updateStatus('PROFILE', `Welcome back, ${loadedProfile.displayName}`, 96);
            } else {
                updateStatus('PROFILE', 'Profile loaded', 96);
            }
            
            updateStatus('COMPLETE', 'App ready! Launching dashboard', 100);
        } catch (globalError) {
            updateStatus('ERROR', `Critical error: ${globalError}`, 100, true);
            console.error("Critical error during initial load sequence:", globalError);
        } finally {
            setTimeout(() => setAuthLoading(false), 500); // Small delay for smooth transition
        }
      } else {
          updateStatus('AUTH', 'No user logged in, showing login screen', 100);
          setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, [loadTodayPlan, updateStatus]);

  useEffect(() => {
      if (settingsLoaded && settings.notifications?.enabled) {
          requestNotificationPermission();
      }
  }, [settingsLoaded, settings.notifications?.enabled]);

  useEffect(() => {
      if (currentView === 'DASHBOARD') {
          loadTodayPlan();
      }
  }, [currentView, loadTodayPlan]);

  useEffect(() => {
      if (targetPlanDate) {
          setViewStates(prev => ({
              ...prev,
              plan: { ...prev.plan, currentDate: targetPlanDate }
          }));
      }
  }, [targetPlanDate]);

  const activeMenuItems = useMemo(() => {
      const config = settings.menuConfiguration || DEFAULT_MENU_ORDER.map(id => ({ id, visible: true }));
      return config
          .filter(item => item.visible)
          .map(item => ALL_MENU_ITEMS.find(def => def.id === item.id))
          .filter(Boolean) as typeof ALL_MENU_ITEMS;
  }, [settings.menuConfiguration]);

  const streak = useMemo(() => {
    if (studyPlan.length === 0) return 0;
    const todayStr = getAdjustedDate(new Date());
    let currentStreak = 0;
    const itemsByDate = new Map<string, StudyPlanItem[]>();
    studyPlan.forEach(item => {
        const items = itemsByDate.get(item.date) || [];
        items.push(item);
        itemsByDate.set(item.date, items);
    });
    let checkDate = new Date();
    let checkDateStr = getAdjustedDate(checkDate);
    if (!itemsByDate.has(checkDateStr)) {
        checkDate.setDate(checkDate.getDate() - 1);
        checkDateStr = getAdjustedDate(checkDate);
    }
    while (true) {
        const items = itemsByDate.get(checkDateStr);
        if (!items || items.length === 0) {
            if (currentStreak > 0) break;
        } else {
            if (items.every(i => i.isCompleted)) currentStreak++;
            else break;
        }
        checkDate.setDate(checkDate.getDate() - 1);
        checkDateStr = getAdjustedDate(checkDate);
        if (currentStreak > 3650) break; 
    }
    return currentStreak;
  }, [studyPlan]);

  useEffect(() => {
    const applyTheme = async () => {
        const activeThemeId = settings.themeId || 'default';
        const theme = APP_THEMES.find(t => t.id === activeThemeId) || APP_THEMES[0];
        const root = document.documentElement;
        const isDark = settings.darkMode;
        root.style.setProperty('--app-bg', isDark ? theme.darkBgGradient : theme.bgGradient);
        root.style.setProperty('--color-background', isDark ? theme.darkBackgroundRGB : theme.backgroundRGB);
        root.style.setProperty('--color-surface', isDark ? theme.darkSurfaceRGB : theme.surfaceRGB);
        const activeColorValue = settings.primaryColor || 'indigo';
        const colorDef = THEME_COLORS.find(c => c.value === activeColorValue) || THEME_COLORS[0];
        root.style.setProperty('--color-primary', colorDef.rgb);
        if (isDark) root.classList.add('dark');
        else root.classList.remove('dark');
        if (Capacitor.isNativePlatform()) {
            try {
                await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
                if (isDark) await StatusBar.setBackgroundColor({ color: '#0f172a' });
                else await StatusBar.setBackgroundColor({ color: '#ffffff' });
            } catch (e) {}
        }
    };
    applyTheme();
  }, [settings.themeId, settings.darkMode, settings.primaryColor]);

  const handleUpdateDisplayName = useCallback(async (newName: string) => {
      setDisplayName(newName);
      await saveFirebaseUserProfile({ displayName: newName });
  }, []);

  const handleUpdateSettings = useCallback(async (newSettings: AppSettings) => {
      if (!settingsLoaded) return;
      setSettings(newSettings);
      await saveData('settings', newSettings);
      await saveAppSettings(newSettings);
  }, [settingsLoaded]);

  const updatePlan = useCallback(async (newPlan: StudyPlanItem[]) => {
      setStudyPlan(newPlan);
      await saveData('studyPlan', newPlan);
  }, []);

  const updateKB = useCallback(async (newKB: KnowledgeBaseEntry[]) => {
      setKnowledgeBase(newKB);
      await saveKnowledgeBase(newKB);
      await saveData('knowledgeBase_v2', newKB);
  }, []);

  const handleUpdateFMGE = useCallback(async (entry: FMGEEntry) => {
      setFmgeData(prev => prev.filter(e => e.id !== entry.id).concat(entry));
      await saveFMGEEntry(entry);
  }, []);

  const handleDeleteFMGE = useCallback(async (id: string) => {
      setFmgeData(prev => prev.filter(e => e.id !== id));
      await deleteFMGEEntry(id);
  }, []);

  const handleDeleteKBEntry = useCallback(async (pageNumber: string) => {
      const newKB = knowledgeBase.filter(k => k.pageNumber !== pageNumber);
      setKnowledgeBase(newKB);
      await deleteKnowledgeBaseEntry(pageNumber);
      await saveData('knowledgeBase_v2', newKB);
  }, [knowledgeBase]);

  const handleDeleteRevision = useCallback((item: RevisionItem) => {
    const entry = knowledgeBase.find(k => k.pageNumber === item.pageNumber);
    if (!entry) return;
    let updatedEntry = { ...entry };
    let logs = [...updatedEntry.logs];
    const isUpcoming = new Date(item.nextRevisionAt) > new Date();
    if (isUpcoming) {
        logs.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        if (item.groupedTopics && item.groupedTopics.length > 0) {
             const topicNames = new Set(item.groupedTopics.map(t => t.name.trim().toLowerCase()));
             for (let i = logs.length - 1; i >= 0; i--) {
                 if (logs[i].topics && logs[i].topics!.some(t => topicNames.has(t.trim().toLowerCase()))) {
                     logs.splice(i, 1);
                     break; 
                 }
             }
        } else if (item.type === 'TOPIC' && item.topic) {
             for (let i = logs.length - 1; i >= 0; i--) {
                 if (logs[i].topics && logs[i].topics!.some(t => t.trim().toLowerCase() === item.topic!.name.trim().toLowerCase())) {
                     logs.splice(i, 1);
                     break; 
                 }
             }
        } else if (item.type === 'PAGE') {
             for (let i = logs.length - 1; i >= 0; i--) {
                 if (!logs[i].topics || logs[i].topics!.length === 0) {
                     logs.splice(i, 1);
                     break;
                 }
             }
        } else if (logs.length > 0) logs.pop();
        updatedEntry.logs = logs;
        updatedEntry = recalculateEntryStats(updatedEntry, revisionSettings);
    } else {
        if (item.type === 'PAGE') updatedEntry.nextRevisionAt = null;
        else if (item.type === 'TOPIC' && item.topic) {
            updatedEntry.topics = updatedEntry.topics.map(t => t.id === item.topic!.id ? { ...t, nextRevisionAt: null } : t);
        } else if (item.type === 'SUBTOPIC' && item.topic && item.subTopic) {
             updatedEntry.topics = updatedEntry.topics.map(t => {
                if (t.id === item.topic!.id) {
                    const updatedSubTopics = t.subTopics?.map(st => st.id === item.subTopic!.id ? { ...st, nextRevisionAt: null } : st);
                    return { ...t, subTopics: updatedSubTopics };
                }
                return t;
            });
        }
    }
    updateKB(knowledgeBase.map(k => k.pageNumber === entry.pageNumber ? updatedEntry : k));
  }, [knowledgeBase, revisionSettings, updateKB]);

  const handleAddToPlan = useCallback(async (item: Omit<StudyPlanItem, 'id'>, newVideo?: VideoResource, attachments?: Attachment[]) => {
      const newItem: StudyPlanItem = { ...item, id: Date.now().toString(36), createdAt: new Date().toISOString() };
      updatePlan([...studyPlan, newItem]);
      if (newVideo || (attachments && attachments.length > 0)) {
          const existingKB = knowledgeBase.find(k => k.pageNumber === item.pageNumber);
          let updatedKB = [...knowledgeBase];
          if (existingKB) {
               updatedKB = updatedKB.map(k => k.pageNumber === item.pageNumber ? {
                   ...k, videoLinks: newVideo ? [...k.videoLinks, newVideo] : k.videoLinks,
                   attachments: attachments ? [...(k.attachments || []), ...attachments] : k.attachments
               } : k);
          } else {
              updatedKB.push({
                  pageNumber: item.pageNumber, title: item.topic, subject: 'General', system: 'General Principles',
                  revisionCount: 0, firstStudiedAt: null, lastStudiedAt: null, nextRevisionAt: null, currentRevisionIndex: 0,
                  ankiTotal: item.ankiCount || 0, ankiCovered: 0, videoLinks: newVideo ? [newVideo] : [],
                  attachments: attachments || [], tags: [], notes: '', logs: [], topics: []
              });
          }
          updateKB(updatedKB);
      }
  }, [studyPlan, knowledgeBase, updatePlan, updateKB]);

  const handleViewPage = useCallback((page: string) => {
      haptic.light();
      setViewingPage(page);
      setIsPageDetailOpen(true);
  }, []);

  const handleViewDayPlan = useCallback((date: string) => {
      setTargetPlanDate(date);
      setCurrentView('TODAYS_PLAN');
  }, []);

  const dueNowItems = useMemo(() => {
    const items: { id: string, title: string, subtitle: string, type: 'REVISION' | 'TASK', urgent: boolean }[] = [];
    knowledgeBase.forEach(kb => {
        if (kb.nextRevisionAt && new Date(kb.nextRevisionAt) <= new Date()) {
            items.push({ id: kb.pageNumber, title: `Revise: ${kb.title}`, subtitle: `Page ${kb.pageNumber}`, type: 'REVISION', urgent: true });
        }
        kb.topics.forEach(t => {
            if (t.nextRevisionAt && new Date(t.nextRevisionAt) <= new Date()) {
                if (!items.some(i => i.id === kb.pageNumber && i.title.includes(kb.title))) {
                     items.push({ id: `${kb.pageNumber}-${t.id}`, title: `Revise: ${t.name}`, subtitle: `Topic on Page ${kb.pageNumber}`, type: 'REVISION', urgent: true });
                }
            }
        });
    });
    fmgeData.forEach(fmge => {
        if (fmge.nextRevisionAt && new Date(fmge.nextRevisionAt) <= new Date()) {
            items.push({ id: fmge.id, title: `Revise: ${fmge.subject}`, subtitle: `Slides ${fmge.slideStart}-${fmge.slideEnd}`, type: 'REVISION', urgent: true });
        }
    });
    return items;
  }, [knowledgeBase, fmgeData]);

  // Show detailed loading screen
  if (authLoading) return <DetailedLoadingScreen status={currentStatus} logs={logs} />;
  
  if (!user) return <LoginView />;

  const secretId = user?.email?.split('@')[0];
  const showSidebar = settings.desktopLayout !== 'fullscreen';

  return (
    <div className="h-dvh w-full flex flex-col md:flex-row font-sans text-slate-800 dark:text-slate-200 transition-colors duration-300 relative overflow-hidden">
      <InstallPrompt />
      {/* OPTIMIZED: Reduced animations - only 2 blobs instead of 3, less blur, longer animation delay */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden opacity-60">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-300/20 blur-[80px] animate-pulse mix-blend-multiply dark:mix-blend-overlay"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-300/20 blur-[80px] animate-pulse mix-blend-multiply dark:mix-blend-overlay" style={{ animationDelay: '3s' }}></div>
      </div>

      <aside className={`${showSidebar ? 'hidden md:flex' : 'hidden'} w-72 flex-col m-4 rounded-3xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/30 dark:border-white/10 h-[calc(100vh-2rem)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sticky top-4 overflow-y-auto z-20 shadow-[0_8px_32px_rgba(0,0,0,0.05)] overscroll-contain`}>
          <div className="p-6 flex flex-col items-start gap-2">
              <div className="flex items-center gap-3">
                  <div className="w-12 h-12 flex items-center justify-center shadow-lg rounded-2xl bg-gradient-to-br from-white/80 to-slate-100/80 dark:from-slate-800/80 dark:to-slate-900/80 border border-white/50 dark:border-white/10 backdrop-blur-sm">
                       <AppLogo className="w-full h-full scale-75" />
                  </div>
                  <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-teal-500 tracking-tight drop-shadow-sm">FocusFlow</h1>
              </div>
              <div className="pl-1 mt-1 flex items-center gap-1">
                  <SyncIndicator />
                  <NetworkIndicator />
              </div>
          </div>
          <nav className="flex-1 px-4 space-y-3 pb-4">
              {activeMenuItems.map((item) => (
                  <button
                      key={item.id}
                      onClick={() => { 
                          haptic.medium();
                          if (item.id === 'TODAYS_PLAN') setTargetPlanDate(undefined); 
                          setCurrentView(item.id as any); 
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 font-bold text-sm relative overflow-hidden btn-3d ${currentView === item.id ? 'bg-gradient-to-r from-indigo-50/90 to-indigo-600/90 text-white shadow-lg border border-white/20' : 'bg-white/30 dark:bg-slate-800/30 text-slate-600 dark:text-slate-300 border border-white/20 hover:bg-white/50 dark:hover:bg-slate-800/50'}`}
                  >
                      <item.icon className={`w-5 h-5 ${currentView === item.id ? 'text-white' : ''}`} />
                      <span className="relative z-10">{item.label}</span>
                  </button>
              ))}
          </nav>
          <div className="px-4 pb-4">
              <button onClick={() => handleUpdateSettings({ ...settings, desktopLayout: 'fullscreen' })} className="w-full flex items-center gap-2 justify-center px-4 py-2 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"><ArrowsPointingOutIcon className="w-4 h-4" /> Full Screen</button>
          </div>
      </aside>

      <div className={`${showSidebar ? 'md:hidden' : ''} fixed top-0 left-0 right-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-white/20 dark:border-white/10 p-3 pt-[env(safe-area-inset-top)] z-30 flex justify-between items-center shadow-sm`}>
           <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-white/30"><AppLogo className="w-6 h-6" /></div>
               <span className="font-extrabold text-lg bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-teal-500">FocusFlow</span>
               <SyncIndicator />
               <NetworkIndicator />
           </div>
           <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-orange-100/50 dark:bg-orange-900/20 px-2 py-1 rounded-full border border-orange-200/50 dark:border-orange-900/30 shadow-inner backdrop-blur-sm" title="Current Streak"><FireIcon className="w-4 h-4 text-orange-500" /><span className="text-xs font-bold text-orange-600 dark:text-orange-400">{streak}</span></div>
                <button onClick={() => { haptic.light(); setIsSidebarOpen(!isSidebarOpen); }} className="p-2 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm btn-3d text-slate-600 dark:text-slate-300"><Bars3Icon className="w-6 h-6" /></button>
           </div>
      </div>

      {isSidebarOpen && (
          <div className="fixed inset-0 z-[100] bg-black/10 backdrop-blur-[2px]" onClick={() => setIsSidebarOpen(false)}>
              <div className="absolute top-16 right-4 w-64 max-h-[80vh] overflow-y-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/40 dark:border-slate-700/50 shadow-3d dark:shadow-3d-dark rounded-2xl origin-top-right animate-menu-pop p-2 overscroll-contain" onClick={(e) => e.stopPropagation()}>
                   <nav className="space-y-1">
                      {activeMenuItems.map((item) => (
                          <button key={item.id} onClick={() => { haptic.medium(); if (item.id === 'TODAYS_PLAN') setTargetPlanDate(undefined); setCurrentView(item.id as any); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-bold text-sm ${currentView === item.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'}`}><item.icon className={`w-5 h-5 ${currentView === item.id ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />{item.label}</button>
                      ))}
                  </nav>
                  {!showSidebar && (
                      <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                          <button onClick={() => { handleUpdateSettings({ ...settings, desktopLayout: 'sidebar' }); setIsSidebarOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-bold text-sm text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50"><LayoutSidebarIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />Show Sidebar</button>
                      </div>
                  )}
              </div>
          </div>
      )}

      <main className={`flex-1 pt-20 ${showSidebar ? 'md:pt-6' : 'md:pt-20'} p-4 md:p-6 overflow-y-auto overflow-x-hidden custom-scrollbar relative z-10 overscroll-contain pb-[env(safe-area-inset-bottom)]`}>
          <div className="max-w-6xl mx-auto h-full relative">
            {currentView !== 'FOCUS_TIMER' && (
                <div key={currentView} className="animate-liquid-enter h-full">
                    <Suspense fallback={<ViewLoadingFallback />}>
                      {currentView === 'DASHBOARD' && (
                          <>
                              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                                  <div><h1 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tight">Hello, {displayName || 'Doctor'} 👋</h1><p className="text-slate-500 dark:text-slate-400 font-medium mt-1 italic">"Act like the person you want to become."</p></div>
                                  <div className="flex gap-3 w-full md:w-auto"><button onClick={() => { setTargetPlanDate(undefined); setCurrentView('TODAYS_PLAN'); }} className="btn-3d bg-white/50 dark:bg-slate-800/50 border border-white/40 dark:border-slate-700/50 px-6 py-3 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 transition-all flex items-center gap-2 flex-1 md:flex-none justify-center backdrop-blur-md"><CalendarIcon className="w-4 h-4" />Today's Plan</button></div>
                              </div>
                              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                  <div className="space-y-8"><TodayGlance knowledgeBase={knowledgeBase} studyPlan={studyPlan} todayPlan={todayPlan} /><ActivityGraphs knowledgeBase={knowledgeBase} /></div>
                                  <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-3xl p-6 border border-white/40 dark:border-slate-700/50 card-3d">
                                      <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2 text-lg"><div className="p-2 bg-indigo-100/80 dark:bg-indigo-900/30 rounded-lg text-indigo-600"><ListCheckIcon className="w-5 h-5" /></div>Due Now</h3>
                                      <div className="space-y-3">{dueNowItems.length > 0 ? dueNowItems.map(item => (
                                              <div key={item.id} className={`p-4 rounded-2xl flex items-center justify-between transition-all hover:scale-[1.02] cursor-pointer shadow-sm border card-3d ${item.urgent ? 'bg-amber-50/60 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800' : 'bg-white/50 dark:bg-slate-800/50 border-white/40 dark:border-slate-700'}`}><div><p className="font-bold text-sm text-slate-800 dark:text-slate-100">{item.title}</p><p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{item.subtitle}</p></div><button className="btn-3d bg-white/70 dark:bg-slate-800/70 border border-white/40 dark:border-slate-600 text-primary px-4 py-2 rounded-lg text-xs font-bold shadow-sm backdrop-blur-sm">View</button></div>
                                          )) : (<div className="flex flex-col items-center justify-center py-12 text-center"><CheckCircleIcon className="w-12 h-12 text-green-200/80 mb-3" /><p className="text-slate-400 font-medium">All caught up! Great job.</p></div>)}</div>
                                  </div>
                              </div>
                          </>
                      )}
                      {currentView === 'STUDY_TRACKER' && <StudyTrackerView />}
                      {currentView === 'PLANNER' && <PlannerView plan={studyPlan} knowledgeBase={knowledgeBase} sessions={[]} onAddToPlan={handleAddToPlan} onUpdatePlanItem={async (item) => { updatePlan(studyPlan.map(p => p.id === item.id ? item : p)); }} onCompleteTask={async (item) => { const updatedItem = { ...item, isCompleted: !item.isCompleted, completedAt: !item.isCompleted ? new Date().toISOString() : undefined }; updatePlan(studyPlan.map(p => p.id === item.id ? updatedItem : p)); }} onStartTask={(item) => { setSessionPrefill({ topic: item.topic, pageNumber: item.pageNumber, ankiTotal: item.ankiCount }); setPlanContext({ planId: item.id, subTasks: item.subTasks || [] }); const exists = knowledgeBase.some(k => k.pageNumber === item.pageNumber && (k.revisionCount > 0 || k.logs.length > 0)); setSessionLogType(exists ? 'REVISION' : 'INITIAL'); setIsSessionModalOpen(true); }} onManageSession={(session) => { if(session && session.pageNumber) handleViewPage(session.pageNumber); }} onToggleSubTask={async (planId, subTaskId) => { const planItem = studyPlan.find(p => p.id === planId); if (planItem && planItem.subTasks) { const updatedSubTasks = planItem.subTasks.map(t => t.id === subTaskId ? { ...t, done: !t.done } : t); const updatedItem = { ...planItem, subTasks: updatedSubTasks }; updatePlan(studyPlan.map(p => p.id === planId ? updatedItem : p)); } }} onDeleteLog={async (planId, logId) => { const planItem = studyPlan.find(p => p.id === planId); if (planItem && planItem.logs) { const updatedLogs = planItem.logs.filter(l => l.id !== logId); const updatedItem = { ...planItem, logs: updatedLogs }; updatePlan(studyPlan.map(p => p.id === planId ? updatedItem : p)); } }} onViewPage={handleViewPage} sharedContent={sharedContent} />}
                      {currentView === 'TODAYS_PLAN' && <TodaysPlanView targetDate={viewStates.plan.currentDate} settings={settings} onUpdateSettings={handleUpdateSettings} knowledgeBase={knowledgeBase} onUpdateKnowledgeBase={updateKB} onUpdateFMGE={handleUpdateFMGE} onStartFocus={() => setCurrentView('FOCUS_TIMER')} />}
                      {currentView === 'CALENDAR' && <CalendarView knowledgeBase={knowledgeBase} studyPlan={studyPlan} onAddToPlan={handleAddToPlan} />}
                      {currentView === 'TIME_LOGGER' && <TimeLoggerView knowledgeBase={knowledgeBase} onViewPage={handleViewPage} />}
                      {currentView === 'DAILY_TRACKER' && <DailyTrackerView />}
                      {currentView === 'FA_LOGGER' && <FALoggerView knowledgeBase={knowledgeBase} onUpdateKnowledgeBase={updateKB} onViewPage={handleViewPage} faState={viewStates.fa} setFaState={(update) => setViewStates(prev => ({ ...prev, fa: typeof update === 'function' ? update(prev.fa) : update }))} />}
                      {currentView === 'FMGE' && <FMGEView fmgeData={fmgeData} onUpdateFMGE={handleUpdateFMGE} onDeleteFMGE={handleDeleteFMGE} />}
                      {currentView === 'REVISION' && <RevisionView knowledgeBase={knowledgeBase} onLogRevision={(item) => { setSessionPrefill({ topic: item.title, pageNumber: item.pageNumber, category: item.kbEntry.subject, system: item.kbEntry.system, ankiTotal: item.kbEntry.ankiTotal, ankiCovered: item.kbEntry.ankiCovered }); setSessionLogType('REVISION'); setIsSessionModalOpen(true); }} onDeleteSession={() => {}} onViewPage={handleViewPage} onDeleteRevision={handleDeleteRevision} viewState={viewStates.revision} setViewState={(update) => setViewStates(prev => ({ ...prev, revision: typeof update === 'function' ? update(prev.revision) : update }))} />}
                      {currentView === 'KNOWLEDGE_BASE' && <KnowledgeBaseView data={knowledgeBase} onUpdateEntry={(entry) => { updateKB(knowledgeBase.map(k => k.pageNumber === entry.pageNumber ? entry : k)); }} onDeleteEntry={handleDeleteKBEntry} onViewPage={handleViewPage} onRefreshData={() => {}} kbState={viewStates.kb} setKbState={(update) => setViewStates(prev => ({ ...prev, kb: typeof update === 'function' ? update(prev.kb) : update }))} />}
                      {currentView === 'DATA' && <DataView viewState={viewStates.data} setViewState={(update) => setViewStates(prev => ({ ...prev, data: typeof update === 'function' ? update(prev.data) : update }))} />}
                      {currentView === 'CHAT' && <AIChatView sessions={[]} studyPlan={studyPlan} streak={streak} onAddToPlan={handleAddToPlan} onViewDayPlan={handleViewDayPlan} displayName={displayName} knowledgeBase={knowledgeBase} onUpdateKnowledgeBase={updateKB} viewState={viewStates.chat} setViewState={(update) => setViewStates(prev => ({ ...prev, chat: typeof update === 'function' ? update(prev.chat) : update }))} />}
                      {currentView === 'AI_MEMORY' && <AIMemoryView displayName={displayName} onUpdateDisplayName={handleUpdateDisplayName} />}
                      {currentView === 'SETTINGS' && <SettingsView settings={settings} onUpdateSettings={handleUpdateSettings} secretId={secretId} displayName={displayName} onUpdateDisplayName={handleUpdateDisplayName} />}
                      {currentView === 'FOCUS_TIMER' && <FocusTimerView onBack={() => setCurrentView('TODAYS_PLAN')} knowledgeBase={knowledgeBase} onUpdateKnowledgeBase={updateKB} />}
                    </Suspense>
                </div>
            )}
          </div>
      </main>

      {isSessionModalOpen && (
          <SessionModal isOpen={isSessionModalOpen} onClose={() => { setIsSessionModalOpen(false); setEditingSession(null); setSessionPrefill(null); setPlanContext(null); }} initialData={editingSession} prefillData={sessionPrefill} planContext={planContext} knowledgeBase={knowledgeBase} defaultLogType={sessionLogType} onSave={(sessionData) => { const { pageNumber, topic, history, notes, ankiCovered, ankiTotal, planUpdates } = sessionData; const latestLog = history && history.length > 0 ? history[0] : null; if (latestLog) { let kbEntry = knowledgeBase.find(k => k.pageNumber === pageNumber); if (!kbEntry) { kbEntry = { pageNumber, title: topic || `Page ${pageNumber}`, subject: sessionData.category || 'Uncategorized', system: sessionData.system || 'General', revisionCount: 0, firstStudiedAt: null, lastStudiedAt: null, nextRevisionAt: null, currentRevisionIndex: 0, ankiTotal: ankiTotal || 0, ankiCovered: ankiCovered || 0, videoLinks: [], tags: [], notes: notes || '', logs: [], topics: [] }; } else { kbEntry = { ...kbEntry, notes: notes || kbEntry.notes, ankiCovered: ankiCovered || kbEntry.ankiCovered, ankiTotal: ankiTotal || kbEntry.ankiTotal }; } const isRevision = latestLog.type === 'REVISION' || latestLog.type === undefined; const newLog: RevisionLog = { id: latestLog.id, timestamp: latestLog.startTime, durationMinutes: latestLog.durationMinutes, revisionIndex: latestLog.type === 'INITIAL' ? 0 : kbEntry.revisionCount + 1, type: isRevision ? 'REVISION' : 'STUDY', notes: latestLog.notes, source: 'MODAL', topics: topic ? topic.split(',').map(t => t.trim()).filter(Boolean) : [], attachments: latestLog.attachments }; let updatedTopics = [...kbEntry.topics]; let foundTopic = false; if (topic) { const targetTopics = topic.split(',').map(t => t.trim().toLowerCase()); updatedTopics = updatedTopics.map(t => { if (targetTopics.includes(t.name.trim().toLowerCase())) { foundTopic = true; const tCurrentRev = t.revisionCount || 0; const tNextIndex = isRevision ? t.currentRevisionIndex + 1 : 0; const tNextDate = calculateNextRevisionDate(new Date(latestLog.startTime), tNextIndex, revisionSettings); return { ...t, revisionCount: isRevision ? tCurrentRev + 1 : tCurrentRev, currentRevisionIndex: tNextIndex, lastStudiedAt: latestLog.startTime, nextRevisionAt: tNextDate ? tNextDate.toISOString() : null }; } return t; }); } const newRevCount = isRevision ? kbEntry.revisionCount + 1 : kbEntry.revisionCount; const newRevIndex = isRevision ? kbEntry.currentRevisionIndex + 1 : 0; let pageNextDate = kbEntry.nextRevisionAt; if (!foundTopic || kbEntry.topics.length === 0) { const nextDateObj = calculateNextRevisionDate(new Date(latestLog.startTime), newRevIndex, revisionSettings); pageNextDate = nextDateObj ? nextDateObj.toISOString() : null; } const updatedKBEntry = { ...kbEntry, logs: [...kbEntry.logs, newLog], revisionCount: newRevCount, currentRevisionIndex: newRevIndex, lastStudiedAt: latestLog.startTime, firstStudiedAt: kbEntry.firstStudiedAt || latestLog.startTime, nextRevisionAt: pageNextDate, topics: updatedTopics }; const newKB = knowledgeBase.filter(k => k.pageNumber !== pageNumber).concat(updatedKBEntry); updateKB(newKB); } if (planContext && planUpdates && planUpdates.completedSubTaskIds) { const planItem = studyPlan.find(p => p.id === planContext.planId); if (planItem) { let updatedSubTasks = planItem.subTasks || []; updatedSubTasks = updatedSubTasks.map(t => planUpdates.completedSubTaskIds.includes(t.id) ? { ...t, done: true } : t); let updatedItem = { ...planItem, subTasks: updatedSubTasks }; if (planUpdates.isFinished) { updatedItem.isCompleted = true; updatedItem.completedAt = new Date().toISOString(); } if (latestLog) { const planLog = { id: latestLog.id, date: latestLog.date, durationMinutes: latestLog.durationMinutes, startTime: latestLog.startTime, endTime: latestLog.endTime, notes: latestLog.notes }; updatedItem.logs = [...(updatedItem.logs || []), planLog]; updatedItem.totalMinutesSpent = (updatedItem.totalMinutesSpent || 0) + latestLog.durationMinutes; } updatePlan(studyPlan.map(p => p.id === planItem.id ? updatedItem : p)); } } setIsSessionModalOpen(false); setEditingSession(null); setSessionPrefill(null); setPlanContext(null); }} />
      )}
      <PageDetailModal isOpen={isPageDetailOpen} onClose={() => setIsPageDetailOpen(false)} pageNumber={viewingPage} knowledgeBase={knowledgeBase} sessions={[]} onUpdateEntry={(entry) => { updateKB(knowledgeBase.map(k => k.pageNumber === entry.pageNumber ? entry : k)); }} />
    </div>
  );
}
