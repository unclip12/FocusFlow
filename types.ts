
export interface UserProfile {
    displayName?: string;
    searchHistory?: string[];
}

export interface Attachment {
  id: string;
  name: string;
  type: 'IMAGE' | 'PDF' | 'OTHER';
  data: string; // Base64 string or URL
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number; // index
  explanation: string;
}

export interface ToDoItem {
  id: string;
  text: string;
  done: boolean;
}

export interface VideoResource {
  id: string;
  title: string;
  url: string;
}

export interface PlanLog {
    id: string;
    date: string;
    durationMinutes: number;
    notes?: string;
    startTime?: string;
    endTime?: string;
}

export interface StudyPlanItem {
  id:string;
  date: string; // YYYY-MM-DD (Target Date)
  type: 'PAGE' | 'VIDEO' | 'HYBRID'; // Updated to include HYBRID conceptually, though we merge visuals
  pageNumber: string; // Linker
  topic: string; // Snapshot or override
  videoUrl?: string; // If type is VIDEO
  ankiCount?: number; // Planned Anki cards
  estimatedMinutes: number;
  isCompleted: boolean;
  
  // New fields for granular tracking
  subTasks?: ToDoItem[]; 
  logs?: PlanLog[]; // History of sessions spent on this specific target
  totalMinutesSpent?: number; 
  attachments?: Attachment[]; // New field for syncing with DB
  
  // Timestamps
  createdAt?: string;
  completedAt?: string;
}

// New interface for the requested Study Tracker
export interface StudyEntry {
    id: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
    taskName: string;
    progress: number; // 0-100
    revision: boolean;
    durationMinutes?: number;
}

// --- DEPRECATED - WILL BE MIGRATED ---
export interface StudyLog {
  id: string;
  date: string; // ISO string of entry creation (Start Time)
  startTime: string; // ISO string
  endTime: string; // ISO string
  durationMinutes: number;
  type: 'INITIAL' | 'REVISION';
  
  // New detailed tracking fields
  notes?: string;
  ankiDelta?: number; // Cards done specifically in this session
  subTasksCompleted?: string[];
  attachments?: Attachment[];
}

export interface StudySession {
  id: string;
  topic: string; 
  pageNumber: string; 
  category: string;
  system?: string; // New field
  
  // Spaced Repetition Config
  revisionIntervals: number[]; 
  currentIntervalIndex: number; 
  nextRevisionDate: string | null; 
  
  // Tracking
  ankiDone: boolean; 
  ankiTotal?: number;
  ankiCovered?: number;
  
  history: StudyLog[];
  notes?: string;
  toDoList?: ToDoItem[];
  
  // Computed for backward compatibility/display
  lastStudied: string; 
}
// --- END DEPRECATED ---


export interface StudyMaterial {
  id: string;
  title: string;
  text: string;
  sourceType: 'PDF' | 'IMAGE' | 'TEXT';
  createdAt: string; // ISO
  isActive: boolean; // For Study Buddy
  tokenEstimate?: number;
  // New fields for Mentor integration
  source?: 'UPLOAD' | 'MENTOR' | 'PASTE'; 
  relatedSessionId?: string;
}

export interface MaterialChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string; // ISO
}

// --- NEW DAY PLAN TYPES ---

export interface DayPlanVideo {
  subject?: string;
  topic?: string;
  totalContentHours: number;
  playbackRate: number;
  effectiveStudyMinutes: number;
}

export interface DayPlanBreak {
  label: string;
  startTime?: string;
  endTime?: string;
  durationMinutes: number;
}

export type BlockType = "VIDEO" | "REVISION_FA" | "ANKI" | "QBANK" | "BREAK" | "OTHER" | "MIXED" | "FMGE_REVISION";

export interface BlockSegment {
  start: string; // HH:mm or ISO
  end?: string;   // HH:mm or ISO
}

export interface BlockInterruption {
  start: string; // HH:mm or ISO
  end?: string;   // HH:mm or ISO
  reason: string;
}

export interface TaskExecution {
    completed: boolean;
    note?: string; // Experience if completed, Reason if not
}

