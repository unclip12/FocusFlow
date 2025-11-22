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

export const processLogEntries = (parsedEntries: ParsedLogEntry[], currentKB: KnowledgeBaseEntry[], revisionSettings: RevisionSettings): { results: LogResult[], updatedKB: KnowledgeBaseEntry[] } => {
    const results: LogResult[] = [];
    let kbMap = new Map<string, KnowledgeBaseEntry>(currentKB.map(entry => [entry.pageNumber, JSON.parse(JSON.stringify(entry))])); // Deep copy for safety

    for (const entry of parsedEntries) {
        const pageStr = String(entry.pageNumber);
        let kbEntry = kbMap.get(pageStr);
        const now = entry.date ? new Date(entry.date + 'T12:00:00') : new Date(); // Use provided date or now
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

        // Topic Association Logic
        if (entry.topics.length > 0) {
            if (!kbEntry.title || kbEntry.title.startsWith('First Aid Page')) {
                kbEntry.title = entry.topics[0];
            }
            const existingTopicNames = new Set(kbEntry.topics.map(t => t.name));
            entry.topics.forEach(topicName => {
                if (!existingTopicNames.has(topicName)) {
                    const newTopic: TrackableItem = {
                        id: generateId(),
                        name: topicName,
                        revisionCount: 0,
                        lastStudiedAt: null,
                        nextRevisionAt: null,
                        currentRevisionIndex: 0,
                        logs: []
                    };
                    kbEntry.topics.push(newTopic);
                }
            });
        }
        
        // Attachment handling
        if (entry.attachment) {
            if (!kbEntry.attachments) {
                kbEntry.attachments = [];
            }
            if (!kbEntry.attachments.some(a => a.id === entry.attachment!.id)) {
                kbEntry.attachments.push(entry.attachment);
            }
        }
        
        const hasPreviousLogs = kbEntry.logs.length > 0;
        const eventType = entry.isExplicitRevision || hasPreviousLogs ? 'REVISION' : 'STUDY';

        const newLog: RevisionLog = {
            id: generateId(),
            timestamp: nowISO,
            revisionIndex: eventType === 'STUDY' ? 0 : kbEntry.currentRevisionIndex + 1,
            type: eventType,
            topics: entry.topics,
            source: 'MODAL'
        };

        const updatedLogs = [...kbEntry.logs, newLog];
        const newRevisionIndex = eventType === 'STUDY' ? 0 : kbEntry.currentRevisionIndex + 1;
        const newRevisionCount = updatedLogs.filter(l => l.type === 'REVISION').length;

        const updatedEntry: KnowledgeBaseEntry = {
            ...kbEntry,
            logs: updatedLogs,
            revisionCount: newRevisionCount,
            currentRevisionIndex: newRevisionIndex,
            lastStudiedAt: nowISO,
            firstStudiedAt: kbEntry.firstStudiedAt || nowISO,
            nextRevisionAt: calculateNextRevisionDate(now, newRevisionIndex, revisionSettings)?.toISOString() || null,
        };
        
        let confirmationMessage = '';
        if (eventType === 'STUDY') {
            confirmationMessage = `Logged pg ${pageStr} as first-time STUDY. 📝`;
        } else {
            const suffix = ['st','nd','rd'][newRevisionCount-1] || 'th';
            confirmationMessage = `Logged pg ${pageStr} as REVISION. This is your ${newRevisionCount}${suffix} revision. 🔁`;
        }

        if(entry.date) {
            confirmationMessage += ` (for ${entry.date})`;
        }

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