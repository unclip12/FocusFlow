
export interface UserProfile {
    displayName?: string;
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

export type BlockType = "VIDEO" | "REVISION_FA" | "ANKI" | "QBANK" | "BREAK" | "OTHER" | "MIXED";

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
    type: 'FA' | 'VIDEO' | 'ANKI' | 'QBANK' | 'OTHER';
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
    actionType?: 'VIEW_PLAN' | 'BLOCK_CONTROL';
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

export type TimeLogSource = 'TODAYS_PLAN_BLOCK' | 'FA_LOGGER' | 'MANUAL' | 'CHAT';

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

export interface NotificationConfig {
    enabled: boolean;
    mode: 'normal' | 'strict'; // C-Mode is strict
    types: {
        blockTimers: boolean;
        breaks: boolean;
        mentorNudges: boolean;
        dailySummary: boolean;
    };
}

export interface QuietHoursConfig {
    enabled: boolean;
    start: string; // "HH:mm" (24h)
    end: string; // "HH:mm" (24h)
}

export interface AppSettings {
    darkMode: boolean;
    primaryColor: ThemeColor;
    fontSize: 'small' | 'medium' | 'large';
    notifications: NotificationConfig;
    quietHours: QuietHoursConfig;
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
  attachments?: Attachment[];

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
  videoLinks: VideoResource[];
  tags: string[];
  notes: string;
  attachments?: Attachment[];
  logs: RevisionLog[];

  // New nested structure for topics & subtopics
  topics: TrackableItem[];
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
  'Cardiovascular',
  'Respiratory',
  'Renal',
  'Gastrointestinal',
  'Hematology/Oncology',
  'Neurology',
  'Psychiatry',
  'Endocrine',
  'Reproductive',
  'Musculoskeletal',
  'Dermatology'
];

/**
 * Returns YYYY-MM-DD string relative to the standard calendar day.
 * Updates at 12:00 AM.
 */
export const getAdjustedDate = (dateInput: Date | string): string => {
    const date = new Date(dateInput);
    
    // Return YYYY-MM-DD in local time
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
};