export interface BlockTask {
    id: string;
    type: 'FA' | 'VIDEO' | 'ANKI' | 'QBANK' | 'OTHER' | 'FMGE' | 'REVISION';
    detail: string; // e.g. "Page 550", "Cardio Video"
    completed: boolean;
    meta?: {
        pageNumber?: number;
        count?: number;
        topic?: string;
        system?: string;
        subject?: string;
        subtopics?: string[];
        url?: string;
        videoDuration?: number;
        videoStartTime?: number;
        videoEndTime?: number;
        playbackSpeed?: number;
        // FMGE Specifics
        slideStart?: number;
        slideEnd?: number;
        // Focus Timer Specifics
        logStart?: string; // HH:mm
        logEnd?: string; // HH:mm
    };
    execution?: TaskExecution;
}

export interface Block {
  id: string;
  index: number;                // order in the day (0,1,2…)
  date: string;                 // same as dayPlan.date
  plannedStartTime: string;     // "HH:mm"
  plannedEndTime: string;       // "HH:mm"
  type: BlockType;
  title: string;                // e.g. "Watch Surgery video", "Revise with FA"
  description?: string;         // short description
  
  // Granular Tasks within the block
  tasks?: BlockTask[];

  relatedVideoId?: string;      // optional link into videos[] of the dayPlan
  relatedFaPages?: number[];    // list of FA pages used in this block
  relatedAnkiInfo?: { totalCards?: number };
  relatedQbankInfo?: { totalQuestions?: number };

  plannedDurationMinutes: number;

  // Actual execution
  actualStartTime?: string;     // "HH:mm"
  actualEndTime?: string;       // "HH:mm"
  actualDurationMinutes?: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "PAUSED" | "DONE" | "SKIPPED";

  // Granular Timeline Tracking
  segments?: BlockSegment[];
  interruptions?: BlockInterruption[];

  // Tracking what actually happened
  actualNotes?: string;         
  
  // Reflection & Carry Forward
  completionStatus?: 'COMPLETED' | 'PARTIAL' | 'NOT_DONE';
  actualPagesCovered?: number[];
  carryForwardPages?: number[];
  reflectionNotes?: string;
  
  // Link to where tasks were moved
  rescheduledTo?: string; // Time string e.g. "09:00 PM" or Block ID
  
  // Sync Tracking
  generatedLogIds?: string[]; // IDs of KnowledgeBase logs created by this block
  generatedTimeLogIds?: string[]; // IDs of TimeLogs created by this block

  // --- DYNAMIC / UI PROPERTIES ---
  isVirtual?: boolean; // If true, this block is projected from KnowledgeBase and not saved in DayPlan yet
}

export interface DayPlan {
  date: string; // YYYY-MM-DD
  faPages: number[];
  faPagesCount: number;
  faStudyMinutesPlanned: number | null;

  videos: DayPlanVideo[];
  
  anki: {
    totalCards: number;
    plannedMinutes: number;
    timeWindowStart?: string;
    timeWindowEnd?: string;
  } | null;

  qbank: {
    totalQuestions: number;
    plannedMinutes: number;
    timeWindowStart?: string;
    timeWindowEnd?: string;
  } | null;

  notesFromUser: string;
  notesFromAI: string;

  attachments: Attachment[];
  breaks: DayPlanBreak[];

  // Blocks for execution
  blocks?: Block[];
  blockDurationSetting?: number; // 30, 40, 45, 50

  startTimePlanned?: string; // HH:mm
  startTimeActual?: string; // HH:mm
  estimatedEndTime?: string; // HH:mm

  totalStudyMinutesPlanned: number;
  totalBreakMinutes: number;
}

// Mentor Chat Persisted Type
export interface MentorMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: string; // ISO
    isSystemAction?: boolean;
    actionType?: 'VIEW_PLAN' | 'BLOCK_CONTROL' | 'CONFIRM_IMPORT';
    actionPayload?: any;
}

// --- NEW AI MEMORY TYPES ---

export interface BacklogItem {
    id: string;
    dateOriginal: string;
    task: string;
    estimatedMinutes: number;
    reason?: string;
    status?: 'PENDING' | 'SKIPPED_PERMANENTLY' | 'DONE';
}

