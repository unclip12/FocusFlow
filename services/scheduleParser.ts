
import { DayPlan, Block, BlockTask, getAdjustedDate } from '../types';

const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Improved helper to parse time strictly
const parse12HourTimeStrict = (timeStr: string): string => {
    if (!timeStr) return '00:00';
    const lower = timeStr.toLowerCase().trim();
    const isPM = lower.includes('pm');
    const isAM = lower.includes('am');
    
    let clean = lower.replace(/[ap]m/g, '').trim();
    let [h, m] = clean.split(/[:.]/).map(Number);
    if (isNaN(m)) m = 0;
    if (isNaN(h)) return '00:00';

    if (isPM && h < 12) {
        h += 12;
    } else if (isAM && h === 12) { // 12 AM is 00
        h = 0;
    } else if (!isPM && !isAM && h === 24) {
        h = 0; 
    }

    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const parseBlockTimeInMinutes = (timeStr: string): number => {
    try {
        const [h, m] = timeStr.split(/[:.]/).map(Number);
        return h * 60 + m;
    } catch (e) {
        return 0;
    }
};

// Robust parser for video timestamps like "60:00", "1:20:00", "120"
const parseVideoTimeInMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.trim().split(/[:.]/).map(Number);
    
    if (parts.length === 3) { // H:M:S
        return Math.round(parts[0] * 60 + parts[1] + parts[2] / 60);
    }
    if (parts.length === 2) { 
        return parts[0] + parts[1] / 60;
    }
    if (parts.length === 1) { // just minutes
        return parts[0];
    }
    return 0; 
};

const formatTime = (minutes: number): string => {
    let h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    // Normalize
    while (h >= 24) h -= 24;
    while (h < 0) h += 24;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const getNextDate = (baseDate: string, daysToAdd: number): string => {
    // Parse base date strictly as YYYY-MM-DD to avoid timezone offset
    const [y, m, d] = baseDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + daysToAdd);
    return getAdjustedDate(date);
};

