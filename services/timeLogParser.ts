
import { TimeLogCategory, getAdjustedDate } from "../types";

interface ParsedTimeLog {
    date: string;
    startTime: string; // ISO
    endTime: string; // ISO
    category: TimeLogCategory;
    label: string;
    durationMinutes: number;
    pageNumber?: number;
}

const CATEGORY_KEYWORDS: Record<string, TimeLogCategory> = {
    'break': 'BREAK', 'lunch': 'BREAK', 'dinner': 'BREAK', 'breakfast': 'BREAK', 'nap': 'BREAK', 'rest': 'BREAK', 'coffee': 'BREAK', 'snack': 'BREAK',
    'study': 'STUDY', 'studied': 'STUDY', 'read': 'STUDY', 'learning': 'STUDY', 'fa': 'STUDY', 'first aid': 'STUDY', 'reading': 'STUDY',
    'revise': 'REVISION', 'revision': 'REVISION', 'revised': 'REVISION', 'review': 'REVISION', 'revising': 'REVISION',
    'video': 'VIDEO', 'watch': 'VIDEO', 'lecture': 'VIDEO', 'watching': 'VIDEO',
    'anki': 'ANKI', 'flashcard': 'ANKI', 'cards': 'ANKI',
    'qbank': 'QBANK', 'questions': 'QBANK', 'mcq': 'QBANK', 'uworld': 'QBANK', 'amboss': 'QBANK',
    'sleep': 'SLEEP', 'slept': 'SLEEP', 'bed': 'SLEEP',
    'gym': 'LIFE', 'workout': 'LIFE', 'walk': 'LIFE', 'shower': 'LIFE', 'run': 'LIFE', 'exercise': 'LIFE', 'chore': 'LIFE',
    'movie': 'ENTERTAINMENT', 'game': 'ENTERTAINMENT', 'netflix': 'ENTERTAINMENT', 'youtube': 'ENTERTAINMENT', 'gaming': 'ENTERTAINMENT', 'play': 'ENTERTAINMENT',
    'out': 'OUTING', 'friend': 'OUTING', 'party': 'OUTING', 'dinner out': 'OUTING',
};

const parseTime = (timeStr: string, dateStr: string): Date | null => {
    try {
        // Basic normalization
        const d = new Date(dateStr + 'T00:00:00');
        const lower = timeStr.toLowerCase();
        const isPM = lower.includes('pm');
        const isAM = lower.includes('am');
        
        let clean = lower.replace(/[ap]m/g, '').trim();
        let [h, m] = clean.split(/[:.]/).map(Number);
        if (isNaN(m)) m = 0;

        // 12-hour adjustment
        if (isPM && h < 12) h += 12;
        if (isAM && h === 12) h = 0; // 12am is 0
        
        // Heuristic for ambiguous times (e.g. "5-6")
        // We resolve ambiguity at the range level usually, but if single time:
        // If it's "2", assume 2 PM unless context suggests otherwise? 
        // For safety, without AM/PM, raw numbers < 7 usually imply PM in a daily study context, 
        // but we stick to 24h or raw interpretation if AM/PM missing for single parses.
        
        d.setHours(h, m, 0, 0);
        return d;
    } catch (e) {
        return null;
    }
};