// Personal Memory for AI
export interface MentorMemory {
    // Profile
    examTarget?: string; // e.g. "FMGE"
    examDate?: string; // YYYY-MM-DD
    
    // Stats
    averageOverrunMinutes?: number;
    
    // Behavior
    learningStyle?: string;
    typicalDelaysIn?: string[];
    
    // Preferences
    preferredTone?: 'strict' | 'encouraging' | 'balanced';
    
    // Backlog Logic
    backlog?: BacklogItem[];
    
    // Freeform
    notes?: string;
    lastUpdated?: string;
}

// --- TIME LOGGER TYPES ---
export type TimeLogCategory = 
  | 'STUDY' 
  | 'REVISION' 
  | 'QBANK' 
  | 'ANKI' 
  | 'VIDEO' 
  | 'NOTE_TAKING' 
  | 'BREAK' 
  | 'PERSONAL' 
  | 'SLEEP' 
  | 'ENTERTAINMENT' 
  | 'OUTING' 
  | 'LIFE' 
  | 'OTHER';

export type TimeLogSource = 'TODAYS_PLAN_BLOCK' | 'FA_LOGGER' | 'MANUAL' | 'CHAT' | 'FMGE_LOGGER';

export interface TimeLogEntry {
    id: string;
    date: string; // YYYY-MM-DD
    startTime: string; // ISO string
    endTime: string; // ISO string
    durationMinutes: number;
    
    category: TimeLogCategory;
    source: TimeLogSource;
    
    // Details
    activity: string; // Label/Title
    pageNumber?: string | number;
    topics?: string[];
    notes?: string;
    
    linkedEntityId?: string; // blockId or pageNumber reference
}

// --- DAILY TRACKER TYPES ---
export interface TrackerTask {
  id: string;
  text: string;
  isCompleted: boolean;
  reason?: string;
  timeInvestedMinutes?: number;
}

export interface TimeSlot {
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  tasks: TrackerTask[];
}

export interface DailyTracker {
    date: string; // YYYY-MM-DD
    timeSlots: TimeSlot[];
}


export type ThemeColor = 'indigo' | 'emerald' | 'rose' | 'amber' | 'sky' | 'violet';

// --- NEW THEME SYSTEM ---
export interface AppTheme {
    id: string;
    name: string;
    bgGradient: string; // Light Mode BG
    darkBgGradient: string; // Dark Mode BG
    surfaceRGB: string; // Light Mode Surface
    darkSurfaceRGB: string; // Dark Mode Surface
    backgroundRGB: string; // Light Mode Background (fallback)
    darkBackgroundRGB: string; // Dark Mode Background (fallback)
    isDark?: boolean; // Kept for compatibility, logic handled by App settings
}

export const THEME_COLORS: { name: string, value: ThemeColor, hex: string, rgb: string }[] = [
    { name: 'Indigo', value: 'indigo', hex: '#4f46e5', rgb: '79 70 229' },
    { name: 'Emerald', value: 'emerald', hex: '#10b981', rgb: '16 185 129' },
    { name: 'Rose', value: 'rose', hex: '#f43f5e', rgb: '244 63 94' },
    { name: 'Amber', value: 'amber', hex: '#f59e0b', rgb: '245 158 11' },
    { name: 'Sky', value: 'sky', hex: '#0ea5e9', rgb: '14 165 233' },
    { name: 'Violet', value: 'violet', hex: '#8b5cf6', rgb: '139 92 246' },
];

