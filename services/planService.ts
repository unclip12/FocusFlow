
import { getDayPlan, saveDayPlan } from './firebase';
import { Block, DayPlan, BlockTask } from '../types';

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

const formatTime = (minutes: number): string => {
    let h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h >= 24) h -= 24;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

/**
 * Shift subsequent blocks if a block runs overtime.
 */
const shiftSchedule = (blocks: Block[], startIndex: number, minutesToShift: number): Block[] => {
    // Only shift if minutes > 0
    if (minutesToShift <= 0) return blocks;

    const updatedBlocks = [...blocks];
    
    // Iterate through all blocks AFTER the finished one
    for (let i = startIndex + 1; i < updatedBlocks.length; i++) {
        const block = updatedBlocks[i];
        // Do not shift completed blocks or skipped ones (logic choice: shift everything pending)
        if (block.status === 'DONE' || block.status === 'SKIPPED') continue;

        const oldStart = parseTimeToMinutes(block.plannedStartTime);
        const oldEnd = parseTimeToMinutes(block.plannedEndTime);
        
        const newStart = oldStart + minutesToShift;
        const newEnd = oldEnd + minutesToShift;

        updatedBlocks[i] = {
            ...block,
            plannedStartTime: formatTime(newStart),
            plannedEndTime: formatTime(newEnd)
        };
    }
    return updatedBlocks;
};


/**
 * Update a specific block in a day's plan.
 * Used for generic updates like pausing.
 */
export const updateBlockInPlan = async (date: string, blockId: string, updates: Partial<Block>): Promise<DayPlan | null> => {
    try {
        const plan = await getDayPlan(date);
        if (!plan || !plan.blocks) {
            console.warn(`Plan not found for date: ${date}`);
            return null;
        }

        const nowTime = getFormattedTime();
        let blockFound = false;

        const updatedBlocks = plan.blocks.map(b => {
            if (b.id === blockId) {
                blockFound = true;
                const updatedBlock = { ...b, ...updates };

                // Logic: Pause
                if (updates.status === 'PAUSED' && b.status === 'IN_PROGRESS') {
                    if (updatedBlock.segments && updatedBlock.segments.length > 0) {
                        const lastSeg = updatedBlock.segments[updatedBlock.segments.length - 1];
                        if (!lastSeg.end) lastSeg.end = nowTime;
                    }
                    const interruptions = updatedBlock.interruptions ? [...updatedBlock.interruptions] : [];
                    interruptions.push({ start: nowTime, reason: updates.actualNotes?.replace('Paused: ', '') || 'User paused' });
                    updatedBlock.interruptions = interruptions;
                }

                return updatedBlock;
            }
            return b;
        });

        if (!blockFound) {
            console.warn(`Block ${blockId} not found in plan for ${date}`);
            return null;
        }

        // Ensure chronological order
        updatedBlocks.sort((a, b) => parseTimeToMinutes(a.plannedStartTime) - parseTimeToMinutes(b.plannedStartTime));

        const updatedPlan = { ...plan, blocks: updatedBlocks };
        await saveDayPlan(updatedPlan);
        return updatedPlan;

    } catch (e) {
        console.error("planService: updateBlockInPlan failed", e);
        throw e;
    }
};

/**
 * Start a virtual block (one that exists in UI but not DB yet).
 * This materializes it into the DB and starts it.
 */
export const startVirtualBlock = async (date: string, block: Block): Promise<DayPlan | null> => {
    try {
        let plan = await getDayPlan(date);
        
        // If plan doesn't exist, create skeleton
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
        
        // Prepare the new block (remove virtual flag)
        const newBlock: Block = {
            ...block,
            status: 'IN_PROGRESS',
            actualStartTime: nowTime,
            segments: [{ start: nowTime }],
            isVirtual: false // Materialize
        };

        // Insert into blocks
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
        updatedBlocks.sort((a, b) => parseTimeToMinutes(a.plannedStartTime) - parseTimeToMinutes(b.plannedStartTime));
        updatedBlocks.forEach((b, i) => b.index = i);

        const updatedPlan = { ...plan, blocks: updatedBlocks, startTimeActual: plan.startTimeActual || nowTime };
        await saveDayPlan(updatedPlan);
        return updatedPlan;

    } catch (e) {
        console.error("planService: startVirtualBlock failed", e);
        throw e;
    }
};

/**
 * Start or resume a block (and pause any other active blocks)
 */