export const parseSchedule = (text: string, startDate: string): DayPlan[] => {
    const plans: DayPlan[] = [];
    const lines = text.split('\n');

    // 1. REGEX FOR KEY-VALUE FORMAT
    const kvRegex = /(?:DATE=([\d-]+);\s*)?DAY=(\d+);\s*BLOCK=(\d+);\s*START_TIME="([^"]+)";\s*END_TIME="([^"]+)";\s*TYPE=(VIDEO|REVISION|BREAK);\s*VIDEO_TITLE="(.*?)";\s*VIDEO_MIN_START=(\d+);\s*VIDEO_MIN_END=(\d+);?(?:\s*SPEED=([\dx.]+))?/i;

    // 2. REGEX FOR BREAKS (Comment style: # Lunch Break 01:15 – 02:15 PM)
    const breakRegex = /^#\s*(.*?)\s+(\d{1,2}[:.]\d{2}(?:\s*[ap]m)?)\s*[-–—]\s*(\d{1,2}[:.]\d{2}(?:\s*[ap]m)?)/i;

    // 3. REGEX FOR LEGACY TEXT BLOCKS
    const textBlockRegex = /^(\d{1,2}[:.]\d{2}(?:\s*[ap]m)?)\s*[-–—]\s*(\d{1,2}[:.]\d{2}(?:\s*[ap]m)?)\s*(?:[→\->]|=>)?\s*(Watch|Revise|Final Revision|Review|Study|Read)?\s*(.*?)(?:\s*\(?(?:Video:?)?\s*(\d+(?:[:.]\d+)?)\s*[-–—]\s*(\d+(?:[:.]\d+)?)\)?)?$/i;
    const dayHeaderRegex = /(?:✅|👉|🔹)?\s*DAY\s*[-–—]?\s*(\d+)/i;

    // STORAGE FOR GROUPS
    // Key: "YYYY-MM-DD" (Explicit) OR "DAY_X" (Implicit relative)
    const groups: Record<string, { 
        date: string, 
        blocks: Block[]
    }> = {};

    let lastGroupKey: string | null = null;
    let hasKvMatches = false;

    // --- LEGACY PARSING STATE ---
    let currentDayOffset = 0;
    let currentLegacyBlocks: Block[] = [];
    let currentDayLabel = `Day 1`;

    const finalizeLegacyDay = (offset: number, label: string) => {
        if (currentLegacyBlocks.length === 0) return;
        const targetDate = getNextDate(startDate, offset);
        const totalStudy = currentLegacyBlocks.reduce((acc, b) => acc + b.plannedDurationMinutes, 0);
        plans.push({
            date: targetDate,
            blocks: [...currentLegacyBlocks],
            startTimePlanned: currentLegacyBlocks[0].plannedStartTime,
            estimatedEndTime: currentLegacyBlocks[currentLegacyBlocks.length - 1].plannedEndTime,
            totalStudyMinutesPlanned: totalStudy,
            totalBreakMinutes: 0,
            faPages: [], faPagesCount: 0, faStudyMinutesPlanned: 0,
            videos: [], anki: null, qbank: null,
            notesFromUser: "Auto-parsed Schedule",
            notesFromAI: `Schedule extracted for ${label}`,
            attachments: [], breaks: [], blockDurationSetting: 30
        });
        currentLegacyBlocks = [];
    };

    // --- MAIN PARSE LOOP ---
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // CHECK KV MATCH
        const kvMatch = trimmed.match(kvRegex);
        if (kvMatch) {
            hasKvMatches = true;
            
            const explicitDate = kvMatch[1];
            const dayNum = parseInt(kvMatch[2]);
            const blockNum = parseInt(kvMatch[3]);
            const startTime12h = kvMatch[4];
            const endTime12h = kvMatch[5];
            const typeRaw = kvMatch[6].toUpperCase();
            const title = kvMatch[7];
            const vStart = parseInt(kvMatch[8]);
            const vEnd = parseInt(kvMatch[9]);
            const speedStr = kvMatch[10];

            const startTime24 = parse12HourTimeStrict(startTime12h);
            const endTime24 = parse12HourTimeStrict(endTime12h);

            const startMins = parseBlockTimeInMinutes(startTime24);
            let endMins = parseBlockTimeInMinutes(endTime24);
            if (endMins < startMins) endMins += 24 * 60; // Wrap
            
            const duration = endMins - startMins;

            let speed = 1;
            if (speedStr) {
                speed = parseFloat(speedStr.replace('x', ''));
                if (isNaN(speed) || speed <= 0) speed = 1;
            }

            // Determine Group Key
            let groupKey = '';
            let planDate = '';

            if (explicitDate) {
                groupKey = explicitDate;
                planDate = explicitDate;
            } else {
                groupKey = `DAY_${dayNum}`;
                planDate = getNextDate(startDate, dayNum - 1);
            }

            if (!groups[groupKey]) {
                groups[groupKey] = { date: planDate, blocks: [] };
            }
            lastGroupKey = groupKey;

            const block: Block = {
                id: generateId(),
                index: blockNum, // Temp index, will resort
                date: planDate,
                plannedStartTime: startTime24,
                plannedEndTime: endTime24,
                type: typeRaw === 'VIDEO' ? 'VIDEO' : 'REVISION_FA',
                title: typeRaw === 'VIDEO' ? `Watch: ${title}` : `Revise: ${title}`,
                description: typeRaw === 'VIDEO' ? `Video: ${vStart}-${vEnd}m @ ${speed}x` : `Revision of ${vStart}-${vEnd}m`,
                plannedDurationMinutes: duration,
                status: 'NOT_STARTED',
                tasks: []
            };

            const task: BlockTask = {
                id: generateId(),
                type: typeRaw === 'VIDEO' ? 'VIDEO' : 'FA',
                detail: title,
                completed: false,
                meta: {
                    topic: title,
                    videoStartTime: vStart,
                    videoEndTime: vEnd,
                    videoDuration: vEnd - vStart,
                    playbackSpeed: typeRaw === 'VIDEO' ? speed : undefined
                }
            };
            block.tasks = [task];
            
            groups[groupKey].blocks.push(block);
            continue;
        }

        // CHECK BREAK MATCH (Lines starting with #)
        if (trimmed.startsWith('#')) {
            const breakMatch = trimmed.match(breakRegex);
            // Only process breaks if we have an active group context (to assign date)
            if (breakMatch && lastGroupKey && groups[lastGroupKey]) {
                const label = breakMatch[1] || "Break";
                const startStr = breakMatch[2];
                const endStr = breakMatch[3];
                
                const bStart24 = parse12HourTimeStrict(startStr);
                const bEnd24 = parse12HourTimeStrict(endStr);
                const sMins = parseBlockTimeInMinutes(bStart24);
                let eMins = parseBlockTimeInMinutes(bEnd24);
                if (eMins < sMins) eMins += 24 * 60;
                
                const duration = eMins - sMins;

                const breakBlock: Block = {
                    id: generateId(),
                    index: 999, // Sort will handle
                    date: groups[lastGroupKey].date,
                    plannedStartTime: bStart24,
                    plannedEndTime: bEnd24,
                    type: 'BREAK',
                    title: label,
                    description: 'Scheduled Break',
                    plannedDurationMinutes: duration,
                    status: 'NOT_STARTED',
                    tasks: []
                };
                
                groups[lastGroupKey].blocks.push(breakBlock);
            }
            continue;
        }

        // LEGACY TEXT MATCH (Only if no KV matches found yet to avoid mixing)
        if (!hasKvMatches) {
            const dayMatch = trimmed.match(dayHeaderRegex);
            if (dayMatch) {
                const dayNum = parseInt(dayMatch[1]);
                if (currentLegacyBlocks.length > 0) finalizeLegacyDay(currentDayOffset, currentDayLabel);
                currentDayOffset = Math.max(0, dayNum - 1);
                currentDayLabel = `Day ${dayNum}`;
                continue;
            }

            const match = trimmed.match(textBlockRegex);
            if (match) {
                const [, startStr, endStr, actionRaw, detailsRaw, vidStartStr, vidEndStr] = match;
                const details = detailsRaw ? detailsRaw.trim() : "Study Task";
                const action = actionRaw || "Study";
                
                let startMins = parseBlockTimeInMinutes(parse12HourTimeStrict(startStr));
                let endMins = parseBlockTimeInMinutes(parse12HourTimeStrict(endStr));
                
                if (endMins < startMins) endMins += 24 * 60;
                let duration = endMins - startMins;
                if (duration <= 0) continue;

                let playbackSpeed = 1;
                let vidStart = 0;
                let vidEnd = 0;
                let hasVideoMeta = false;

                if (vidStartStr && vidEndStr) {
                    vidStart = parseVideoTimeInMinutes(vidStartStr);
                    vidEnd = parseVideoTimeInMinutes(vidEndStr);
                    const vidContentDuration = vidEnd - vidStart;
                    if (vidContentDuration > 0 && duration > 0) {
                        const rawSpeed = vidContentDuration / duration;
                        playbackSpeed = Math.round(rawSpeed * 4) / 4;
                        hasVideoMeta = true;
                    }
                }

                const isRevision = action.toLowerCase().includes('revise') || action.toLowerCase().includes('review');
                const type = action.toLowerCase().includes('watch') ? 'VIDEO' : (isRevision ? 'REVISION_FA' : 'MIXED');

                const block: Block = {
                    id: generateId(),
                    index: currentLegacyBlocks.length,
                    date: getNextDate(startDate, currentDayOffset),
                    plannedStartTime: formatTime(startMins),
                    plannedEndTime: formatTime(endMins),
                    type: type,
                    title: `${action} ${details}`,
                    description: hasVideoMeta ? `Speed: ${playbackSpeed}x` : '',
                    plannedDurationMinutes: duration,
                    status: 'NOT_STARTED',
                    tasks: []
                };

                const task: BlockTask = {
                    id: generateId(),
                    type: type === 'VIDEO' ? 'VIDEO' : 'FA',
                    detail: details,
                    completed: false,
                    meta: { topic: details }
                };

                if (hasVideoMeta) {
                    task.meta!.videoStartTime = vidStart;
                    task.meta!.videoEndTime = vidEnd;
                    task.meta!.videoDuration = vidEnd - vidStart;
                    task.meta!.playbackSpeed = playbackSpeed;
                    if (playbackSpeed !== 1) task.detail += ` (@ ${playbackSpeed}x)`;
                }

                block.tasks!.push(task);
                currentLegacyBlocks.push(block);
            }
        }
    }

    // --- FINALIZE KV GROUPS ---
    if (hasKvMatches) {
        Object.values(groups).forEach(group => {
            const blocks = group.blocks;
            // Sort by start time
            blocks.sort((a, b) => parseBlockTimeInMinutes(a.plannedStartTime) - parseBlockTimeInMinutes(b.plannedStartTime));
            
            // Re-index
            blocks.forEach((b, i) => b.index = i);

            const totalStudy = blocks.reduce((sum, b) => b.type !== 'BREAK' ? sum + b.plannedDurationMinutes : sum, 0);
            const totalBreak = blocks.reduce((sum, b) => b.type === 'BREAK' ? sum + b.plannedDurationMinutes : sum, 0);

            const plan: DayPlan = {
                date: group.date,
                blocks: blocks,
                startTimePlanned: blocks.length > 0 ? blocks[0].plannedStartTime : '08:00',
                estimatedEndTime: blocks.length > 0 ? blocks[blocks.length - 1].plannedEndTime : '09:00',
                totalStudyMinutesPlanned: totalStudy,
                totalBreakMinutes: totalBreak,
                faPages: [], faPagesCount: 0, faStudyMinutesPlanned: 0,
                videos: [], anki: null, qbank: null,
                notesFromUser: "Imported Schedule",
                notesFromAI: `Schedule parsed from structured data`,
                attachments: [], breaks: [], blockDurationSetting: 30
            };
            plans.push(plan);
        });
    } 
    else if (currentLegacyBlocks.length > 0) {
        finalizeLegacyDay(currentDayOffset, currentDayLabel);
    }

    return plans;
};