export const parseNaturalTimeLog = (input: string): ParsedTimeLog | null => {
    const now = new Date();
    const todayStr = getAdjustedDate(now);
    let targetDateStr = todayStr;
    
    const lowerInput = input.toLowerCase();

    // 1. Detect Date
    if (lowerInput.includes('yesterday')) {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        targetDateStr = getAdjustedDate(d);
    } else {
        // Try basic YYYY-MM-DD
        const dateMatch = input.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) targetDateStr = dateMatch[1];
    }

    // 2. Detect Category
    let category: TimeLogCategory = 'OTHER';
    for (const [keyword, cat] of Object.entries(CATEGORY_KEYWORDS)) {
        // Simple word boundary check
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(lowerInput)) {
            category = cat;
            break;
        }
    }

    // 3. Detect Page Number
    let pageNumber: number | undefined;
    const pgMatch = lowerInput.match(/(?:pg|page|p\.?)\s*(\d+)/);
    if (pgMatch) {
        pageNumber = parseInt(pgMatch[1]);
        if (category === 'OTHER') category = 'STUDY'; // Infer study if page mentioned
    }

    // 4. Detect Time Range or Duration
    let start: Date | null = null;
    let end: Date | null = null;

    // Regex for ranges like "5-6pm", "5:30 to 6:00", "1700-1800"
    const timeRangeRegex = /(\d{1,2}(?:[:.]\d{2})?(?:\s*[ap]m)?)\s*(?:-|to|until)\s*(\d{1,2}(?:[:.]\d{2})?(?:\s*[ap]m)?)/i;
    const durationRegex = /(\d+(?:\.\d+)?)\s*(?:min|hr|hour)s?/;

    const timeMatch = input.match(timeRangeRegex);
    const durMatch = input.match(durationRegex);

    if (timeMatch) {
        const startStr = timeMatch[1];
        const endStr = timeMatch[2];
        
        start = parseTime(startStr, targetDateStr);
        end = parseTime(endStr, targetDateStr);
        
        // Handle PM inference and crossovers
        if (start && end) {
            const startIsPM = startStr.toLowerCase().includes('pm');
            const endIsPM = endStr.toLowerCase().includes('pm');
            const startIsAM = startStr.toLowerCase().includes('am');
            const endIsAM = endStr.toLowerCase().includes('am');
            
            // Smart PM Inference: "3-4" -> "3pm-4pm"
            // If no AM/PM specified, and hours are low (1-6), usually PM for study context
            // Or if one has PM and other doesn't
            
            // Case: "3-4pm" -> start is 3, end is 16. 
            if (endIsPM && !startIsPM && !startIsAM) {
                if (start.getHours() < 12) {
                    // If start is smaller than end (adjusted), e.g. 3-4pm -> 3<16. 
                    // But raw 3 < 4. 
                    // If start < endRaw, likely same meridian.
                    // If start > endRaw, likely crossing noon (11-1pm).
                    
                    // Let's normalize raw hours first
                    const rawStartH = start.getHours();
                    const rawEndH = end.getHours() > 12 ? end.getHours() - 12 : end.getHours(); // 4pm is 16, raw 4
                    
                    if (rawStartH < 12) {
                         // If 3-4pm -> 15:00 - 16:00
                         start.setHours(start.getHours() + 12);
                    }
                }
            }

            // Case: "10-11" (Ambiguous, assume AM if morning, PM if night? Default to AM/24h logic)
            // However, if end < start, assume PM crossing or next day
            if (end < start) {
                // Try shifting end to PM if it was AM/Raw
                if (end.getHours() < 12 && !endIsAM) {
                    end.setHours(end.getHours() + 12);
                }
                // If still less, assume next day
                if (end < start) {
                    end.setDate(end.getDate() + 1);
                }
            }
        }
    } else if (durMatch) {
        // "Studied for 45 mins" -> Assume ended NOW, started X ago.
        // Unless "at 5pm for 45 mins" - complex parsing not implemented for simplicity.
        // We will assume relative to NOW if no start time found.
        
        const val = parseFloat(durMatch[1]);
        const isHours = durMatch[0].includes('hr') || durMatch[0].includes('hour');
        const minutes = isHours ? val * 60 : val;
        
        // If explicit start time mentioned? e.g. "5pm for 1 hour"
        // Check for single time
        const singleTimeRegex = /(\d{1,2}(?:[:.]\d{2})?(?:\s*[ap]m)?)\b/i;
        const singleTimeMatch = input.match(singleTimeRegex);
        
        if (singleTimeMatch) {
            start = parseTime(singleTimeMatch[1], targetDateStr);
            if (start) {
                // Handle PM inference for single time if needed (simple logic: < 7 -> +12)
                if (!singleTimeMatch[1].toLowerCase().match(/[ap]m/) && start.getHours() < 7) {
                    start.setHours(start.getHours() + 12);
                }
                end = new Date(start.getTime() + minutes * 60000);
            }
        } else {
            // Default: Ended Now
            end = new Date();
            if (targetDateStr !== todayStr) {
                // If yesterday, default to noon? Or fail?
                // Let's default to 12:00 PM on that day
                end = new Date(targetDateStr + 'T12:00:00');
            }
            start = new Date(end.getTime() - minutes * 60000);
        }
    }

    if (!start || !end) return null;

    let durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
    if (durationMinutes <= 0) durationMinutes = 30; // Fallback

    // 5. Cleanup Label
    // Remove recognized parts to leave the "activity description"
    let label = input;
    // We won't do aggressive stripping to keep context, just capitalize
    label = label.charAt(0).toUpperCase() + label.slice(1);

    return {
        date: targetDateStr,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        category,
        label,
        durationMinutes,
        pageNumber
    };
};
