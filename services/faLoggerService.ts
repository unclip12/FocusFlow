
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
    // Split by semicolon or newline to handle multiple entries
    const lines = input.split(/;|\n/).filter(line => line.trim() !== '');

    for (const line of lines) {
        // Regex to find page numbers, supporting "pg 123", "page 123", or just numbers after those keywords.
        // Also handles ranges "123-125" and lists "123, 124"
        const pageRegex = /(?:pg|page)?\s*(\d+(?:-\d+)?(?:,\s*\d+)*)/gi;
        
        let match;
        const remainingText = line.replace(pageRegex, '').replace(/(?:studied|revised|revise|revision|again|did)/gi, '').replace(/[-–,.]/g, ' ').trim();
        const topics = remainingText ? [remainingText] : [];

        // Reset regex state for global flag
        pageRegex.lastIndex = 0;

        while ((match = pageRegex.exec(line)) !== null) {
            const pageGroup = match[1];
            const isExplicitRevision = /(revised|revise|revision|again)/i.test(line);

            // Expand ranges and lists
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
 * Recalculates the entire state of a KnowledgeBaseEntry based on its logs.
 * STRICT RESET: If logs are empty, it forces stats to 0/null.
 */
export const recalculateEntryStats = (entry: KnowledgeBaseEntry): KnowledgeBaseEntry => {
    const logs = entry.logs || [];
    
    // STRICT RESET if no logs exist
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
            lastStudiedAt: null, // This turns the badge Red
            nextRevisionAt: null,
            topics: resetTopics,
            // We optionally keep attachments/notes as they might be static resources
        };
    }

    // 1. Page Level Stats
    const sortedLogs = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const lastStudiedAt = sortedLogs.length > 0 ? sortedLogs[0].timestamp : null;
    // Find the very first log ever
    const allLogsChronological = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const firstStudiedAt = allLogsChronological.length > 0 ? allLogsChronological[0].timestamp : null;
    
    // Count Revisions (logs where type is explicitly REVISION)
    // Initial study does NOT count as a revision.
    const revisionCount = logs.filter(l => l.type === 'REVISION').length;
    const currentRevisionIndex = revisionCount; 

    // 2. Topic Level Stats
    const updatedTopics = entry.topics.map(topic => {
        // Find logs that explicitly mention this topic
        const topicLogs = logs.filter(l => 
            l.topics && l.topics.some(t => t.trim().toLowerCase() === topic.name.trim().toLowerCase())
        );

        if (topicLogs.length === 0) {
            // RESET TOPIC: No logs remain for this specific topic
            return {
                ...topic,
                revisionCount: 0,
                currentRevisionIndex: 0,
                lastStudiedAt: null, 
                nextRevisionAt: null
            };
        } else {
            // RECALCULATE TOPIC
            const sortedTopicLogs = [...topicLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            const topicLastStudied = sortedTopicLogs[0].timestamp;
            const topicRevCount = topicLogs.filter(l => l.type === 'REVISION').length;
            
            return {
                ...topic,
                revisionCount: topicRevCount,
                currentRevisionIndex: topicRevCount,
                lastStudiedAt: topicLastStudied
            };
        }
    });

    return {
        ...entry,
        logs: logs,
        revisionCount,
        currentRevisionIndex,
        lastStudiedAt,
        firstStudiedAt,
        topics: updatedTopics
    };
};

/**
 * Scans the entire Knowledge Base and ensures visual states match the log data.
 * Returns the updated array if changes were made.
 */
export const performFullIntegrityCheck = (allEntries: KnowledgeBaseEntry[]): { updated: boolean, data: KnowledgeBaseEntry[] } => {
    let hasChanges = false;
    
    const fixedEntries = allEntries.map(entry => {
        const recalculated = recalculateEntryStats(entry);
        
        // Simple check to see if anything changed logic-wise
        const changed = 
            recalculated.revisionCount !== entry.revisionCount ||
            recalculated.lastStudiedAt !== entry.lastStudiedAt ||
            recalculated.firstStudiedAt !== entry.firstStudiedAt ||
            JSON.stringify(recalculated.topics) !== JSON.stringify(entry.topics);

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
    let kbMap = new Map<string, KnowledgeBaseEntry>(currentKB.map(entry => [entry.pageNumber, JSON.parse(JSON.stringify(entry))])); // Deep copy for safety

    for (const entry of parsedEntries) {
        const pageStr = String(entry.pageNumber);
        let kbEntry = kbMap.get(pageStr);
        
        let now: Date;
        if (entry.timestamp) {
            now = new Date(entry.timestamp);
        } else if (entry.date) {
            now = new Date(entry.date + 'T12:00:00');
        } else {
            now = new Date();
        }
        
        const nowISO = now.toISOString();

        if (!kbEntry) {
            kbEntry = {
                pageNumber: pageStr,
                title: `First Aid Page ${pageStr}`,
                subject: 'Uncategorized',
                system: 'Uncategorized',
                revisionCount: 0,
                firstStudiedAt: null,
                lastStudiedAt: null,
                nextRevisionAt: null,
                currentRevisionIndex: 0,
                ankiTotal: 0,
                ankiCovered: 0,
                videoLinks: [],
                tags: [],
                notes: '',
                logs: [],
                topics: [],
                attachments: []
            };
        }

        // Determine Event Type
        const hasPreviousLogs = kbEntry.logs.length > 0;
        const eventType = entry.isExplicitRevision || hasPreviousLogs ? 'REVISION' : 'STUDY';

        // Topic Association Logic & Subtopic SRS
        if (entry.topics.length > 0) {
            if (!kbEntry.title || kbEntry.title.startsWith('First Aid Page')) {
                kbEntry.title = entry.topics[0];
            }

            const sessionTopicNames = new Set(entry.topics.map(t => t.trim()));
            
            kbEntry.topics = kbEntry.topics.map(t => {
                if (sessionTopicNames.has(t.name.trim())) {
                    const currentRev = t.revisionCount || 0;
                    const newRevCount = eventType === 'REVISION' ? currentRev + 1 : currentRev;
                    const nextIndex = eventType === 'REVISION' ? currentRev : 0;

                    const nextDate = calculateNextRevisionDate(now, nextIndex, revisionSettings);
                    
                    return {
                        ...t,
                        revisionCount: newRevCount,
                        currentRevisionIndex: nextIndex, 
                        lastStudiedAt: nowISO, 
                        nextRevisionAt: nextDate ? nextDate.toISOString() : null
                    };
                }
                return t;
            });

            entry.topics.forEach(topicName => {
                const cleanName = topicName.trim();
                const exists = kbEntry!.topics.some(t => t.name.trim() === cleanName);
                if (!exists) {
                    const nextDate = calculateNextRevisionDate(now, 0, revisionSettings);
                    const newTopic: TrackableItem = {
                        id: generateId(),
                        name: cleanName,
                        revisionCount: 0, 
                        lastStudiedAt: nowISO,
                        nextRevisionAt: nextDate ? nextDate.toISOString() : null,
                        currentRevisionIndex: 0,
                        logs: []
                    };
                    kbEntry!.topics.push(newTopic);
                }
            });
        }
        
        if (entry.attachment) {
            if (!kbEntry.attachments) {
                kbEntry.attachments = [];
            }
            if (!kbEntry.attachments.some(a => a.id === entry.attachment!.id)) {
                kbEntry.attachments.push(entry.attachment);
            }
        }
        
        let earliestNextRev: string | null = null;
        kbEntry.topics.forEach(t => {
            if (t.nextRevisionAt) {
                if (!earliestNextRev || new Date(t.nextRevisionAt) < new Date(earliestNextRev)) {
                    earliestNextRev = t.nextRevisionAt;
                }
            }
        });

        // Calculate Page Level Revision Logic
        // If STUDY: index stays 0. If REVISION: increment index.
        const newRevIndex = eventType === 'STUDY' ? 0 : kbEntry.currentRevisionIndex + 1;
        
        const newLog: RevisionLog = {
            id: generateId(),
            timestamp: nowISO,
            revisionIndex: newRevIndex,
            type: eventType,
            topics: entry.topics,
            source: 'MODAL'
        };

        const updatedLogs = [...kbEntry.logs, newLog];
        // Only count logs that are strictly revisions
        const newRevisionCount = updatedLogs.filter(l => l.type === 'REVISION').length;
        
        const genericNextRev = calculateNextRevisionDate(now, newRevIndex, revisionSettings);

        const updatedEntry: KnowledgeBaseEntry = {
            ...kbEntry,
            logs: updatedLogs,
            revisionCount: newRevisionCount,
            currentRevisionIndex: newRevIndex,
            lastStudiedAt: nowISO,
            firstStudiedAt: kbEntry.firstStudiedAt || nowISO,
            nextRevisionAt: earliestNextRev || (genericNextRev ? genericNextRev.toISOString() : null),
        };
        
        let confirmationMessage = '';
        if (eventType === 'STUDY') {
            confirmationMessage = `Logged pg ${pageStr} as first-time STUDY. 📝`;
        } else {
            const suffix = ['st','nd','rd'][newRevisionCount-1] || 'th';
            confirmationMessage = `Logged pg ${pageStr} as REVISION. This is your ${newRevisionCount}${suffix} revision. 🔁`;
        }

        const timeDisplay = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        confirmationMessage += ` at ${timeDisplay}`;

        results.push({
            pageNumber: entry.pageNumber,
            eventType,
            newRevisionCount: updatedEntry.revisionCount,
            confirmationMessage,
            updatedEntry,
        });

        kbMap.set(pageStr, updatedEntry);
    }
    
    return { results, updatedKB: Array.from(kbMap.values()) };
};