export const startBlock = async (date: string, blockId: string): Promise<DayPlan | null> => {
    try {
        const plan = await getDayPlan(date);
        if (!plan || !plan.blocks) return null;

        const nowTime = getFormattedTime();
        
        const updatedBlocks = plan.blocks.map(b => {
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
            
            // If another block is running, pause it automatically
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

        // Ensure chronological order
        updatedBlocks.sort((a, b) => parseTimeToMinutes(a.plannedStartTime) - parseTimeToMinutes(b.plannedStartTime));

        const updatedPlan = { ...plan, blocks: updatedBlocks, startTimeActual: plan.startTimeActual || nowTime };
        await saveDayPlan(updatedPlan);
        return updatedPlan;
    } catch (e) {
        console.error("planService: startBlock failed", e);
        throw e;
    }
};

/**
 * Finish a block with granular task updates.
 * Automatically shifts future blocks if time overrun occurs.
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
        tasks?: BlockTask[], // Updated tasks with execution status
        rescheduledTo?: string // The time or context where tasks were pushed
    }
): Promise<DayPlan | null> => {
    try {
        const plan = await getDayPlan(date);
        if (!plan || !plan.blocks) return null;

        const now = new Date();
        const endTime = now.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit', second: '2-digit'});

        let updatedBlocks = [...plan.blocks];
        const currentBlockIndex = updatedBlocks.findIndex(b => b.id === blockId);
        if (currentBlockIndex === -1) return null;
        
        const b = updatedBlocks[currentBlockIndex];
        
        // Close last segment if open
        let finalSegments = b.segments ? [...b.segments] : [];
        if (finalSegments.length > 0 && !finalSegments[finalSegments.length-1].end) {
            finalSegments[finalSegments.length-1].end = endTime;
        }
        
        // Merge AI-identified breaks
        let finalInterruptions = b.interruptions || [];
        if (reflection.interruptions) {
            finalInterruptions = [...finalInterruptions, ...reflection.interruptions];
        }
        
        // Calculate actual total duration
        let actualDurationMinutes = 0;
        if (b.actualStartTime) {
            actualDurationMinutes = parseTimeToMinutes(endTime) - parseTimeToMinutes(b.actualStartTime);
            if (actualDurationMinutes < 0) actualDurationMinutes += 24 * 60; // Crosses midnight
        }

        // Calculate total break duration from interruptions
        const totalBreakDuration = finalInterruptions.reduce((total, interruption) => {
            if (interruption.start && interruption.end) {
                let breakMins = parseTimeToMinutes(interruption.end) - parseTimeToMinutes(interruption.start);
                if (breakMins < 0) breakMins += 24 * 60;
                return total + breakMins;
            }
            return total;
        }, 0);

        const actualStudyTime = actualDurationMinutes - totalBreakDuration;
        const overrun = actualStudyTime - b.plannedDurationMinutes;

        // Update the completed block
        updatedBlocks[currentBlockIndex] = {
            ...b,
            status: 'DONE',
            actualEndTime: endTime,
            actualDurationMinutes: actualDurationMinutes,
            completionStatus: reflection.status,
            actualPagesCovered: reflection.pagesCovered,
            carryForwardPages: reflection.carryForwardPages,
            actualNotes: reflection.notes,
            segments: finalSegments,
            interruptions: finalInterruptions,
            tasks: reflection.tasks || b.tasks,
            rescheduledTo: reflection.rescheduledTo // Store where it went
        };

        // --- TIME SHIFTING LOGIC ---
        if (overrun > 0) {
            updatedBlocks = shiftSchedule(updatedBlocks, currentBlockIndex, overrun);
        }

        // Ensure chronological order is maintained
        updatedBlocks.sort((a, b) => parseTimeToMinutes(a.plannedStartTime) - parseTimeToMinutes(b.plannedStartTime));

        const updatedPlan = { ...plan, blocks: updatedBlocks };

        if (updatedPlan.blocks.length > 0) {
            const lastBlock = updatedPlan.blocks[updatedPlan.blocks.length - 1];
            updatedPlan.estimatedEndTime = lastBlock.plannedEndTime;
        }

        await saveDayPlan(updatedPlan);
        return updatedPlan;

    } catch (e) {
        console.error("planService: finishBlock failed", e);
        throw e;
    }
};

/**
 * Inserts a new block at a specific time and shifts overlapping/future blocks.
 */
export const insertBlockAndShift = async (
    date: string, 
    startTimeStr: string, 
    durationMinutes: number, 
    tasks: BlockTask[],
    title: string = 'New Study Block'
): Promise<DayPlan | null> => {
    try {
        const plan = await getDayPlan(date);
        if (!plan || !plan.blocks) return null;

        const newBlockStart = parseTimeToMinutes(startTimeStr);
        const newBlockEnd = newBlockStart + durationMinutes;
        
        // 1. Create the new block
        const newBlock: Block = {
            id: generateId(),
            index: -1, // Temporary
            date: date,
            plannedStartTime: formatTime(newBlockStart),
            plannedEndTime: formatTime(newBlockEnd),
            type: 'MIXED',
            title: title,
            description: 'Manual Entry',
            plannedDurationMinutes: durationMinutes,
            status: 'NOT_STARTED',
            tasks: tasks
        };

        let updatedBlocks = [...plan.blocks];
        
        // 2. Insert and Shift
        const doneBlocks = updatedBlocks.filter(b => b.status === 'DONE');
        const pendingBlocks = updatedBlocks.filter(b => b.status !== 'DONE');
        
        // Sort pending blocks by start time
        pendingBlocks.sort((a,b) => parseTimeToMinutes(a.plannedStartTime) - parseTimeToMinutes(b.plannedStartTime));

        const shiftDelta = durationMinutes;
        
        const shiftedPendingBlocks = pendingBlocks.map(b => {
            const bStart = parseTimeToMinutes(b.plannedStartTime);
            if (bStart >= newBlockStart) {
                const bEnd = parseTimeToMinutes(b.plannedEndTime);
                return {
                    ...b,
                    plannedStartTime: formatTime(bStart + shiftDelta),
                    plannedEndTime: formatTime(bEnd + shiftDelta)
                };
            }
            // If block ends after new start, it overlaps, push it.
            const bEnd = parseTimeToMinutes(b.plannedEndTime);
            if (bEnd > newBlockStart) {
                 return {
                    ...b,
                    plannedStartTime: formatTime(bStart + shiftDelta),
                    plannedEndTime: formatTime(bEnd + shiftDelta)
                };
            }
            return b;
        });

        // Combine
        updatedBlocks = [...doneBlocks, newBlock, ...shiftedPendingBlocks];
        
        // Re-sort and re-index immediately to ensure chronological order
        updatedBlocks.sort((a,b) => parseTimeToMinutes(a.plannedStartTime) - parseTimeToMinutes(b.plannedStartTime));
        updatedBlocks.forEach((b, i) => b.index = i);

        const updatedPlan = { ...plan, blocks: updatedBlocks };
        await saveDayPlan(updatedPlan);
        return updatedPlan;

    } catch (e) {
        console.error("insertBlockAndShift failed", e);
        throw e;
    }
};

/**
 * Moves tasks to the immediately next pending block.
 */
export const moveTasksToNextBlock = async (date: string, currentBlockId: string, tasksToMove: BlockTask[]): Promise<DayPlan | null> => {
    try {
        const plan = await getDayPlan(date);
        if (!plan || !plan.blocks) return null;

        const currentIdx = plan.blocks.findIndex(b => b.id === currentBlockId);
        if (currentIdx === -1) return null;

        // Find next pending block
        const nextBlockIdx = plan.blocks.findIndex((b, i) => i > currentIdx && b.status !== 'DONE' && b.type !== 'BREAK');
        
        if (nextBlockIdx !== -1) {
            const updatedBlocks = [...plan.blocks];
            const nextBlock = updatedBlocks[nextBlockIdx];
            
            const mergedTasks = [...(nextBlock.tasks || []), ...tasksToMove];
            
            updatedBlocks[nextBlockIdx] = {
                ...nextBlock,
                tasks: mergedTasks,
                title: nextBlock.title + (nextBlock.title.includes('Carried') ? '' : ' + Carried Tasks')
            };
            
            // Ensure sorting
            updatedBlocks.sort((a, b) => parseTimeToMinutes(a.plannedStartTime) - parseTimeToMinutes(b.plannedStartTime));

            const updatedPlan = { ...plan, blocks: updatedBlocks };
            await saveDayPlan(updatedPlan);
            return updatedPlan;
        } else {
            console.warn("No next block found to move tasks to.");
            return null;
        }

    } catch (e) {
        console.error("moveTasksToNextBlock failed", e);
        throw e;
    }
};

/**
 * Moves tasks to a future date's plan (Reschedule to specific date).
 */
export const moveTasksToFuturePlan = async (sourceDate: string, targetDate: string, tasksToMove: BlockTask[]): Promise<void> => {
    try {
        let targetPlan = await getDayPlan(targetDate);
        
        // Create target plan skeleton if not exists
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

        // Create a new block for these tasks in the target plan
        // We'll append it to the end or default time if empty
        let newStartTime = '08:00';
        if (targetPlan.blocks && targetPlan.blocks.length > 0) {
            newStartTime = targetPlan.blocks[targetPlan.blocks.length - 1].plannedEndTime;
        }
        
        // Default 60 min block for rescheduled items
        const newStartMins = parseTimeToMinutes(newStartTime);
        const newEndMins = newStartMins + 60;
        
        const newBlock: Block = {
            id: generateId(),
            index: (targetPlan.blocks?.length || 0),
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
        // Sort
        updatedBlocks.sort((a, b) => parseTimeToMinutes(a.plannedStartTime) - parseTimeToMinutes(b.plannedStartTime));
        updatedBlocks.forEach((b, i) => b.index = i);

        const updatedTargetPlan = { ...targetPlan, blocks: updatedBlocks };
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
        updatedBlocks.sort((a, b) => parseTimeToMinutes(a.plannedStartTime) - parseTimeToMinutes(b.plannedStartTime));
        updatedBlocks.forEach((b, i) => b.index = i);

        const updatedPlan = { ...plan, blocks: updatedBlocks };
        await saveDayPlan(updatedPlan);
        return updatedPlan;
    } catch (e) {
        console.error("deleteBlock failed", e);
        throw e;
    }
};
