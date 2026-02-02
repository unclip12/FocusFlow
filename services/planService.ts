
import { getDayPlan, saveDayPlan } from './firebase';
import { Block, DayPlan, BlockType, BlockTask, getAdjustedDate } from '../types';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

/**
 * Helper to get formatted time for logs
 */
const getFormattedTime = (): string => {
    return new Date().toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit', second: '2-digit'});
};

const parseTimeToMinutes = (timeStr: string): number => {
    try {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    } catch (e) {
        console.error("Failed to parse time:", timeStr);
        return 0;
    }
};

// Standard Minutes (00:00 is 0). 
const getStandardMinutes = (timeStr: string): number => {
    return parseTimeToMinutes(timeStr);
};

const formatTime = (minutes: number): string => {
    let h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    // Normalize 24h
    while (h >= 24) h -= 24;
    while (h < 0) h += 24;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const getNextDate = (dateStr: string): string => {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    return getAdjustedDate(d);
};

// --- AUTOMATED BACKLOG MIGRATION LOGIC ---

/**
 * Pushes backlog blocks to the TOP of the target date's schedule.
 * It inserts them BEFORE the earliest existing block.
 */
const pushBacklogToDate = async (targetDate: string, backlogBlocks: Block[]) => {
    if (backlogBlocks.length === 0) return;

    let plan = await getDayPlan(targetDate);
    
    // Initialize if empty
    if (!plan) {
        plan = {
            date: targetDate,
            blocks: [],
            startTimePlanned: '08:00',
            estimatedEndTime: '09:00',
            totalStudyMinutesPlanned: 0,
            totalBreakMinutes: 0,
            faPages: [], faPagesCount: 0, faStudyMinutesPlanned: 0,
            videos: [], anki: null, qbank: null, breaks: [],
            notesFromUser: 'Auto-generated for Backlog', notesFromAI: '', attachments: [], blockDurationSetting: 30
        };
    }

    const existingBlocks = plan.blocks || [];
    
    // 1. Prepare Backlog Blocks (Reset status, add Carry Over tag)
    const preparedBacklog = backlogBlocks.map(b => ({
        ...b,
        id: generateId(), // Regenerate ID to avoid conflicts if logic runs weirdly
        date: targetDate,
        status: 'NOT_STARTED' as const,
        // Clear execution data
        actualStartTime: undefined,
        actualEndTime: undefined,
        actualDurationMinutes: undefined,
        segments: [],
        interruptions: [],
        generatedLogIds: [],
        generatedTimeLogIds: [],
        // Tag Title
        title: b.title.includes('(Carry Over)') ? b.title : `(Carry Over) ${b.title}`,
        // Ensure tasks are reset too
        tasks: b.tasks?.map(t => ({ ...t, completed: false, execution: undefined }))
    }));

    // 2. Find Earliest Start Time in Today's Plan
    let earliestStartMins = 8 * 60; // Default 08:00 AM
    
    if (existingBlocks.length > 0) {
        const starts = existingBlocks.map(b => parseTimeToMinutes(b.plannedStartTime));
        earliestStartMins = Math.min(...starts);
        
        // If plan explicitly says start time is earlier (e.g. user set 7am but blocks start 8am), respect plan setting
        if (plan.startTimePlanned) {
            const planStartMins = parseTimeToMinutes(plan.startTimePlanned);
            if (planStartMins < earliestStartMins) earliestStartMins = planStartMins;
        }
    }

    // 3. Calculate New Start Time by stacking backlog backwards
    // We want the LAST backlog item to end at 'earliestStartMins'
    // So we stack them in reverse order of time from that anchor point.
    
    let currentCursorMins = earliestStartMins;
    const scheduledBacklog: Block[] = [];

    // Process in reverse so the first backlog item ends up at the earliest time
    // Actually, let's process forward but subtract total time first?
    // Better: Stack them backwards from the cursor.
    // Iterate backlog in reverse order (if they were chronological). 
    // But backlog order is usually arbitrary coming from 'incomplete'.
    // Let's just stack them sequentially backwards.
    
    for (let i = preparedBacklog.length - 1; i >= 0; i--) {
        const block = preparedBacklog[i];
        const duration = block.plannedDurationMinutes || 30;
        
        const endMins = currentCursorMins;
        const startMins = endMins - duration;
        
        scheduledBacklog.unshift({ // Add to front of array
            ...block,
            plannedStartTime: formatTime(startMins),
            plannedEndTime: formatTime(endMins)
        });
        
        currentCursorMins = startMins;
    }

    // 4. Merge: [New Backlog Blocks] + [Existing Blocks]
    // Since existing blocks weren't touched, their times are preserved.
    // Backlog blocks are now scheduled strictly BEFORE them.
    const finalBlocks = [...scheduledBacklog, ...existingBlocks];
    
    // 5. Update Plan Stats
    const updatedPlan = recalculatePlanStats(plan, finalBlocks);
    
    // Ensure plan start time reflects the new earlier start
    updatedPlan.startTimePlanned = formatTime(currentCursorMins);

    // 6. Save
    await saveDayPlan(updatedPlan);
};

/**
 * Main entry point to check and migrate tasks.
 * Checks specifically for tasks from the previous day that weren't done.
 */
export const checkAndMigrateOverdueTasks = async () => {
    const now = new Date();
    const currentHour = now.getHours();

    // Definition: Day changes at 04:00 AM for logical purposes.
    // If it's 2 AM on Tuesday, "Today" is still Monday.
    const logicalToday = new Date(now);
    if (currentHour < 4) {
        logicalToday.setDate(logicalToday.getDate() - 1);
    }
    
    // "Yesterday" is 1 day before Logical Today.
    const logicalYesterday = new Date(logicalToday);
    logicalYesterday.setDate(logicalYesterday.getDate() - 1); 

    const yesterdayStr = getAdjustedDate(logicalYesterday);
    const targetTodayStr = getAdjustedDate(logicalToday);

    // 1. Get Yesterday's Plan
    const yesterdaysPlan = await getDayPlan(yesterdayStr);
    
    if (!yesterdaysPlan || !yesterdaysPlan.blocks) return;

    // Identify strictly incomplete blocks
    const incompleteBlocks = yesterdaysPlan.blocks.filter(b => 
        b.status === 'NOT_STARTED' || 
        b.status === 'PAUSED' || 
        b.completionStatus === 'PARTIAL' || 
        b.completionStatus === 'NOT_DONE'
    );

    // If nothing to migrate, stop.
    if (incompleteBlocks.length === 0) return;

    console.log(`Found ${incompleteBlocks.length} incomplete blocks from ${yesterdayStr}. Moving to ${targetTodayStr} (Top of Schedule)...`);

    // 2. Clean up Yesterday (Remove incomplete blocks)
    // We remove them from yesterday so they don't exist in two places.
    // Note: This does NOT delete the original KnowledgeBaseEntry or Revision schedule.
    // It just moves the "ToDo Block" to the new day.
    const keptBlocks = yesterdaysPlan.blocks.filter(b => !incompleteBlocks.includes(b));
    const updatedYesterday = recalculatePlanStats(yesterdaysPlan, keptBlocks);
    await saveDayPlan(updatedYesterday);

    // 3. Push to Today
    // This function handles putting them at the top.
    await pushBacklogToDate(targetTodayStr, incompleteBlocks);
};


// --- EXISTING SERVICES BELOW ---

/**
 * Recalculates total study/break minutes based on blocks.
 */
const recalculatePlanStats = (plan: DayPlan, blocks: Block[]): DayPlan => {
    // Sort Chronologically (00:00 -> 23:59)
    const sortedBlocks = [...blocks].sort((a, b) => getStandardMinutes(a.plannedStartTime) - getStandardMinutes(b.plannedStartTime));
    
    // Re-index blocks based on new sort order
    sortedBlocks.forEach((b, idx) => {
        b.index = idx;
    });

    let totalStudy = 0;
    let totalBreak = 0;

    sortedBlocks.forEach(b => {
        if (b.type === 'BREAK') {
            totalBreak += b.plannedDurationMinutes;
        } else {
            // Strictly exclude BREAK types from study time
            totalStudy += b.plannedDurationMinutes;
        }
    });

    // Determine estimated end from the last block
    let newStart = plan.startTimePlanned;
    let newEnd = plan.estimatedEndTime;

    if (sortedBlocks.length > 0) {
        newStart = sortedBlocks[0].plannedStartTime;
        newEnd = sortedBlocks[sortedBlocks.length - 1].plannedEndTime;
    }

    return {
        ...plan,
        blocks: sortedBlocks,
        startTimePlanned: newStart,
        estimatedEndTime: newEnd,
        totalStudyMinutesPlanned: totalStudy,
        totalBreakMinutes: totalBreak
    };
};

/**
 * Shifts subsequent blocks. Detects if blocks are pushed past midnight (overflow).
 * Returns blocks that stay on current day and blocks that move to next day.
 */
const shiftScheduleWithOverflow = (blocks: Block[], startIndex: number, minutesToShift: number, currentDate: string): { currentDayBlocks: Block[], nextDayBlocks: Block[] } => {
    const currentDayBlocks: Block[] = [];
    const nextDayBlocks: Block[] = [];
    const nextDateStr = getNextDate(currentDate);

    // Add blocks before start index (they don't move)
    for(let i=0; i<=startIndex; i++) {
        currentDayBlocks.push(blocks[i]);
    }

    // Process blocks after start index
    for(let i=startIndex+1; i<blocks.length; i++) {
        const block = blocks[i];
        
        // Do not shift completed blocks or skipped ones
        if (block.status === 'DONE' || block.status === 'SKIPPED') {
            currentDayBlocks.push(block);
            continue;
        }

        const oldStart = parseTimeToMinutes(block.plannedStartTime);
        const oldEnd = parseTimeToMinutes(block.plannedEndTime);
        
        const newStartRaw = oldStart + minutesToShift;
        const newEndRaw = oldEnd + minutesToShift;

        // Check overflow (>= 1440 minutes means it goes to next day)
        if (newStartRaw >= 1440) {
            // Move to next day
            nextDayBlocks.push({
                ...block,
                date: nextDateStr,
                plannedStartTime: formatTime(newStartRaw), // formatTime handles modulo 1440
                plannedEndTime: formatTime(newEndRaw)
            });
        } else {
            // Stay in current day
            currentDayBlocks.push({
                ...block,
                plannedStartTime: formatTime(newStartRaw),
                plannedEndTime: formatTime(newEndRaw)
            });
        }
    }
    
    return { currentDayBlocks, nextDayBlocks };
};

/**
 * Helper to add moved blocks to the next day's plan
 */
const appendBlocksToNextDay = async (currentDate: string, blocksToAdd: Block[]) => {
    // We use pushBacklogToDate because it handles placing things at the START of the day,
    // which is safer for overflow (it becomes the first thing you do tomorrow).
    const nextDate = getNextDate(currentDate);
    await pushBacklogToDate(nextDate, blocksToAdd);
};


/**
 * Update a specific block in a day's plan.
 */
export const updateBlockInPlan = async (date: string, blockId: string, updates: Partial<Block>): Promise<DayPlan | null> => {
    try {
        const plan = await getDayPlan(date);
        if (!plan || !plan.blocks) {
            return null;
        }

        const nowTime = getFormattedTime();
        let blockFound = false;

        const tempBlocks = plan.blocks.map(b => {
            if (b.id === blockId) {
                blockFound = true;
                const updatedBlock = { ...b, ...updates };

                // Logic: Pause
                if (updates.status === 'PAUSED' && b.status === 'IN_PROGRESS') {
                    if (updatedBlock.segments && updatedBlock.segments.length > 0) {
                        const lastSeg = updatedBlock.segments[updatedBlock.segments.length - 1];
                        if (!lastSeg.end) lastSeg.end = nowTime; // Closes current segment
                    }
                    const interruptions = updatedBlock.interruptions ? [...updatedBlock.interruptions] : [];
                    const reason = updates.actualNotes?.startsWith('Paused:') ? updates.actualNotes.replace('Paused: ', '') : 'Paused';
                    interruptions.push({ start: nowTime, reason: reason });
                    updatedBlock.interruptions = interruptions;
                }

                return updatedBlock;
            }
            return b;
        });

        if (!blockFound) return null;

        const updatedPlan = recalculatePlanStats(plan, tempBlocks);
        await saveDayPlan(updatedPlan);
        return updatedPlan;

    } catch (e) {
        console.error("planService: updateBlockInPlan failed", e);
        throw e;
    }
};

/**
 * Start a virtual block.
 */
export const startVirtualBlock = async (date: string, block: Block): Promise<DayPlan | null> => {
    try {
        let plan = await getDayPlan(date);
        
        if (!plan) {
            plan = {
                date: date,
                blocks: [],
                startTimePlanned: block.plannedStartTime,
                estimatedEndTime: block.plannedEndTime,
                totalStudyMinutesPlanned: block.plannedDurationMinutes,
                totalBreakMinutes: 0,
                faPages: [], faPagesCount: 0, faStudyMinutesPlanned: 0,
                videos: [], anki: null, qbank: null, breaks: [],
                notesFromUser: '', notesFromAI: '', attachments: [], blockDurationSetting: 30
            };
        }

        const nowTime = getFormattedTime();
        
        const newBlock: Block = {
            ...block,
            index: 0, 
            status: 'IN_PROGRESS',
            actualStartTime: nowTime,
            segments: [{ start: nowTime }],
            isVirtual: false
        };

        let updatedBlocks = plan.blocks ? [...plan.blocks] : [];
        
        // Pause any currently running block
        updatedBlocks = updatedBlocks.map(b => {
            if (b.status === 'IN_PROGRESS') {
                 if (b.segments && b.segments.length > 0) {
                    const lastSeg = b.segments[b.segments.length - 1];
                    if (!lastSeg.end) lastSeg.end = nowTime;
                }
                const interruptions = b.interruptions ? [...b.interruptions] : [];
                interruptions.push({ start: nowTime, reason: 'Switched to revision task' });
                return { ...b, status: 'PAUSED', interruptions } as Block;
            }
            return b;
        });

        updatedBlocks.push(newBlock);
        
        const updatedPlan = recalculatePlanStats(plan, updatedBlocks);
        updatedPlan.startTimeActual = plan.startTimeActual || nowTime;

        await saveDayPlan(updatedPlan);
        return updatedPlan;

    } catch (e) {
        console.error("planService: startVirtualBlock failed", e);
        throw e;
    }
};

/**
 * Start or resume a block
 */
export const startBlock = async (date: string, blockId: string): Promise<DayPlan | null> => {
    try {
        const plan = await getDayPlan(date);
        if (!plan || !plan.blocks) return null;

        const nowTime = getFormattedTime();
        
        const tempBlocks = plan.blocks.map(b => {
            // Target block: Start it
            if (b.id === blockId) {
                const isResuming = b.status === 'PAUSED';
                const updatedBlock = { ...b, status: 'IN_PROGRESS' as const };
                
                if (isResuming) {
                    if (updatedBlock.interruptions && updatedBlock.interruptions.length > 0) {
                        const lastInt = updatedBlock.interruptions[updatedBlock.interruptions.length - 1];
                        if (!lastInt.end) lastInt.end = nowTime;
                    }
                } else { // First start
                    updatedBlock.actualStartTime = nowTime;
                }

                const segments = updatedBlock.segments ? [...updatedBlock.segments] : [];
                segments.push({ start: nowTime });
                updatedBlock.segments = segments;

                return updatedBlock;
            }
            
            // Pause others
            if (b.status === 'IN_PROGRESS' && b.id !== blockId) {
                 if (b.segments && b.segments.length > 0) {
                    const lastSeg = b.segments[b.segments.length - 1];
                    if (!lastSeg.end) lastSeg.end = nowTime;
                }
                const interruptions = b.interruptions ? [...b.interruptions] : [];
                interruptions.push({ start: nowTime, reason: 'Switched to new task' });
                return { ...b, status: 'PAUSED' as const, interruptions };
            }
            return b;
        });

        const updatedPlan = recalculatePlanStats(plan, tempBlocks);
        if (!updatedPlan.startTimeActual) updatedPlan.startTimeActual = nowTime;
        
        await saveDayPlan(updatedPlan);
        return updatedPlan;
    } catch (e) {
        console.error("planService: startBlock failed", e);
        throw e;
    }
};

/**
 * Finish a block
 */
export const finishBlock = async (
    date: string, 
    blockId: string, 
    reflection: {
        status: 'COMPLETED' | 'PARTIAL' | 'NOT_DONE',
        pagesCovered: number[],
        carryForwardPages: number[],
        notes: string,
        interruptions?: { start: string, end: string, reason: string }[],
        tasks?: BlockTask[],
        rescheduledTo?: string,
        generatedLogIds?: string[],
        generatedTimeLogIds?: string[]
    },
    endTimeStr?: string
): Promise<DayPlan | null> => {
    try {
        const plan = await getDayPlan(date);
        if (!plan || !plan.blocks) return null;

        const endTime = endTimeStr || new Date().toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit', second: '2-digit'});

        let currentBlocks = [...plan.blocks];
        const currentBlockIndex = currentBlocks.findIndex(b => b.id === blockId);
        if (currentBlockIndex === -1) return null;
        
        const b = currentBlocks[currentBlockIndex];
        
        // Close last segment
        let finalSegments = b.segments ? [...b.segments] : [];
        if (finalSegments.length > 0 && !finalSegments[finalSegments.length-1].end) {
            finalSegments[finalSegments.length-1].end = endTime;
        }
        
        let finalInterruptions = b.interruptions || [];
        if (reflection.interruptions) {
            finalInterruptions = [...finalInterruptions, ...reflection.interruptions];
        }
        
        // Effective Time Calculation
        let actualEffectiveMinutes = 0;
        
        if (b.type === 'BREAK') {
            const sTime = parseTimeToMinutes(b.actualStartTime || b.plannedStartTime);
            let eTime = parseTimeToMinutes(endTime);
            if (eTime < sTime) eTime += 24*60;
            actualEffectiveMinutes = eTime - sTime;
        } else {
            for (const segment of finalSegments) {
                if (segment.start && segment.end) {
                    const sTime = parseTimeToMinutes(segment.start);
                    let eTime = parseTimeToMinutes(segment.end);
                    if (isNaN(sTime) || isNaN(eTime)) continue;
                    if (eTime < sTime) eTime += 24*60;
                    actualEffectiveMinutes += (eTime - sTime);
                }
            }
        }

        // Calculate Overrun
        const plannedEndMins = parseTimeToMinutes(b.plannedEndTime);
        const actualEndMins = parseTimeToMinutes(endTime);
        let wallClockOverrun = actualEndMins - plannedEndMins;
        
        if (wallClockOverrun < -720) wallClockOverrun += 1440;
        if (wallClockOverrun > 720) wallClockOverrun -= 1440;

        currentBlocks[currentBlockIndex] = {
            ...b,
            status: 'DONE',
            actualEndTime: endTime,
            actualDurationMinutes: actualEffectiveMinutes,
            completionStatus: reflection.status,
            actualPagesCovered: reflection.pagesCovered,
            carryForwardPages: reflection.carryForwardPages,
            actualNotes: reflection.notes,
            segments: finalSegments,
            interruptions: finalInterruptions,
            tasks: reflection.tasks || b.tasks,
            rescheduledTo: reflection.rescheduledTo,
            generatedLogIds: reflection.generatedLogIds,
            generatedTimeLogIds: reflection.generatedTimeLogIds
        };

        // Shift subsequent blocks & Handle Overflow
        if (wallClockOverrun !== 0) {
            const { currentDayBlocks, nextDayBlocks } = shiftScheduleWithOverflow(currentBlocks, currentBlockIndex, wallClockOverrun, date);
            
            // Save current day
            const updatedPlan = recalculatePlanStats(plan, currentDayBlocks);
            await saveDayPlan(updatedPlan);

            // Move overflow blocks to next day
            if (nextDayBlocks.length > 0) {
                await appendBlocksToNextDay(date, nextDayBlocks);
            }
            
            return updatedPlan;
        } else {
            const updatedPlan = recalculatePlanStats(plan, currentBlocks);
            await saveDayPlan(updatedPlan);
            return updatedPlan;
        }

    } catch (e) {
        console.error("planService: finishBlock failed", e);
        throw e;
    }
};

/**
 * Inserts a new block and shifts subsequent blocks.
 * Handles overflow to next day.
 */
export const insertBlockAndShift = async (
    date: string, 
    startTimeStr: string, 
    durationMinutes: number, 
    tasks: BlockTask[],
    title: string = 'New Study Block',
    type: BlockType = 'MIXED',
    description: string = '',
    customId?: string,
    initialStatus: 'NOT_STARTED' | 'DONE' = 'NOT_STARTED',
    initialOverrides: Partial<Block> = {}
): Promise<DayPlan | null> => {
    try {
        let plan = await getDayPlan(date);
        
        if (!plan) {
             plan = {
                date: date,
                blocks: [],
                startTimePlanned: startTimeStr,
                estimatedEndTime: formatTime(parseTimeToMinutes(startTimeStr) + 60),
                totalStudyMinutesPlanned: 0,
                totalBreakMinutes: 0,
                faPages: [], faPagesCount: 0, faStudyMinutesPlanned: 0,
                videos: [], anki: null, qbank: null, breaks: [],
                notesFromUser: '', notesFromAI: '', attachments: [], blockDurationSetting: 30
            };
        }
        if (!plan.blocks) plan.blocks = [];

        const newBlockStart = parseTimeToMinutes(startTimeStr);
        const newBlockEnd = newBlockStart + durationMinutes;
        
        const newBlock: Block = {
            id: customId || generateId(),
            index: 0, // Will be recalculated
            date: date,
            plannedStartTime: formatTime(newBlockStart),
            plannedEndTime: formatTime(newBlockEnd),
            type: type,
            title: title,
            description: description || (type === 'BREAK' ? 'Break' : 'Manual Entry'),
            plannedDurationMinutes: durationMinutes,
            status: initialStatus,
            tasks: tasks,
            ...initialOverrides
        };

        const tempBlocks = [...plan.blocks, newBlock];
        
        // Sort first to find insertion point
        const sorted = tempBlocks.sort((a, b) => getStandardMinutes(a.plannedStartTime) - getStandardMinutes(b.plannedStartTime));
        const newBlockIndex = sorted.findIndex(b => b.id === newBlock.id);
        
        // Calculate necessary shift
        let shiftAmount = 0;
        if (newBlockIndex !== -1 && newBlockIndex < sorted.length - 1) {
            // Check if next block overlaps
            const nextBlock = sorted[newBlockIndex + 1];
            if (nextBlock.status !== 'DONE') {
                const nextStart = parseTimeToMinutes(nextBlock.plannedStartTime);
                const myEnd = parseTimeToMinutes(newBlock.plannedEndTime);
                if (nextStart < myEnd) {
                    shiftAmount = myEnd - nextStart;
                }
            }
        }

        if (shiftAmount > 0) {
            const { currentDayBlocks, nextDayBlocks } = shiftScheduleWithOverflow(sorted, newBlockIndex, shiftAmount, date);
            
            const updatedPlan = recalculatePlanStats(plan, currentDayBlocks);
            await saveDayPlan(updatedPlan);
            
            if (nextDayBlocks.length > 0) {
                await appendBlocksToNextDay(date, nextDayBlocks);
            }
            return updatedPlan;
        } else {
            const updatedPlan = recalculatePlanStats(plan, sorted);
            await saveDayPlan(updatedPlan);
            return updatedPlan;
        }

    } catch (e) {
        console.error("insertBlockAndShift failed", e);
        throw e;
    }
};

export const moveTasksToNextBlock = async (date: string, currentBlockId: string, tasksToMove: BlockTask[]): Promise<DayPlan | null> => {
    try {
        const plan = await getDayPlan(date);
        if (!plan || !plan.blocks) return null;

        const sortedBlocks = [...plan.blocks].sort((a, b) => getStandardMinutes(a.plannedStartTime) - getStandardMinutes(b.plannedStartTime));
        const currentSortedIdx = sortedBlocks.findIndex(b => b.id === currentBlockId);
        
        const nextBlock = sortedBlocks.find((b, i) => i > currentSortedIdx && b.status !== 'DONE' && b.type !== 'BREAK');
        
        if (nextBlock) {
            const updatedBlocks = plan.blocks.map(b => {
                if (b.id === nextBlock.id) {
                    return {
                        ...b,
                        tasks: [...(b.tasks || []), ...tasksToMove],
                        title: b.title + (b.title.includes('Carried') ? '' : ' + Carried Tasks')
                    };
                }
                return b;
            });
            
            const updatedPlan = recalculatePlanStats(plan, updatedBlocks);
            await saveDayPlan(updatedPlan);
            return updatedPlan;
        } else {
            return null;
        }

    } catch (e) {
        console.error("moveTasksToNextBlock failed", e);
        throw e;
    }
};

export const moveTasksToFuturePlan = async (sourceDate: string, targetDate: string, tasksToMove: BlockTask[]): Promise<void> => {
    try {
        let targetPlan = await getDayPlan(targetDate);
        
        if (!targetPlan) {
            targetPlan = {
                date: targetDate,
                blocks: [],
                startTimePlanned: '08:00',
                estimatedEndTime: '09:00',
                totalStudyMinutesPlanned: 60,
                totalBreakMinutes: 0,
                faPages: [], faPagesCount: 0, faStudyMinutesPlanned: 0,
                videos: [], anki: null, qbank: null, breaks: [],
                notesFromUser: '', notesFromAI: '', attachments: [], blockDurationSetting: 30
            };
        }

        let newStartTime = '08:00';
        if (targetPlan.blocks && targetPlan.blocks.length > 0) {
            const lastBlock = [...targetPlan.blocks].sort((a,b) => getStandardMinutes(a.plannedStartTime) - getStandardMinutes(b.plannedStartTime)).pop();
            if(lastBlock) newStartTime = lastBlock.plannedEndTime;
        }
        
        const newStartMins = parseTimeToMinutes(newStartTime);
        const newEndMins = newStartMins + 60;
        
        const newBlock: Block = {
            id: generateId(),
            index: 0,
            date: targetDate,
            plannedStartTime: formatTime(newStartMins),
            plannedEndTime: formatTime(newEndMins),
            type: 'MIXED',
            title: 'Rescheduled Tasks',
            description: `Moved from ${sourceDate}`,
            plannedDurationMinutes: 60,
            status: 'NOT_STARTED',
            tasks: tasksToMove
        };

        const updatedBlocks = [...(targetPlan.blocks || []), newBlock];
        
        const updatedTargetPlan = recalculatePlanStats(targetPlan, updatedBlocks);

        await saveDayPlan(updatedTargetPlan);

    } catch (e) {
        console.error("moveTasksToFuturePlan failed", e);
        throw e;
    }
};

export const deleteBlock = async (date: string, blockId: string): Promise<DayPlan | null> => {
    try {
        const plan = await getDayPlan(date);
        if (!plan || !plan.blocks) return null;

        const updatedBlocks = plan.blocks.filter(b => b.id !== blockId);
        
        const updatedPlan = recalculatePlanStats(plan, updatedBlocks);
        
        await saveDayPlan(updatedPlan);
        return updatedPlan;
    } catch (e) {
        console.error("deleteBlock failed", e);
        throw e;
    }
};