export const APP_THEMES: AppTheme[] = [
    { 
        id: 'default', 
        name: 'Flow White', 
        bgGradient: 'linear-gradient(to bottom right, #f1f5f9, #e2e8f0)', 
        darkBgGradient: 'linear-gradient(to bottom, #0f172a, #1e293b)',
        surfaceRGB: '255 255 255', 
        darkSurfaceRGB: '30 41 59',
        backgroundRGB: '241 245 249',
        darkBackgroundRGB: '15 23 42',
        isDark: false 
    },
    { 
        id: 'midnight', 
        name: 'Midnight Deep', 
        bgGradient: 'linear-gradient(to bottom, #94a3b8, #cbd5e1)', 
        darkBgGradient: 'linear-gradient(to bottom, #020617, #0f172a)',
        surfaceRGB: '255 255 255',
        darkSurfaceRGB: '15 23 42', 
        backgroundRGB: '241 245 249',
        darkBackgroundRGB: '2 6 23',
        isDark: true 
    },
    { 
        id: 'pastel-sunset', 
        name: 'Pastel Sunset', 
        bgGradient: 'linear-gradient(120deg, #fccb90 0%, #d57eeb 100%)', 
        darkBgGradient: 'linear-gradient(120deg, #4a254c 0%, #2a1b3d 100%)', // Muted dark purple
        surfaceRGB: '255 255 255', 
        darkSurfaceRGB: '45 30 60', // Dark purple surface
        backgroundRGB: '250 240 245',
        darkBackgroundRGB: '30 20 40',
        isDark: false 
    },
    { 
        id: 'mint-fresh', 
        name: 'Fresh Mint', 
        bgGradient: 'linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)', 
        darkBgGradient: 'linear-gradient(120deg, #0f3d2e 0%, #103e52 100%)', // Dark Teal
        surfaceRGB: '255 255 255', 
        darkSurfaceRGB: '20 50 45',
        backgroundRGB: '235 250 250',
        darkBackgroundRGB: '10 35 35',
        isDark: false 
    },
    { 
        id: 'deep-ocean', 
        name: 'Deep Ocean', 
        bgGradient: 'linear-gradient(to top, #accbee 0%, #e7f0fd 100%)', 
        darkBgGradient: 'linear-gradient(to top, #1e3c72 0%, #2a5298 100%)',
        surfaceRGB: '255 255 255', 
        darkSurfaceRGB: '30 58 138',
        backgroundRGB: '240 248 255',
        darkBackgroundRGB: '23 37 84',
        isDark: true 
    },
    { 
        id: 'soft-lilac', 
        name: 'Soft Lilac', 
        bgGradient: 'linear-gradient(to top, #c471f5 0%, #fa71cd 100%)', 
        darkBgGradient: 'linear-gradient(to top, #4a1c63 0%, #5c1f45 100%)',
        surfaceRGB: '255 255 255', 
        darkSurfaceRGB: '50 30 60',
        backgroundRGB: '250 240 250',
        darkBackgroundRGB: '35 15 40',
        isDark: false 
    },
    { 
        id: 'warm-peach', 
        name: 'Warm Peach', 
        bgGradient: 'linear-gradient(to right, #fa709a 0%, #fee140 100%)', 
        darkBgGradient: 'linear-gradient(to right, #661f36 0%, #664d00 100%)',
        surfaceRGB: '255 255 255', 
        darkSurfaceRGB: '60 30 30',
        backgroundRGB: '255 245 245',
        darkBackgroundRGB: '40 15 15',
        isDark: false 
    },
    { 
        id: 'night-sky', 
        name: 'Night Sky', 
        bgGradient: 'linear-gradient(to bottom, #a1c4fd 0%, #c2e9fb 100%)', 
        darkBgGradient: 'linear-gradient(to bottom, #020024 0%, #090979 35%, #00d4ff 100%)',
        surfaceRGB: '255 255 255', 
        darkSurfaceRGB: '17 24 39',
        backgroundRGB: '240 248 255',
        darkBackgroundRGB: '2 6 23',
        isDark: true 
    },
    { 
        id: 'citrus-burst', 
        name: 'Citrus Burst', 
        bgGradient: 'linear-gradient(to right, #f83600 0%, #f9d423 100%)', 
        darkBgGradient: 'linear-gradient(to right, #6e2c00 0%, #5c4d00 100%)',
        surfaceRGB: '255 255 255', 
        darkSurfaceRGB: '60 40 20',
        backgroundRGB: '255 250 240',
        darkBackgroundRGB: '40 25 10',
        isDark: false 
    },
    { 
        id: 'mystic-forest', 
        name: 'Mystic Forest', 
        bgGradient: 'linear-gradient(to bottom, #d4fc79 0%, #96e6a1 100%)', 
        darkBgGradient: 'linear-gradient(to bottom, #134e5e 0%, #71b280 100%)',
        surfaceRGB: '255 255 255', 
        darkSurfaceRGB: '6 78 59',
        backgroundRGB: '240 255 245',
        darkBackgroundRGB: '2 44 34',
        isDark: true 
    },
    { 
        id: 'royal-violet', 
        name: 'Royal Violet', 
        bgGradient: 'linear-gradient(to right, #654ea3, #eaafc8)', 
        darkBgGradient: 'linear-gradient(to right, #2e1f45, #4a2a3b)',
        surfaceRGB: '255 255 255', 
        darkSurfaceRGB: '40 20 60',
        backgroundRGB: '250 245 255',
        darkBackgroundRGB: '20 10 30',
        isDark: true 
    },
    { 
        id: 'cloudy-sky', 
        name: 'Cloudy Sky', 
        bgGradient: 'linear-gradient(to top, #cfd9df 0%, #e2ebf0 100%)', 
        darkBgGradient: 'linear-gradient(to top, #374151 0%, #1f2937 100%)',
        surfaceRGB: '255 255 255', 
        darkSurfaceRGB: '55 65 81',
        backgroundRGB: '248 250 252',
        darkBackgroundRGB: '31 41 55',
        isDark: false 
    },
];

