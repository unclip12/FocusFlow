// services/faLoggerService.ts
import { KnowledgeBaseEntry, RevisionLog, Attachment, TrackableItem, RevisionSettings } from '../types';
import { calculateNextRevisionDate } from './srsService';

const generateId = () => crypto.randomUUID();

export interface ParsedLogEntry {
  pageNumber: number;
  isExplicitRevision: boolean;
  topics: string[];
  attachment?: Attachment;
  date?: string; // YYYY-MM-DD
  timestamp?: string; // ISO String for exact time
}

export const parseFALoggerInput = (input: string): ParsedLogEntry[] => {
    const entries: ParsedLogEntry[] = [];
    const lines = input.split(/;|\n/).filter(line => line.trim() !== '');

    for (const line of lines) {
        const pageRegex = /(?:pg|page)?\s*(\d+(?:-\d+)?(?:,\s*\d+)*)/gi;
        
        let match;
        const remainingText = line.replace(pageRegex, '').replace(/(?:studied|revised|revise|revision|again|did)/gi, '').replace(/[-–,.]/g, ' ').trim();
        const topics = remainingText ? [remainingText] : [];

        pageRegex.lastIndex = 0;

        while ((match = pageRegex.exec(line)) !== null) {
            const pageGroup = match[1];
            const isExplicitRevision = /(revised|revise|revision|again)/i.test(line);

            const pageNumbers = pageGroup.split(',').flatMap(part => {
                if (part.includes('-')) {
                    const [start, end] = part.split('-').map(Number);
                    if (!isNaN(start) && !isNaN(end) && end >= start) {
                        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
                    }
                }
                const num = parseInt(part.trim());
                if (!isNaN(num)) return [num];
                return [];
            });

            for (const pageNum of pageNumbers) {
                entries.push({
                    pageNumber: pageNum,
                    isExplicitRevision,
                    topics,
                });
            }
        }
    }
    return entries;
};

interface LogResult {
    pageNumber: number;
    eventType: 'STUDY' | 'REVISION';
    newRevisionCount: number;
    confirmationMessage: string;
    updatedEntry: KnowledgeBaseEntry;
}

/**
 * Recalculates state. 
 * CRITICAL UPDATE: This must respect the separation of Page vs Topic stats.
 */
