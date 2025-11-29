
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
 * Recalculates state based on logs.
 * NOW ACCEPTS SETTINGS to correctly recalculate the nextRevisionAt date from the timestamp.
 */
export const recalculateEntryStats = (entry: KnowledgeBaseEntry, settings?: RevisionSettings): KnowledgeBaseEntry => {
    const logs = entry.logs || [];
    const safeSettings = settings || { mode: 'balanced', targetCount: 7 }; // Fallback defaults
    
    // 1. STRICT RESET if no logs exist
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
    // Sort logs chronologically for First Study, and Reverse for Last Study
    const chronologicalLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const reversedLogs = [...chronologicalLogs].reverse();

    const firstStudiedAt = chronologicalLogs.length > 0 ? chronologicalLogs[0].timestamp : null;
    const lastStudiedAt = reversedLogs.length > 0 ? reversedLogs[0].timestamp : null;

    // 3. Calculate Page-Level SRS (Only logs with NO topics, or generic ones)
    const pageLevelLogs = logs.filter(l => !l.topics || l.topics.length === 0);
    const pageRevisionCount = pageLevelLogs.filter(l => l.type === 'REVISION').length;
    
    let pageNextRevisionAt: string | null = null;

    if (pageLevelLogs.length > 0) {
        // Get the very last interaction with the page (study or revision)
        const lastPageLog = pageLevelLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        
        // Determine the NEXT revision index.
        // If type was STUDY (first time), next index is 0 (Interval 1).
        // If type was REVISION (rev index X), next index is X + 1.
        const nextIndex = lastPageLog.type === 'STUDY' ? 0 : lastPageLog.revisionIndex + 1;
        
        // Calculate date from the LOG TIMESTAMP
        const nextDate = calculateNextRevisionDate(new Date(lastPageLog.timestamp), nextIndex, safeSettings);
        pageNextRevisionAt = nextDate ? nextDate.toISOString() : null;
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
                nextRevisionAt: null 
            };
        } else {
            const sortedTopicLogs = [...topicLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            const topicLastLog = sortedTopicLogs[0];
            const topicRevCount = topicLogs.filter(l => l.type === 'REVISION').length;
            
            // Calculate Topic SRS
            const nextIndex = topicLastLog.type === 'STUDY' ? 0 : topicLastLog.revisionIndex + 1;
            const nextDate = calculateNextRevisionDate(new Date(topicLastLog.timestamp), nextIndex, safeSettings);

            return {
                ...topic,
                revisionCount: topicRevCount,
                currentRevisionIndex: topicRevCount,
                lastStudiedAt: topicLastLog.timestamp,
                nextRevisionAt: nextDate ? nextDate.toISOString() : null
            };
        }
    });

    return {
        ...entry,
        logs: logs,
        revisionCount: pageRevisionCount,
        currentRevisionIndex: pageRevisionCount,
        lastStudiedAt,
        firstStudiedAt,
        nextRevisionAt: pageNextRevisionAt,
        topics: updatedTopics
    };
};

export const performFullIntegrityCheck = (allEntries: KnowledgeBaseEntry[], settings?: RevisionSettings): { updated: boolean, data: KnowledgeBaseEntry[] } => {
    let hasChanges = false;
    const fixedEntries = allEntries.map(entry => {
        const recalculated = recalculateEntryStats(entry, settings);
        const changed = 
            recalculated.revisionCount !== entry.revisionCount ||
            recalculated.lastStudiedAt !== entry.lastStudiedAt ||
            JSON.stringify(recalculated.topics) !== JSON.stringify(entry.topics) ||
            recalculated.nextRevisionAt !== entry.nextRevisionAt; 

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

        // 1. Ensure Topics Exist
        entry.topics.forEach(topicName => {
            const cleanName = topicName.trim();
            if (!kbEntry!.topics.some(t => t.name.trim().toLowerCase() === cleanName.toLowerCase())) {
                kbEntry!.topics.push({
                    id: generateId(), name: cleanName, revisionCount: 0, lastStudiedAt: null,
                    nextRevisionAt: null, currentRevisionIndex: 0, logs: []
                });
            }
        });

        // 2. Context Detection
        const loggedTopicSet = new Set(entry.topics.map(t => t.trim().toLowerCase()));
        const allTopicsCovered = kbEntry.topics.length > 0 && kbEntry.topics.every(t => loggedTopicSet.has(t.name.trim().toLowerCase()));
        const isEffectiveWholePage = entry.topics.length === 0 || allTopicsCovered;

        // Determine event type
        let eventType: 'STUDY' | 'REVISION';
        if (entry.isExplicitRevision) {
            eventType = 'REVISION';
        } else {
            let hasHistory = false;
            if (isEffectiveWholePage) {
                hasHistory = kbEntry.logs.length > 0 || kbEntry.topics.some(t => t.lastStudiedAt !== null);
            } else {
                hasHistory = entry.topics.some(tName => {
                    const topic = kbEntry!.topics.find(t => t.name.trim().toLowerCase() === tName.trim().toLowerCase());
                    return topic && topic.lastStudiedAt !== null;
                });
            }
            eventType = hasHistory ? 'REVISION' : 'STUDY';
        }

        // Determine Revision Index for LOGGING (Calculation of next date happens below)
        let logRevisionIndex = 0;
        if (isEffectiveWholePage) {
            if (!kbEntry.title || kbEntry.title.startsWith('First Aid Page')) {
                if (entry.topics.length > 0) kbEntry.title = entry.topics.join(', ');
            }
            const currentRev = kbEntry.revisionCount || 0;
            logRevisionIndex = eventType === 'REVISION' ? currentRev + 1 : 0;
        } else {
            // For specific topics, find max revision
            kbEntry.topics.forEach(t => {
                if (loggedTopicSet.has(t.name.trim().toLowerCase())) {
                    logRevisionIndex = Math.max(logRevisionIndex, (eventType === 'REVISION' ? (t.revisionCount || 0) + 1 : 0));
                }
            });
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
        
        // 3. CRITICAL: Recalculate stats immediately using the new log.
        // This ensures nextRevisionAt is derived from the log timestamp we just added (nowISO).
        const recalculatedEntry = recalculateEntryStats(kbEntry, revisionSettings);

        results.push({
            pageNumber: entry.pageNumber,
            eventType,
            newRevisionCount: recalculatedEntry.revisionCount,
            confirmationMessage: isEffectiveWholePage 
                ? `${eventType} logged for Whole Page ${pageStr}`
                : `${eventType} logged for specific subtopics`,
            updatedEntry: recalculatedEntry,
        });

        kbMap.set(pageStr, recalculatedEntry);
    }
    
    return { results, updatedKB: Array.from(kbMap.values()) };
};