export interface NotificationTrigger {
    id: string;
    category: 'FIRST_BLOCK' | 'BLOCK_START' | 'BLOCK_END' | 'OVERDUE';
    timing: 'BEFORE' | 'AFTER';
    offsetMinutes: number;
    enabled: boolean;
}

export interface NotificationConfig {
    enabled: boolean;
    mode: 'normal' | 'strict'; // C-Mode is strict
    types: {
        blockTimers: boolean;
        breaks: boolean;
        mentorNudges: boolean;
        dailySummary: boolean;
    };
    customTriggers?: NotificationTrigger[]; // New custom triggers
}

export interface QuietHoursConfig {
    enabled: boolean;
    start: string; // "HH:mm" (24h)
    end: string; // "HH:mm" (24h)
}

export interface MenuItemConfig {
    id: string;
    visible: boolean;
}

export const DEFAULT_MENU_ORDER: string[] = [
    'DASHBOARD',
    'STUDY_TRACKER', // Added Study Tracker to default menu
    'TODAYS_PLAN',
    'FOCUS_TIMER', 
    'CALENDAR',
    'TIME_LOGGER',
    'FMGE',
    'DAILY_TRACKER',
    'FA_LOGGER',
    'REVISION',
    'KNOWLEDGE_BASE',
    'DATA',
    'CHAT',
    'AI_MEMORY',
    'SETTINGS'
];

export interface AppSettings {
    darkMode: boolean;
    themeId?: string; // ID from APP_THEMES
    primaryColor: ThemeColor;
    fontSize: 'small' | 'medium' | 'large';
    notifications: NotificationConfig;
    quietHours: QuietHoursConfig;
    ankiHost?: string; // New: Host URL for AnkiConnect
    ankiTagPrefix?: string; // NEW: Prefix for Anki tags (default FA_Page::)
    desktopLayout?: 'sidebar' | 'fullscreen'; // NEW: Desktop Layout preference
    menuConfiguration?: MenuItemConfig[]; // NEW: Custom menu ordering and visibility
}

// --- NEW AI & REVISION SETTINGS ---

export interface AISettings {
    personalityMode?: 'calm' | 'balanced' | 'strict';
    talkStyle?: 'short' | 'teaching' | 'motivational';
    disciplineLevel?: number; // 1-5
    memoryPermissions?: {
        canReadKnowledgeBase: boolean;
        canReadTimeLogs: boolean;
        canReadInfoFiles: boolean;
    };
}

export interface RevisionSettings {
    mode?: 'fast' | 'balanced' | 'deep';
    targetCount?: number; // 5-15
    carryForwardRule?: 'next_block' | 'end_of_day' | 'next_day';
}

export enum FilterType {
  ALL = 'ALL',
  DUE_TODAY = 'DUE_TODAY',
  UPCOMING = 'UPCOMING',
  MASTERED = 'MASTERED'
}

