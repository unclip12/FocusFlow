

export interface Attachment {
  id: string;
  name: string;
  type: 'IMAGE' | 'PDF' | 'OTHER';
  data: string; // Base64 string
}

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

export interface KnowledgeBaseEntry {
  pageNumber: string; // Key identifier
  topic: string;
  subTopics?: string[]; // New field for detailed breakdown
  subject: string;
  system: string; // e.g., Cardio, Renal
  ankiTotal: number;
  videoLinks: VideoResource[];
  tags: string[];
  notes: string;
  attachments?: Attachment[];
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
  id: string;
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

export type ThemeColor = 'indigo' | 'emerald' | 'rose' | 'amber' | 'sky' | 'violet';

export interface AppSettings {
    darkMode: boolean;
    primaryColor: ThemeColor;
    fontSize: 'small' | 'medium' | 'large';
}

export enum FilterType {
  ALL = 'ALL',
  DUE_TODAY = 'DUE_TODAY',
  UPCOMING = 'UPCOMING',
  MASTERED = 'MASTERED'
}

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

export const DEFAULT_INTERVALS = [24, 72, 168, 336]; // 1 day, 3 days, 1 week, 2 weeks

/**
 * Returns YYYY-MM-DD string relative to the "Study Day".
 * If time is before 4:00 AM, it returns the Previous Day's date.
 */
export const getAdjustedDate = (dateInput: Date | string): string => {
    const date = new Date(dateInput);
    // Clone to avoid mutation
    const adjusted = new Date(date);
    
    // If hour is 0, 1, 2, 3 (before 4am), subtract 1 day to count as previous "Study Day"
    if (adjusted.getHours() < 4) {
        adjusted.setDate(adjusted.getDate() - 1);
    }
    
    // Return YYYY-MM-DD in local time
    const year = adjusted.getFullYear();
    const month = String(adjusted.getMonth() + 1).padStart(2, '0');
    const day = String(adjusted.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
};
