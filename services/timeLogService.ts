
import { auth, db, getDayPlan, cleanData } from "./firebase";
import { TimeLogEntry, getAdjustedDate, KnowledgeBaseEntry } from "../types";

// Helper to generate ID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

export const getTimeLogs = async (date: string): Promise<TimeLogEntry[]> => {
    if (!auth.currentUser) return [];
    const colRef = db.collection('users').doc(auth.currentUser.uid).collection('timeLogs');
    try {
        // Query specifically for the "study day" date
        const snap = await colRef.where('date', '==', date).get();
        return snap.docs.map(d => d.data() as TimeLogEntry).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    } catch (e) {
        console.warn("Failed to fetch time logs", e);
        return [];
    }
};

export const saveTimeLog = async (entry: TimeLogEntry) => {
    if (!auth.currentUser) return;
    const docRef = db.collection('users').doc(auth.currentUser.uid).collection('timeLogs').doc(entry.id);
    await docRef.set(cleanData(entry));
};

export const deleteTimeLog = async (id: string) => {
    if (!auth.currentUser) return;
    const docRef = db.collection('users').doc(auth.currentUser.uid).collection('timeLogs').doc(id);
    await docRef.delete();
};

export const getTimeLogsForTimeline = async (date: string): Promise<TimeLogEntry[]> => {
    if (!auth.currentUser) return [];

    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    const prevDateStr = getAdjustedDate(d);

    const colRef = db.collection('users').doc(auth.currentUser.uid).collection('timeLogs');
    try {
        const snap = await colRef.where('date', 'in', [date, prevDateStr]).get();
        return snap.docs.map(d => d.data() as TimeLogEntry);
    } catch (e) {
        console.warn("Failed to fetch timeline logs", e);
        return [];
    }
};

export const getTimeLogsForMonth = async (year: number, month: number): Promise<TimeLogEntry[]> => {
    if (!auth.currentUser) return [];

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const colRef = db.collection('users').doc(auth.currentUser.uid).collection('timeLogs');
    try {
        const snap = await colRef.where('date', '>=', startDate).where('date', '<=', endDate).get();
        return snap.docs.map(d => d.data() as TimeLogEntry);
    } catch (e) {
        console.warn("Failed to fetch monthly logs", e);
        return [];
    }
};


// Backfill logic to sync FA logs and DayPlans into timeLogs
export const backfillTimeLogs = async (knowledgeBase: KnowledgeBaseEntry[], date: string) => {
    if (!auth.currentUser) return;
    
    // 1. Get existing time logs for the day to avoid duplicates
    const existingLogs = await getTimeLogs(date);
    const existingSourceIds = new Set(existingLogs.map(l => l.linkedEntityId).filter(Boolean));
    
    const newLogs: TimeLogEntry[] = [];

    // 2. Scan FA KnowledgeBase for logs on this date
    knowledgeBase.forEach(kb => {
        kb.logs.forEach(log => {
            const logDate = getAdjustedDate(log.timestamp);
            if (logDate === date) {
                // Use log.id as the unique linker. If not present in existing, create it.
                if (!existingSourceIds.has(log.id)) {
                    // If duration is missing or 0, default to 1 min instant to mark timestamp
                    const duration = log.durationMinutes || 1;
                    const startTime = new Date(log.timestamp);
                    const endTime = new Date(startTime.getTime() + duration * 60000);
                    
                    newLogs.push({
                        id: generateId(),
                        date: date,
                        startTime: startTime.toISOString(),
                        endTime: endTime.toISOString(),
                        durationMinutes: duration,
                        category: log.type === 'REVISION' ? 'REVISION' : 'STUDY',
                        source: 'FA_LOGGER',
                        activity: `${log.type === 'REVISION' ? 'Revised' : 'Studied'} FA Pg ${kb.pageNumber}`,
                        pageNumber: kb.pageNumber,
                        linkedEntityId: log.id
                    });
                    existingSourceIds.add(log.id); // prevent dupes within loop
                }
            }
        });
    });

    // 3. Scan Today's Plan for Completed Blocks
    try {
        const plan = await getDayPlan(date);
        if (plan && plan.blocks) {
            plan.blocks.forEach(block => {
                if (block.status === 'DONE' && block.actualStartTime && block.actualEndTime) {
                    const blockLinkKey = block.id;
                    if (!existingSourceIds.has(blockLinkKey)) {
                        // Reconstruct dates from times
                        // This assumes block times are for the plan 'date'
                        // If times cross midnight, might need adjustment logic similar to parser
                        const [sH, sM] = block.actualStartTime.split(':').map(Number);
                        const [eH, eM] = block.actualEndTime.split(':').map(Number);
                        
                        const start = new Date(date + 'T00:00:00');
                        start.setHours(sH, sM);
                        
                        const end = new Date(date + 'T00:00:00');
                        end.setHours(eH, eM);
                        if (end < start) end.setDate(end.getDate() + 1);

                        const duration = Math.round((end.getTime() - start.getTime()) / 60000);

                        let category: any = 'STUDY';
                        if (block.type === 'BREAK') category = 'BREAK';
                        else if (block.type === 'VIDEO') category = 'VIDEO';
                        else if (block.type === 'ANKI') category = 'ANKI';
                        else if (block.type === 'QBANK') category = 'QBANK';

                        newLogs.push({
                            id: generateId(),
                            date: date,
                            startTime: start.toISOString(),
                            endTime: end.toISOString(),
                            durationMinutes: duration,
                            category: category,
                            source: 'TODAYS_PLAN_BLOCK',
                            activity: block.title,
                            linkedEntityId: blockLinkKey
                        });
                        existingSourceIds.add(blockLinkKey);
                    }
                }
            });
        }
    } catch (e) {
        console.error("Backfill: Failed to read DayPlan", e);
    }

    // 4. Batch Write with Chunking
    if (newLogs.length > 0) {
        const chunkArray = <T>(array: T[], size: number): T[][] => {
            const chunked: T[][] = [];
            for (let i = 0; i < array.length; i += size) {
                chunked.push(array.slice(i, i + size));
            }
            return chunked;
        };

        const chunks = chunkArray(newLogs, 450);

        for (const chunk of chunks) {
            const batch = db.batch();
            chunk.forEach(log => {
                const ref = db.collection('users').doc(auth.currentUser!.uid).collection('timeLogs').doc(log.id);
                batch.set(ref, log);
            });
            await batch.commit();
        }
        console.log(`Backfilled ${newLogs.length} logs.`);
    }
};