// --- NEW UNIFIED KNOWLEDGE BASE & SRS MODEL ---

export interface RevisionLog {
  id: string;
  timestamp: string; // ISO
  durationMinutes?: number;
  revisionIndex: number; // 0 for initial study, 1 for first revision, etc.
  type: 'STUDY' | 'REVISION';
  topics?: string[];
  subtopics?: string[];
  notes?: string;
  source?: 'CHAT' | 'MODAL';
  attachments?: Attachment[];
}

export interface TrackableItem {
  id: string;
  name: string;
  
  // SRS fields
  revisionCount: number;
  lastStudiedAt: string | null;
  nextRevisionAt: string | null;
  currentRevisionIndex: number;

  logs: RevisionLog[];
  notes?: string;
  attachments?: Attachment[]; // New: Specific attachments for this subtopic
  
  // New field for detailed content breakdown (e.g. bullet points)
  content?: string[]; 

  // Hierarchy for topics
  subTopics?: TrackableItem[];
}

export interface KnowledgeBaseEntry {
  pageNumber: string; // Key identifier
  title: string;
  subject: string;
  system: string;
  
  // Page-level SRS
  revisionCount: number;
  firstStudiedAt: string | null;
  lastStudiedAt: string | null;
  nextRevisionAt: string | null;
  currentRevisionIndex: number;
  
  // Page-level content
  ankiTotal: number;
  ankiCovered: number;
  ankiTag?: string; // New: Link to specific Anki Deck/Tag
  videoLinks: VideoResource[];
  tags: string[];
  notes: string;
  keyPoints?: string[]; // New field: High Yield Points
  attachments?: Attachment[];
  logs: RevisionLog[];

  // New nested structure for topics & subtopics
  topics: TrackableItem[];
}

// --- FMGE SPECIFIC TYPES ---
export const FMGE_SUBJECTS = [
    'Anatomy', 'Physiology', 'Biochemistry', 'Pathology', 'Microbiology', 'Pharmacology', 
    'Forensic Medicine', 'PSM', 'ENT', 'Ophthalmology', 'Medicine', 'Surgery', 'OBG', 
    'Pediatrics', 'Orthopedics', 'Psychiatry', 'Dermatology', 'Radiology', 'Anesthesia'
];

export interface FMGELog extends RevisionLog {
    slideStart: number;
    slideEnd: number;
    qBankCount?: number;
}

export interface FMGEEntry {
    id: string;
    subject: string;
    slideStart: number;
    slideEnd: number;
    
    // SRS Fields
    revisionCount: number;
    lastStudiedAt: string | null;
    nextRevisionAt: string | null;
    currentRevisionIndex: number;
    
    logs: FMGELog[];
    notes?: string;
}

// --- REVISION ITEM INTERFACE ---
export interface RevisionItem {
    type: 'PAGE' | 'TOPIC' | 'SUBTOPIC';
    pageNumber: string;
    title: string;
    parentTitle: string;
    nextRevisionAt: string;
    currentRevisionIndex: number;
    id: string; 
    kbEntry: KnowledgeBaseEntry;
    topic?: TrackableItem;
    subTopic?: TrackableItem;
    groupedTopics?: TrackableItem[]; // For batch revisions
}

// --- HISTORY & UNDO TYPES ---
// Expanded to capture full app state for "Time Travel" restoration
export interface AppSnapshot {
    kb: KnowledgeBaseEntry[];
    dayPlan?: DayPlan | null;
    fmge: FMGEEntry[];
    // We can add more stores here as needed
}

export interface HistoryRecord {
    id: string;
    timestamp: string;
    type: 'KB_UPDATE' | 'PLAN_UPDATE' | 'FMGE_UPDATE' | 'FULL_RESTORE' | 'SNAPSHOT' | 'AUTO_DAILY'; 
    description: string;
    snapshot: AppSnapshot | KnowledgeBaseEntry | DayPlan | any; // Flexible based on type, but for time machine we use AppSnapshot
    isFullSnapshot?: boolean; // Flag to easily identify full restoration points
}

