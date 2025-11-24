import { DayPlan, Block, BlockTask, getAdjustedDate } from '../types';

const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Helper to convert 12-hour time with AM/PM to 24-hour HH:mm
const parse12HourTime = (timeStr: string): string => {
    const lower = timeStr.toLowerCase();
    const isPM = lower.includes('pm');
    let [h, m] = lower.replace(/[ap]m/g, '').trim().split(':').map(Number);
    
    if (isNaN(h) || isNaN(m)) return '00:00';

    if (isPM && h < 12) {
        h += 12;
    } else if (!isPM && h === 12) { // 12 AM is 00
        h = 0;
    }

    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const parseBlockTimeInMinutes = (timeStr: string): number => {
    try {
        // Handle 9.30 or 09:30
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
    if (h >= 24) h -= 24;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const getNextDate = (baseDate: string, daysToAdd: number): string => {
    const d = new Date(baseDate + 'T12:00:00');
    d.setDate(d.getDate() + daysToAdd);
    return getAdjustedDate(d);
};

export const parseSchedule = (text: string, startDate: string): DayPlan[] => {
    const plans: DayPlan[] = [];
    const lines = text.split('\n');

    // 1. REGEX FOR KEY-VALUE FORMAT
    // DAY=1; BLOCK=1; START_TIME="09:30 AM"; END_TIME="10:00 AM"; TYPE=VIDEO; VIDEO_TITLE="Title"; VIDEO_MIN_START=0; VIDEO_MIN_END=60; SPEED=2x
    const kvRegex = /DAY=(\d+);\s*BLOCK=(\d+);\s*START_TIME="([^"]+)";\s*END_TIME="([^"]+)";\s*TYPE=(VIDEO|REVISION);\s*VIDEO_TITLE="(.*?)";\s*VIDEO_MIN_START=(\d+);\s*VIDEO_MIN_END=(\d+);?(?:\s*SPEED=([\dx.]+))?/i;

    // 2. REGEX FOR TEXT BLOCKS
    // Matches: 09:00 - 09:30 -> Action Details
    const textBlockRegex = /^(\d{1,2}[:.]\d{2})\s*[-–—]\s*(\d{1,2}[:.]\d{2})\s*(?:[→\->]|=>)\s*(Watch|Revise|Final Revision|Review|Study|Read)\s+(.*?)(?:\s*\(?(?:Video:?)?\s*(\d+(?:[:.]\d+)?)\s*[-–—]\s*(\d+(?:[:.]\d+)?)\)?)?$/i;
    const dayHeaderRegex = /(?:✅|👉|🔹)?\s*DAY\s*[-–—]?\s*(\d+)/i;

    // Storage for KV parsing
    const kvBlocksByDay: Record<number, { blockNum: number, data: any }[]> = {};

    // Storage for Text parsing
    let currentDayOffset = 0;
    let currentBlocks: Block[] = [];
    let currentDayLabel = `Day 1`;
    
    const finalizeDay = (offset: number, label: string) => {
        if (currentBlocks.length === 0) return;

        const targetDate = getNextDate(startDate, offset);
        
        let totalStudy = 0;
        let totalBreak = 0;
        
        currentBlocks.forEach(b => {
            totalStudy += b.plannedDurationMinutes;
        });

        const plan: DayPlan = {
            date: targetDate,
            blocks: [...currentBlocks],
            startTimePlanned: currentBlocks[0].plannedStartTime,
            estimatedEndTime: currentBlocks[currentBlocks.length - 1].plannedEndTime,
            totalStudyMinutesPlanned: totalStudy,
            totalBreakMinutes: totalBreak,
            faPages: [], faPagesCount: 0, faStudyMinutesPlanned: 0,
            videos: [], anki: null, qbank: null,
            notesFromUser: "Auto-parsed Schedule",
            notesFromAI: `Schedule extracted for ${label}`,
            attachments: [], breaks: [],
            blockDurationSetting: 30
        };
        
        plans.push(plan);
        currentBlocks = [];
    };

    // --- PARSING LOOP ---
    let hasKvMatches = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        // A. Try Key-Value Parse
        const kvMatch = trimmed.match(kvRegex);
        if (kvMatch) {
            hasKvMatches = true;
            const dayNum = parseInt(kvMatch[1]);
            const blockNum = parseInt(kvMatch[2]);
            const startTime12h = kvMatch[3];
            const endTime12h = kvMatch[4];
            const typeRaw = kvMatch[5].toUpperCase();
            const title = kvMatch[6];
            const vStart = parseInt(kvMatch[7]);
            const vEnd = parseInt(kvMatch[8]);
            const speedStr = kvMatch[9]; // e.g. "2x" or "2"

            const startTime24 = parse12HourTime(startTime12h);
            const endTime24 = parse12HourTime(endTime12h);

            const startMins = parseBlockTimeInMinutes(startTime24);
            const endMins = parseBlockTimeInMinutes(endTime24);
            let duration = endMins - startMins;
            if (duration < 0) duration += 24 * 60; // Crosses midnight

            let speed = 1;
            if (speedStr) {
                speed = parseFloat(speedStr.replace('x', ''));
                if (isNaN(speed) || speed <= 0) speed = 1;
            }

            if (!kvBlocksByDay[dayNum]) kvBlocksByDay[dayNum] = [];
            
            kvBlocksByDay[dayNum].push({
                blockNum,
                data: {
                    startTime: startTime24,
                    endTime: endTime24,
                    plannedDurationMinutes: duration,
                    type: typeRaw === 'VIDEO' ? 'VIDEO' : 'REVISION_FA',
                    title: typeRaw === 'VIDEO' ? `Watch: ${title}` : `Revise: ${title}`,
                    description: typeRaw === 'VIDEO' ? `Video: ${vStart}-${vEnd}m @ ${speed}x` : `Revision of ${vStart}-${vEnd}m`,
                    vidStart: vStart,
                    vidEnd: vEnd,
                    playbackSpeed: typeRaw === 'VIDEO' ? speed : undefined,
                    rawTopic: title
                }
            });
            continue;
        }

        // B. Try Text Parse (if strict KV format not dominant yet)
        if (!hasKvMatches) {
            const dayMatch = trimmed.match(dayHeaderRegex);
            if (dayMatch) {
                const dayNum = parseInt(dayMatch[1]);
                if (currentBlocks.length > 0) finalizeDay(currentDayOffset, currentDayLabel);
                currentDayOffset = Math.max(0, dayNum - 1);
                currentDayLabel = `Day ${dayNum}`;
                continue;
            }

            const match = trimmed.match(textBlockRegex);
            if (match) {
                const [, startStr, endStr, action, detailsRaw, vidStartStr, vidEndStr] = match;
                const details = detailsRaw.trim();
                
                const startMins = parseBlockTimeInMinutes(startStr);
                const endMins = parseBlockTimeInMinutes(endStr);
                let duration = endMins - startMins;
                if (duration < 0) duration += 24 * 60;
                
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
                    index: currentBlocks.length,
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
                currentBlocks.push(block);
            }
        }
    }

    // --- CONSTRUCT KV PLANS ---
    if (hasKvMatches) {
        Object.keys(kvBlocksByDay).forEach(dayKey => {
            const dayNum = parseInt(dayKey);
            const rawBlocks = kvBlocksByDay[dayNum];
            
            // Sort by BLOCK number
            rawBlocks.sort((a,b) => a.blockNum - b.blockNum);

            const blocks: Block[] = [];

            rawBlocks.forEach((item, idx) => {
                const block: Block = {
                    id: generateId(),
                    index: idx,
                    date: getNextDate(startDate, dayNum - 1),
                    plannedStartTime: item.data.startTime,
                    plannedEndTime: item.data.endTime,
                    type: item.data.type,
                    title: item.data.title,
                    description: item.data.description,
                    plannedDurationMinutes: item.data.plannedDurationMinutes,
                    status: 'NOT_STARTED',
                    tasks: []
                };

                const task: BlockTask = {
                    id: generateId(),
                    type: item.data.type === 'VIDEO' ? 'VIDEO' : 'FA',
                    detail: item.data.rawTopic,
                    completed: false,
                    meta: {
                        topic: item.data.rawTopic,
                        videoStartTime: item.data.vidStart,
                        videoEndTime: item.data.vidEnd,
                        videoDuration: item.data.vidEnd - item.data.vidStart,
                        playbackSpeed: item.data.playbackSpeed || 1
                    }
                };
                block.tasks!.push(task);
                blocks.push(block);
            });

            // Create Plan
            const totalStudy = blocks.reduce((sum, b) => sum + b.plannedDurationMinutes, 0);
            const plan: DayPlan = {
                date: getNextDate(startDate, dayNum - 1),
                blocks: blocks,
                startTimePlanned: blocks.length > 0 ? blocks[0].plannedStartTime : '08:00',
                estimatedEndTime: blocks.length > 0 ? blocks[blocks.length - 1].plannedEndTime : '09:00',
                totalStudyMinutesPlanned: totalStudy,
                totalBreakMinutes: 0,
                faPages: [], faPagesCount: 0, faStudyMinutesPlanned: 0,
                videos: [], anki: null, qbank: null,
                notesFromUser: "Imported Schedule",
                notesFromAI: `Day ${dayNum} schedule parsed from structured data`,
                attachments: [], breaks: [], blockDurationSetting: 30
            };
            plans.push(plan);
        });
    } 
    else if (currentBlocks.length > 0) {
        // Finalize last text-parsed day
        finalizeDay(currentDayOffset, currentDayLabel);
    }

    return plans;
};
