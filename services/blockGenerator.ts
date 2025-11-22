
import { DayPlan, Block, BlockType } from '../types';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

const parseTime = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

const formatTime = (minutes: number): string => {
    let h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h >= 24) h -= 24;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export const generateBlocks = (plan: DayPlan, blockDurationMinutes: number = 30): Block[] => {
    const blocks: Block[] = [];
    
    // 1. Determine Start Time
    let currentTime = parseTime(plan.startTimeActual || plan.startTimePlanned || "08:00");
    
    // 2. Prepare Queues
    
    // Video Queue: Split videos into chunks
    const videoQueue: { title: string, desc: string, id?: string, type: BlockType }[] = [];
    const faQueue: { title: string, desc: string, pages: number[] }[] = [];

    plan.videos.forEach((video, idx) => {
        const duration = Math.round(video.effectiveStudyMinutes);
        const chunks = Math.ceil(duration / blockDurationMinutes);
        
        for (let i = 0; i < chunks; i++) {
            videoQueue.push({
                title: `Watch: ${video.topic || video.subject} (${i + 1}/${chunks})`,
                desc: `${video.subject}`,
                type: 'VIDEO'
            });
            
            // Interleave FA Revision logic: 1 Video Block -> 1 FA Block opportunity
            // Distribute pages roughly
            if (plan.faPages && plan.faPages.length > 0) {
                const pagesPerChunk = Math.ceil(plan.faPages.length / Math.max(1, plan.videos.length * chunks)); // rough distribution
                // For simplicity, just add a generic revision block that we will populate
                faQueue.push({
                   title: `Revise FA: ${video.topic || 'Related Pages'}`,
                   desc: `Consolidate video concepts`,
                   pages: [] // Will be populated if we implement strict mapping, else generic
                });
            }
        }
    });

    // distribute FA pages into FA queue
    if (plan.faPages && faQueue.length > 0) {
        const pages = [...plan.faPages];
        let qIdx = 0;
        while (pages.length > 0) {
            const p = pages.shift();
            if (p) faQueue[qIdx % faQueue.length].pages.push(p);
            qIdx++;
        }
    }

    // QBank & Anki Queues
    const practiceQueue: { title: string, desc: string, type: BlockType, qCount?: number, cardCount?: number }[] = [];
    
    if (plan.qbank) {
        const chunks = Math.ceil(plan.qbank.plannedMinutes / blockDurationMinutes);
        const qPerChunk = Math.ceil(plan.qbank.totalQuestions / chunks);
        for (let i = 0; i < chunks; i++) {
            practiceQueue.push({
                title: `QBank Practice (${i+1}/${chunks})`,
                desc: `Target: ~${qPerChunk} questions`,
                type: 'QBANK',
                qCount: qPerChunk
            });
        }
    }

    if (plan.anki) {
        const chunks = Math.ceil(plan.anki.plannedMinutes / blockDurationMinutes);
        const cPerChunk = Math.ceil(plan.anki.totalCards / chunks);
        for (let i = 0; i < chunks; i++) {
            practiceQueue.push({
                title: `Anki Flashcards (${i+1}/${chunks})`,
                desc: `Target: ~${cPerChunk} cards`,
                type: 'ANKI',
                cardCount: cPerChunk
            });
        }
    }

    // 3. Interleave Logic
    // Pattern: Video -> FA -> Video -> FA ... then Practice
    const mainStudyQueue: typeof videoQueue = [];
    
    let vIdx = 0;
    let fIdx = 0;
    
    // Interleave Video & FA
    while (vIdx < videoQueue.length || fIdx < faQueue.length) {
        if (vIdx < videoQueue.length) {
            mainStudyQueue.push(videoQueue[vIdx++]);
        }
        if (fIdx < faQueue.length) {
            const faItem = faQueue[fIdx++];
            mainStudyQueue.push({
                ...faItem,
                desc: faItem.pages.length > 0 ? `Pages: ${faItem.pages.join(', ')}` : faItem.desc,
                type: 'REVISION_FA'
            });
        }
    }

    // Merge Practice at the end (or start if no videos)
    const finalQueue = [...mainStudyQueue, ...practiceQueue];

    // 4. Generate Blocks with Breaks
    let blockIndex = 0;
    
    // Sort breaks by time
    const sortedBreaks = [...plan.breaks].sort((a, b) => {
        if (!a.startTime || !b.startTime) return 0;
        return parseTime(a.startTime) - parseTime(b.startTime);
    });

    let queuePtr = 0;

    // Safety limit to prevent infinite loops
    const MAX_BLOCKS = 50; 

    while (queuePtr < finalQueue.length && blocks.length < MAX_BLOCKS) {
        const start = currentTime;
        const end = currentTime + blockDurationMinutes;
        
        // Check for Break Intersection
        const conflictingBreak = sortedBreaks.find(b => {
            if (!b.startTime || !b.endTime) return false;
            const bStart = parseTime(b.startTime);
            // If break starts within this block or this block overlaps start of break
            return (bStart >= start && bStart < end);
        });

        if (conflictingBreak && conflictingBreak.startTime && conflictingBreak.endTime) {
            const bStart = parseTime(conflictingBreak.startTime);
            const bEnd = parseTime(conflictingBreak.endTime);
            
            if (bStart > start) {
                 // Just jump to break for now
            }
            
            blocks.push({
                id: generateId(),
                index: blockIndex++,
                date: plan.date,
                plannedStartTime: formatTime(bStart),
                plannedEndTime: formatTime(bEnd),
                type: 'BREAK',
                title: conflictingBreak.label,
                description: 'Scheduled Break',
                plannedDurationMinutes: bEnd - bStart,
                status: 'NOT_STARTED'
            });
            
            currentTime = bEnd;
            continue; // Loop again with new currentTime
        }

        // Add Study Block
        const item = finalQueue[queuePtr++];
        
        const block: Block = {
            id: generateId(),
            index: blockIndex++,
            date: plan.date,
            plannedStartTime: formatTime(start),
            plannedEndTime: formatTime(end),
            type: item.type,
            title: item.title,
            description: item.desc,
            plannedDurationMinutes: blockDurationMinutes,
            status: 'NOT_STARTED'
        };

        // Only assign if defined to avoid 'undefined' values for Firestore
        if ((item as any).qCount) {
            block.relatedQbankInfo = { totalQuestions: (item as any).qCount };
        }
        if ((item as any).cardCount) {
            block.relatedAnkiInfo = { totalCards: (item as any).cardCount };
        }
        if ((item as any).pages) {
            block.relatedFaPages = (item as any).pages;
        }
        
        blocks.push(block);

        currentTime = end;
    }
    
    // Add remaining breaks that might be after all study
    sortedBreaks.forEach(b => {
        if (!b.startTime || !b.endTime) return;
        const bStart = parseTime(b.startTime);
        if (bStart >= currentTime) {
             blocks.push({
                id: generateId(),
                index: blockIndex++,
                date: plan.date,
                plannedStartTime: formatTime(bStart),
                plannedEndTime: formatTime(parseTime(b.endTime)),
                type: 'BREAK',
                title: b.label,
                description: 'Scheduled Break',
                plannedDurationMinutes: parseTime(b.endTime) - bStart,
                status: 'NOT_STARTED'
            });
        }
    });

    return blocks.sort((a,b) => parseTime(a.plannedStartTime) - parseTime(b.plannedStartTime));
};
