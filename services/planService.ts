import { getDayPlan, saveDayPlan } from './firebase';
import { Block, DayPlan } from '../types';

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

        const updatedPlan = { ...plan, blocks: updatedBlocks };
        await saveDayPlan(updatedPlan);
        return updatedPlan;

    } catch (e) {
        console.error("planService: updateBlockInPlan failed", e);
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

        const updatedPlan = { ...plan, blocks: updatedBlocks, startTimeActual: plan.startTimeActual || nowTime };
        await saveDayPlan(updatedPlan);
        return updatedPlan;
    } catch (e) {
        console.error("planService: startBlock failed", e);
        throw e;
    }
};

/**
 * Finish a block with reflection data.
 */
export const finishBlock = async (
    date: string, 
    blockId: string, 
    reflection: {
        status: 'COMPLETED' | 'PARTIAL' | 'NOT_DONE',
        pagesCovered: number[],
        carryForwardPages: number[],
        notes: string,
        interruptions?: { start: string, end: string, reason: string }[]
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

        // Update the block
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
            interruptions: finalInterruptions
        };

        // If overrun, shift subsequent blocks
        if (overrun > 0) {
            for (let i = currentBlockIndex + 1; i < updatedBlocks.length; i++) {
                const nextBlock = updatedBlocks[i];
                if (nextBlock.status === 'DONE') continue; // Don't shift already completed blocks
                
                const newStartTime = formatTime(parseTimeToMinutes(nextBlock.plannedStartTime) + overrun);
                const newEndTime = formatTime(parseTimeToMinutes(nextBlock.plannedEndTime) + overrun);
                updatedBlocks[i] = {
                    ...nextBlock,
                    plannedStartTime: newStartTime,
                    plannedEndTime: newEndTime
                };
            }
        }

        if (reflection.carryForwardPages && reflection.carryForwardPages.length > 0) {
            const nextBlockIndex = updatedBlocks.findIndex((blk, idx) => idx > currentBlockIndex && blk.type !== 'BREAK' && blk.status !== 'DONE');
            if (nextBlockIndex !== -1) {
                const nextBlock = updatedBlocks[nextBlockIndex];
                const carryNote = ` [⚠️ Carried Fwd: Pgs ${reflection.carryForwardPages.join(', ')}]`;
                if (!nextBlock.description?.includes('Carried Fwd')) {
                     updatedBlocks[nextBlockIndex] = {
                        ...nextBlock,
                        description: (nextBlock.description || '') + carryNote,
                        title: nextBlock.title.includes('⚠️') ? nextBlock.title : `⚠️ ${nextBlock.title}`
                    };
                }
            }
        }

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