export const recalculateEntryStats = (entry: KnowledgeBaseEntry): KnowledgeBaseEntry => {
    const logs = entry.logs || [];
    
    // 1. STRICT RESET if no logs exist
    // Fix: Ensure ALL nextRevisionAt and lastStudiedAt are nullified
    if (logs.length === 0) {
        const resetTopics = (entry.topics || []).map(t => ({
            ...t,
            revisionCount: 0,
            currentRevisionIndex: 0,
            lastStudiedAt: null,
            nextRevisionAt: null
        }));

        return {
            ...entry,
            logs: [],
            revisionCount: 0,
            currentRevisionIndex: 0,
            firstStudiedAt: null,
            lastStudiedAt: null, 
            nextRevisionAt: null,
            topics: resetTopics,
        };
    }

    // 2. Separate Logs: Whole Page vs Specific Topic
    // A log counts towards the PAGE SRS only if it has NO specific topics (or explicitly covers all, handled by UI usually)
    // A log counts towards a TOPIC SRS if it lists that topic.
    
    // Global Last Studied (Visual indicator only)
    const sortedLogs = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const lastStudiedAt = sortedLogs.length > 0 ? sortedLogs[0].timestamp : null;
    
    const chronologicalLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const firstStudiedAt = chronologicalLogs.length > 0 ? chronologicalLogs[0].timestamp : null;

    // 3. Calculate Page-Level SRS (Only logs with NO topics)
    const pageLevelLogs = logs.filter(l => !l.topics || l.topics.length === 0);
    const pageRevisionCount = pageLevelLogs.filter(l => l.type === 'REVISION').length;
    
    // Since logs exist, we trust existing dates generally unless strictly recalculating timeline.
    // But if Page Logs are empty now, Page Next Revision must be null.
    let pageNextRevisionAt = entry.nextRevisionAt;
    if (pageLevelLogs.length === 0) {
        pageNextRevisionAt = null;
    } else {
        // Retain existing unless invalid
        if (!pageNextRevisionAt && pageRevisionCount > 0) {
             // Should theoretically be set, but if deleted last revision, we might need to clear it?
             // Without schedule settings we can't re-predict. We assume if logs exist, the state is consistent enough
             // or will be fixed on next log.
        }
    }
    
    // 4. Recalculate Topics
    const updatedTopics = entry.topics.map(topic => {
        const topicLogs = logs.filter(l => 
            l.topics && l.topics.some(t => t.trim().toLowerCase() === topic.name.trim().toLowerCase())
        );

        if (topicLogs.length === 0) {
            return {
                ...topic,
                revisionCount: 0,
                currentRevisionIndex: 0,
                lastStudiedAt: null, 
                nextRevisionAt: null // Reset deadline if no logs
            };
        } else {
            const sortedTopicLogs = [...topicLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            const topicLastStudied = sortedTopicLogs[0].timestamp;
            const topicRevCount = topicLogs.filter(l => l.type === 'REVISION').length;
            
            // Keep existing next date unless it was invalid
            return {
                ...topic,
                revisionCount: topicRevCount,
                currentRevisionIndex: topicRevCount,
                lastStudiedAt: topicLastStudied,
                nextRevisionAt: topic.nextRevisionAt 
            };
        }
    });

    return {
        ...entry,
        logs: logs,
        revisionCount: pageRevisionCount, // Strictly Update Count
        currentRevisionIndex: pageRevisionCount,
        lastStudiedAt,
        firstStudiedAt,
        nextRevisionAt: pageNextRevisionAt,
        topics: updatedTopics
    };
};

export const performFullIntegrityCheck = (allEntries: KnowledgeBaseEntry[]): { updated: boolean, data: KnowledgeBaseEntry[] } => {
    let hasChanges = false;
    const fixedEntries = allEntries.map(entry => {
        const recalculated = recalculateEntryStats(entry);
        const changed = 
            recalculated.revisionCount !== entry.revisionCount ||
            recalculated.lastStudiedAt !== entry.lastStudiedAt ||
            JSON.stringify(recalculated.topics) !== JSON.stringify(entry.topics) ||
            recalculated.nextRevisionAt !== entry.nextRevisionAt; // Check page level too

        if (changed) {
            hasChanges = true;
            return recalculated;
        }
        return entry;
    });
    return { updated: hasChanges, data: fixedEntries };
};

export const processLogEntries = (parsedEntries: ParsedLogEntry[], currentKB: KnowledgeBaseEntry[], revisionSettings: RevisionSettings): { results: LogResult[], updatedKB: KnowledgeBaseEntry[] } => {
    const results: LogResult[] = [];
    let kbMap = new Map<string, KnowledgeBaseEntry>(currentKB.map(entry => [entry.pageNumber, JSON.parse(JSON.stringify(entry))]));

    for (const entry of parsedEntries) {
        const pageStr = String(entry.pageNumber);
        let kbEntry = kbMap.get(pageStr);
        
        let now: Date = entry.timestamp ? new Date(entry.timestamp) : (entry.date ? new Date(entry.date + 'T12:00:00') : new Date());
        const nowISO = now.toISOString();

        if (!kbEntry) {
            kbEntry = {
                pageNumber: pageStr,
                title: `First Aid Page ${pageStr}`,
                subject: 'Uncategorized',
                system: 'Uncategorized',
                revisionCount: 0,
                firstStudiedAt: null, lastStudiedAt: null, nextRevisionAt: null, currentRevisionIndex: 0,
                ankiTotal: 0, ankiCovered: 0, videoLinks: [], tags: [], notes: '', logs: [], topics: [], attachments: []
            };
        }

        const isTopicSpecific = entry.topics.length > 0;
        
        let eventType: 'STUDY' | 'REVISION';
        if (entry.isExplicitRevision) {
            eventType = 'REVISION';
        } else {
            let hasHistory = false;
            if (isTopicSpecific) {
                hasHistory = entry.topics.some(tName => {
                    const topic = kbEntry!.topics.find(t => t.name.trim().toLowerCase() === tName.trim().toLowerCase());
                    return topic && topic.lastStudiedAt !== null;
                });
            } else {
                // If a page has ever been touched (even with a topic-specific log), it has history.
                hasHistory = kbEntry.logs.length > 0;
            }
            eventType = hasHistory ? 'REVISION' : 'STUDY';
        }


        let logRevisionIndex = 0;

        // --- UPDATE TOPICS ---
        if (isTopicSpecific) {
            if (!kbEntry.title || kbEntry.title.startsWith('First Aid Page')) kbEntry.title = entry.topics[0];

            const sessionTopicNames = new Set(entry.topics.map(t => t.trim().toLowerCase()));
            
            kbEntry.topics = kbEntry.topics.map(t => {
                if (sessionTopicNames.has(t.name.trim().toLowerCase())) {
                    const currentRev = t.revisionCount || 0;
                    if (eventType === 'REVISION') {
                        logRevisionIndex = Math.max(logRevisionIndex, currentRev + 1);
                        const newRevCount = currentRev + 1;
                        const nextDate = calculateNextRevisionDate(now, newRevCount, revisionSettings);
                        return { ...t, revisionCount: newRevCount, currentRevisionIndex: newRevCount, lastStudiedAt: nowISO, nextRevisionAt: nextDate ? nextDate.toISOString() : null };
                    } else { // STUDY
                         const nextDate = calculateNextRevisionDate(now, 0, revisionSettings); // Schedule R0
                         return { ...t, lastStudiedAt: nowISO, nextRevisionAt: nextDate ? nextDate.toISOString() : null };
                    }
                }
                return t;
            });

            entry.topics.forEach(topicName => {
                const cleanName = topicName.trim();
                if (!kbEntry!.topics.some(t => t.name.trim().toLowerCase() === cleanName.toLowerCase())) {
                    const nextDate = calculateNextRevisionDate(now, 0, revisionSettings);
                    kbEntry!.topics.push({
                        id: generateId(), name: cleanName, revisionCount: 0, lastStudiedAt: nowISO,
                        nextRevisionAt: nextDate ? nextDate.toISOString() : null, currentRevisionIndex: 0, logs: []
                    });
                }
            });
        } else {
            // --- UPDATE WHOLE PAGE SRS ---
            const currentRev = kbEntry.revisionCount || 0;
            if (eventType === 'REVISION') {
                logRevisionIndex = currentRev + 1;
                const newRevCount = currentRev + 1;
                const nextDate = calculateNextRevisionDate(now, newRevCount, revisionSettings);
                kbEntry.revisionCount = newRevCount;
                kbEntry.currentRevisionIndex = newRevCount;
                kbEntry.nextRevisionAt = nextDate ? nextDate.toISOString() : null;
            } else { // STUDY
                 logRevisionIndex = 0;
                 const nextDate = calculateNextRevisionDate(now, 0, revisionSettings); // Schedule R0
                 kbEntry.nextRevisionAt = nextDate ? nextDate.toISOString() : null;
            }
        }
        
        if (entry.attachment) {
            if (!kbEntry.attachments) kbEntry.attachments = [];
            if (!kbEntry.attachments.some(a => a.id === entry.attachment!.id)) kbEntry.attachments.push(entry.attachment);
        }
        
        const newLog: RevisionLog = {
            id: generateId(),
            timestamp: nowISO,
            revisionIndex: logRevisionIndex,
            type: eventType,
            topics: entry.topics,
            source: 'MODAL'
        };

        kbEntry.logs = [...kbEntry.logs, newLog];
        kbEntry.lastStudiedAt = nowISO;
        kbEntry.firstStudiedAt = kbEntry.firstStudiedAt || nowISO;

        let confirmationMessage = isTopicSpecific 
            ? `${eventType} logged for subtopics: ${entry.topics.join(', ')}`
            : `${eventType} logged for Whole Page ${pageStr}`;

        results.push({
            pageNumber: entry.pageNumber,
            eventType,
            newRevisionCount: kbEntry.revisionCount,
            confirmationMessage,
            updatedEntry: kbEntry,
        });

        kbMap.set(pageStr, kbEntry);
    }
    
    return { results, updatedKB: Array.from(kbMap.values()) };
};
