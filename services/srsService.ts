

import { REVISION_SCHEDULES, RevisionSettings } from '../types';

/**
 * Calculates the next revision date based on the last study date and current progress in the SRS schedule.
 * @param lastRevisionDate The date of the last completed study/revision session.
 * @param revisionIndex The index of the NEXT revision to be scheduled (e.g., if R0 is done, index is 1 for R1).
 * @param settings The user's current revision settings.
 * @returns A Date object for the next revision, or null if the schedule is complete.
 */
export const calculateNextRevisionDate = (
    lastRevisionDate: Date, 
    revisionIndex: number,
    settings: RevisionSettings
): Date | null => {
    const mode = settings.mode || 'balanced';
    const schedule = REVISION_SCHEDULES[mode];
    const targetCount = settings.targetCount || schedule.length;

    // Stop scheduling if the next revision index is beyond the schedule length or the user's target
    if (revisionIndex >= schedule.length || revisionIndex >= targetCount) {
        return null; // Mastered or target reached
    }

    const hoursToAdd = schedule[revisionIndex];
    const nextDate = new Date(lastRevisionDate.getTime());
    nextDate.setHours(nextDate.getHours() + hoursToAdd);
    
    return nextDate;
};