export const REVISION_SCHEDULES: Record<string, number[]> = {
    // In hours from last review. 0 days = 4 hours.
    fast: [24, 72, 168, 360, 720], // 1d, 3d, 7d, 15d, 30d
    balanced: [4, 24, 48, 120, 240, 480, 960], // 4h, 1d, 2d, 5d, 10d, 20d, 40d
    deep: [4, 24, 72, 168, 336, 720, 1440], // 4h, 1d, 3d, 7d, 14d, 30d, 60d
};

export const CATEGORIES = ['Pathology', 'Physiology', 'Pharmacology', 'Microbiology', 'Immunology', 'Biochem', 'Anatomy', 'Public Health', 'Ethics', 'Other'];

export const SYSTEMS = [
  'General Principles',
  'Behavioral Science',
  'Biochemistry',
  'Biostatistics & Epidemiology',
  'Microbiology',
  'Immunology',
  'Pathology',
  'Pharmacology',
  'Public Health Sciences',
  'Cardiovascular',
  'Endocrine',
  'Gastrointestinal',
  'Hematology & Oncology',
  'Musculoskeletal, Skin, & Connective Tissue',
  'Neurology',
  'Psychiatry',
  'Renal',
  'Reproductive',
  'Respiratory',
  'Rapid Review'
];

/**
 * Returns YYYY-MM-DD string relative to the standard calendar day.
 * Updates at 12:00 AM.
 */
export const getAdjustedDate = (dateInput: Date | string): string => {
    // Handle null, undefined, or empty string by creating a new Date() for today
    const safeDateInput = dateInput || new Date();
    
    let date: Date;

    // The main problem is `new Date('YYYY-MM-DD')` in Safari, which parses as UTC.
    // ISO strings like `YYYY-MM-DDTHH:mm:ss.sssZ` are fine.
    // Date objects are fine.
    if (typeof safeDateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(safeDateInput)) {
        // It's a 'YYYY-MM-DD' string, make it timezone-safe by treating it as local time.
        // Replacing dashes with slashes is a common way to achieve this.
        date = new Date(safeDateInput.replace(/-/g, '/'));
    } else {
        date = new Date(safeDateInput);
    }
    
    // Check for "Invalid Date"
    if (isNaN(date.getTime())) {
        console.warn('getAdjustedDate received an invalid dateInput, falling back to today:', dateInput);
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // Return YYYY-MM-DD in local time
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
};

// --- LOGGING & VIEW STATE TYPES ---

export interface FALogData {
    logId?: string;
    pageNumber: string;
    date: string;
    startTime: string;
    endTime: string;
    selectedTopics: string[];
    notes: string;
}

export interface ViewStates {
    kb: {
        search: string;
        selectedSystem: string;
        sortBy: 'PAGE' | 'TOPIC' | 'SYSTEM' | 'SUBJECT' | 'REVISIONS' | 'STUDIED' | 'LAST_STUDIED' | 'RECENTLY_ADDED';
        sortOrder: 'ASC' | 'DESC';
        viewMode: 'PAGE_WISE' | 'SUBTOPIC_WISE';
    };
    fa: {
        isLogModalOpen: boolean;
        modalMode: 'STUDY' | 'REVISION';
        draftLog: FALogData | null;
        logToEdit: FALogData | null;
    };
    plan: {
        currentDate: string;
        viewMode: 'full' | 'blocks';
        isManualModalOpen: boolean;
    };
    timeLog: {
        selectedDate: string;
        input: string;
    };
    revision: {
        activeTab: 'DUE' | 'UPCOMING' | 'HISTORY';
        sortBy: 'TIME' | 'PAGE' | 'TOPIC' | 'SYSTEM';
        sortOrder: 'ASC' | 'DESC';
    };
    calendar: {
        currentMonth: Date;
        selectedDate: Date;
        viewMode: 'MONTH' | 'DAY';
    };
    chat: {
        mode: 'MENTOR' | 'BUDDY';
        input: string;
    };
    data: {
        filterSource: 'ALL' | 'UPLOAD' | 'MENTOR';
    };
    studyTracker: {
        selectedDate: string;
        search: string;
    };
}
