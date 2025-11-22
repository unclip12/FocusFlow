
// components/FALoggerView.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { KnowledgeBaseEntry, RevisionLog, getAdjustedDate, Attachment, TimeLogEntry, RevisionSettings } from '../types';
import { ListCheckIcon, PaperAirplaneIcon, SparklesIcon, PaperClipIcon, XMarkIcon, DocumentIcon, BarsArrowUpIcon, BarsArrowDownIcon, TrashIcon } from './Icons';
import { parseFALoggerInput, processLogEntries, ParsedLogEntry } from '../services/faLoggerService';
import { RevisionHistoryModal } from './RevisionHistoryModal';
import { PageBadge } from './PageBadge';
import { extractTextFromMedia, summarizeTextToTopics, parseTimeLogRequest } from '../services/geminiService';
import { uploadFile, getRevisionSettings } from '../services/firebase';
import { saveTimeLog } from '../services/timeLogService';
import { calculateNextRevisionDate } from '../services/srsService';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface FALoggerViewProps {
    knowledgeBase: KnowledgeBaseEntry[];
    onUpdateKnowledgeBase: (newKB: KnowledgeBaseEntry[]) => Promise<void>;
    onViewPage: (pageNumber: string) => void;
}

interface LogMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
}

const generateId = () => crypto.randomUUID();

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

type SortKey = 'time' | 'page' | 'topic';
type SortDirection = 'asc' | 'desc';

interface LogTableProps {
    title: string;
    logs: any[];
    isRevisionTable?: boolean;
    swipedLogId: string | null;
    setSwipedLogId: (id: string | null) => void;
    onDeleteLog: (log: any) => void;
    onViewPage: (pageNumber: string) => void;
    onViewHistory: (kbEntry: KnowledgeBaseEntry) => void;
}

const LogTable: React.FC<LogTableProps> = ({ title, logs, isRevisionTable = false, swipedLogId, setSwipedLogId, onDeleteLog, onViewPage, onViewHistory }) => {
    const touchStartRef = useRef<{ x: number, y: number, logId: string } | null>(null);

    // Touch Handlers
    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>, logId: string) => {
        if (swipedLogId && swipedLogId !== logId) {
            setSwipedLogId(null);
        }
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, logId };
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (!touchStartRef.current) return;
        const deltaX = e.touches[0].clientX - touchStartRef.current.x;
        const deltaY = e.touches[0].clientY - touchStartRef.current.y;
        
        if (Math.abs(deltaX) > Math.abs(deltaY) + 5) {
             const newX = Math.min(0, Math.max(-120, deltaX)); 
             if (newX < 0) {
                 e.currentTarget.style.transform = `translateX(${newX}px)`;
                 e.currentTarget.style.transition = 'none';
             }
        }
    };

    const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
        if (!touchStartRef.current) return;
        const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
        finishSwipe(e.currentTarget, deltaX, touchStartRef.current.logId);
        touchStartRef.current = null;
    };

    // Mouse Handlers (Desktop Swipe)
    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, logId: string) => {
        if (swipedLogId && swipedLogId !== logId) {
            setSwipedLogId(null);
        }
        touchStartRef.current = { x: e.clientX, y: e.clientY, logId };
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!touchStartRef.current) return;
        if (e.buttons !== 1) { // Ensure left click is held
             touchStartRef.current = null;
             return;
        }
        const deltaX = e.clientX - touchStartRef.current.x;
        const deltaY = e.clientY - touchStartRef.current.y;
        
        if (Math.abs(deltaX) > Math.abs(deltaY) + 5) {
             const newX = Math.min(0, Math.max(-120, deltaX)); 
             if (newX < 0) {
                 e.currentTarget.style.transform = `translateX(${newX}px)`;
                 e.currentTarget.style.transition = 'none';
             }
        }
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!touchStartRef.current) return;
        const deltaX = e.clientX - touchStartRef.current.x;
        finishSwipe(e.currentTarget, deltaX, touchStartRef.current.logId);
        touchStartRef.current = null;
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!touchStartRef.current) return;
        const deltaX = e.clientX - touchStartRef.current.x;
        finishSwipe(e.currentTarget, deltaX, touchStartRef.current.logId);
        touchStartRef.current = null;
    };

    const finishSwipe = (element: HTMLDivElement, deltaX: number, logId: string) => {
        element.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
        if (deltaX < -50) { // Threshold to snap open
            setSwipedLogId(logId);
            element.style.transform = `translateX(-96px)`;
        } else {
            setSwipedLogId(null);
            element.style.transform = `translateX(0px)`;
        }
    };
    
    return (
        <div className="mb-6">
            <h3 className="font-bold text-slate-800 dark:text-white mb-3 text-lg px-1 flex items-center gap-2">
                {title} <span className="text-slate-400 text-sm font-normal bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">({logs.length})</span>
            </h3>
            
            <div className="grid grid-cols-12 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-2 px-4 select-none">
                <div className="col-span-3">Page</div>
                <div className="col-span-5">Topic</div>
                {isRevisionTable && <div className="col-span-2 text-center">Rev #</div>}
                <div className={`text-right ${isRevisionTable ? 'col-span-2' : 'col-span-4'}`}>Time</div>
            </div>

            <div className="space-y-3">
                {logs.length > 0 ? logs.map(log => (
                    <div key={log.id} className="relative w-full select-none overflow-hidden rounded-2xl">
                        {/* Delete Action Background */}
                        <div className="absolute inset-y-0 right-0 w-24 flex items-center justify-center bg-red-500 z-0 cursor-pointer active:bg-red-600 transition-colors"
                             onClick={(e) => {
                                 e.stopPropagation();
                                 onDeleteLog(log);
                             }}
                        >
                            <TrashIcon className="w-6 h-6 text-white" />
                        </div>

                        {/* Foreground Content */}
                        <div
                            className="relative z-10 w-full bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 p-4 flex items-center min-h-[5rem] cursor-grab active:cursor-grabbing"
                            style={{ 
                                transform: swipedLogId === log.id ? 'translateX(-96px)' : 'translateX(0px)' 
                            }}
                            onTouchStart={(e) => handleTouchStart(e, log.id)}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            onMouseDown={(e) => handleMouseDown(e, log.id)}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseLeave}
                            onClick={() => {
                                if (swipedLogId === log.id) setSwipedLogId(null);
                            }}
                        >
                            <div className="grid grid-cols-12 w-full items-center gap-3 pointer-events-none">
                                <div className="col-span-3 pointer-events-auto">
                                    <PageBadge 
                                        pageNumber={log.pageNumber} 
                                        attachments={log.kbEntry.attachments} 
                                        revisionCount={log.kbEntry.revisionCount} 
                                        onClick={() => onViewPage(log.pageNumber)} 
                                        className="shadow-sm scale-90 origin-left"
                                    />
                                </div>
                                <div className="col-span-5">
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 line-clamp-2 leading-tight">
                                        {log.title.startsWith('First Aid Page') ? 'No topic yet' : log.title}
                                    </p>
                                    {log.subtopics && log.subtopics.length > 0 && (
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{log.subtopics.join(', ')}</p>
                                    )}
                                </div>
                                {isRevisionTable ? (
                                    <>
                                        <div className="col-span-2 text-center pointer-events-auto">
                                            <button onClick={() => onViewHistory(log.kbEntry)} className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded hover:bg-indigo-100 transition-colors">
                                                #{log.revisionIndex}
                                            </button>
                                        </div>
                                        <div className="col-span-2 text-right text-xs font-mono text-slate-400 dark:text-slate-500">
                                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </>
                                ) : (
                                    <div className="col-span-4 text-right text-xs font-mono text-slate-400 dark:text-slate-500">
                                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="p-8 text-center border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-2xl">
                        <p className="text-slate-400 text-sm italic">No activity recorded.</p>
                    </div>
                )}
            </div>
        </div>
    );
}


export const FALoggerView: React.FC<FALoggerViewProps> = ({ knowledgeBase, onUpdateKnowledgeBase, onViewPage }) => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<LogMessage[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const todayStr = getAdjustedDate(new Date());

    const [viewingHistoryForPage, setViewingHistoryForPage] = useState<KnowledgeBaseEntry | null>(null);
    
    const [logToDelete, setLogToDelete] = useState<any | null>(null);

    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
    
    const [pendingLogEntry, setPendingLogEntry] = useState<ParsedLogEntry | null>(null);
    const [pendingDurationContext, setPendingDurationContext] = useState<{ pages: string[] } | null>(null);

    const [sortKey, setSortKey] = useState<SortKey>('time');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    
    const [swipedLogId, setSwipedLogId] = useState<string | null>(null);
    const [revisionSettings, setRevisionSettings] = useState<RevisionSettings>({ mode: 'balanced', targetCount: 7 });

    useEffect(() => {
        getRevisionSettings().then(settings => {
            if(settings) setRevisionSettings(settings);
        });
    }, []);

    const todaysLogs = useMemo(() => knowledgeBase.flatMap(kb => 
        kb.logs.filter(log => getAdjustedDate(log.timestamp) === todayStr).map(log => ({ ...log, pageNumber: kb.pageNumber, title: kb.title, subtopics: (kb.topics || []).map(t => t.name), kbEntry: kb }))
    ).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), [knowledgeBase, todayStr]);

    const studiedToday = useMemo(() => {
        const pageMap = new Map<string, any>();
        todaysLogs.filter(l => l.type === 'STUDY').forEach(log => {
            if (!pageMap.has(log.pageNumber)) {
                pageMap.set(log.pageNumber, log);
            }
        });
        const list = Array.from(pageMap.values());

        list.sort((a, b) => {
            let comparison = 0;
            switch (sortKey) {
                case 'page':
                    comparison = parseInt(a.pageNumber) - parseInt(b.pageNumber);
                    break;
                case 'topic':
                    const topicA = a.title.startsWith('First Aid Page ') ? 'Ω' : a.title;
                    const topicB = b.title.startsWith('First Aid Page ') ? 'Ω' : b.title;
                    comparison = topicA.localeCompare(topicB);
                    break;
                case 'time':
                default:
                    comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
                    break;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
        return list;
    }, [todaysLogs, sortKey, sortDirection]);
    
    const revisedToday = useMemo(() => {
        const pageMap = new Map<string, any>();
        todaysLogs.filter(l => l.type === 'REVISION').forEach(log => {
            const existing = pageMap.get(log.pageNumber);
            if (!existing || new Date(log.timestamp) > new Date(existing.timestamp)) {
                pageMap.set(log.pageNumber, log);
            }
        });
        const list =  Array.from(pageMap.values());

        list.sort((a, b) => {
            let comparison = 0;
            switch (sortKey) {
                case 'page':
                    comparison = parseInt(a.pageNumber) - parseInt(b.pageNumber);
                    break;
                case 'topic':
                    const topicA = a.title.startsWith('First Aid Page ') ? 'Ω' : a.title;
                    const topicB = b.title.startsWith('First Aid Page ') ? 'Ω' : b.title;
                    comparison = topicA.localeCompare(topicB);
                    break;
                case 'time':
                default:
                    comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
                    break;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });

        return list;
    }, [todaysLogs, sortKey, sortDirection]);
    
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAttachedFile(file);
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onloadend = () => setAttachmentPreview(reader.result as string);
                reader.readAsDataURL(file);
            } else {
                setAttachmentPreview('pdf');
            }
        }
    };
    
    const removeAttachment = () => {
        setAttachedFile(null);
        setAttachmentPreview(null);
    };

    const handleLog = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
    
        // 1. Handle Pending Duration (Missing Time for previous log)
        if (pendingDurationContext) {
            if (!input.trim()) { setIsProcessing(false); return; }
            
            const userMessage: LogMessage = { id: generateId(), role: 'user', text: input };
            setMessages(prev => [...prev, userMessage]);
            setInput('');

            const nowISO = new Date().toISOString();
            const timeResult = await parseTimeLogRequest(input, nowISO);

            if (timeResult && timeResult.durationMinutes > 0) {
                const activityText = `Studied FA Pages: ${pendingDurationContext.pages.join(', ')}`;
                const newTimeLog: TimeLogEntry = {
                    id: generateId(),
                    date: todayStr,
                    startTime: timeResult.startTime,
                    endTime: timeResult.endTime,
                    durationMinutes: timeResult.durationMinutes,
                    activity: activityText,
                    category: 'STUDY',
                    source: 'FA_LOGGER'
                };
                await saveTimeLog(newTimeLog);
                setMessages(prev => [...prev, { id: generateId(), role: 'model', text: `Logged time: ${Math.round(timeResult.durationMinutes)} mins.` }]);
            } else {
                setMessages(prev => [...prev, { id: generateId(), role: 'model', text: "Couldn't capture time. Moving on." }]);
            }
            
            setPendingDurationContext(null);
            setIsProcessing(false);
            return;
        }

        // 2. Handle Pending Topic/Page Confirmation (From Image Extraction)
        if (pendingLogEntry) {
            if (!input.trim()) { setIsProcessing(false); return; }
            const userMessage: LogMessage = { id: generateId(), role: 'user', text: input };
            setMessages(prev => [...prev, userMessage]);
            
            let entryWithTopic: ParsedLogEntry = { ...pendingLogEntry };

            // Check if we were waiting for a page number (because it was 0)
            if (pendingLogEntry.pageNumber === 0) {
                // Try to extract page number from input
                const pageMatch = input.match(/\d+/);
                if (pageMatch) {
                    entryWithTopic.pageNumber = parseInt(pageMatch[0]);
                    // If the input was just the number, we keep the AI extracted topics.
                    // If input has more text, we could potentially append it, but let's stick to simple correction for now.
                } else {
                    setMessages(prev => [...prev, { id: generateId(), role: 'model', text: "I still need a page number. Please type just the number." }]);
                    setIsProcessing(false);
                    return;
                }
            } else {
                // We were waiting for topics (page was known, but no topics found)
                const topicsFromReply = input.split(/, | and /).map(t => t.trim()).filter(Boolean);
                entryWithTopic.topics = topicsFromReply;
            }
    
            const { results, updatedKB } = processLogEntries([entryWithTopic], knowledgeBase, revisionSettings);
            await onUpdateKnowledgeBase(updatedKB);
    
            const modelMessage: LogMessage = { id: generateId(), role: 'model', text: results[0].confirmationMessage };
            setMessages(prev => [...prev, modelMessage]);
            
            // Save basic time log for this entry
            const now = new Date();
            const start = new Date(now.getTime() - 60000);
            await saveTimeLog({
                id: generateId(),
                date: todayStr,
                startTime: start.toISOString(),
                endTime: now.toISOString(),
                durationMinutes: 1,
                activity: `Studied FA Page ${entryWithTopic.pageNumber}`,
                category: 'STUDY',
                source: 'FA_LOGGER',
                pageNumber: entryWithTopic.pageNumber,
                linkedEntityId: results[0].updatedEntry.logs[results[0].updatedEntry.logs.length-1].id // Approx link
            });
    
            setPendingLogEntry(null);
            setInput('');
            setIsProcessing(false);
            return;
        }
    
        if (!input.trim() && !attachedFile) { setIsProcessing(false); return; }
    
        const displayText = input.trim() ? input : (attachedFile ? `[Attached: ${attachedFile.name}]` : '');
        const userMessage: LogMessage = { id: generateId(), role: 'user', text: displayText };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
    
        let parsedEntries = parseFALoggerInput(input);
        // If no text input, but file attached, create a dummy entry to trigger AI processing
        if (parsedEntries.length === 0 && attachedFile) {
            parsedEntries.push({ pageNumber: 0, isExplicitRevision: false, topics: [] });
        }
    
        if (parsedEntries.length === 0) {
            setMessages(prev => [...prev, { id: generateId(), role: 'model', text: "Please specify a page number." }]);
            setIsProcessing(false);
            return;
        }
    
        let entry = parsedEntries[0];
    
        if (attachedFile) {
            const file = attachedFile;
            setMessages(prev => [...prev, {id: generateId(), role: 'model', text: 'Analyzing attachment...'}]);
            
            try {
                const base64data = await fileToBase64(file);
                const extractedText = await extractTextFromMedia(base64data, file.type);
                const url = await uploadFile(file);
                entry.attachment = { id: generateId(), name: file.name, type: file.type.startsWith('image/') ? 'IMAGE' : 'PDF', data: url };
                
                if (extractedText) {
                    const topics = await summarizeTextToTopics(extractedText);
                    if (topics) {
                        entry.topics = [topics.topic, ...topics.subTopics].filter(Boolean);
                        // If no page number was provided in text (0), ask for it now
                        if (entry.pageNumber === 0) {
                            setMessages(prev => [...prev, { id: generateId(), role: 'model', text: "Extracted topics from file. What page number is this for?" }]);
                            setPendingLogEntry(entry);
                            setIsProcessing(false);
                            removeAttachment();
                            return;
                        }
                    }
                }
            } catch (e) {
                setMessages(prev => [...prev, { id: generateId(), role: 'model', text: "Couldn't process the attachment. Let's continue without it." }]);
            } finally {
                removeAttachment();
            }
        }
    
        // If we have page number but no topics (and no attachment provided topics)
        if (entry.topics.length === 0) {
            setPendingLogEntry(entry);
            setMessages(prev => [...prev, { id: generateId(), role: 'model', text: `What topic or section did you study on page ${entry.pageNumber}?` }]);
            setIsProcessing(false);
            return;
        }
    
        // Process Valid FA Log
        const { results, updatedKB } = processLogEntries(parsedEntries, knowledgeBase, revisionSettings);
        await onUpdateKnowledgeBase(updatedKB);
    
        const confirmationText = results.map(r => r.confirmationMessage).join('\n');
        const modelMessage: LogMessage = { id: generateId(), role: 'model', text: confirmationText };
        setMessages(prev => [...prev, modelMessage]);

        // Explicitly Save Time Log for each entry using correct timestamps
        for (const res of results) {
            // The result's updatedEntry contains the latest log at the end
            const latestLog = res.updatedEntry.logs[res.updatedEntry.logs.length - 1];
            const logDateObj = new Date(latestLog.timestamp);
            const logDateStr = getAdjustedDate(logDateObj);
            
            // Start time is timestamp, end time is timestamp + 1min placeholder
            const startTime = logDateObj;
            const endTime = new Date(startTime.getTime() + 60000);
            
            await saveTimeLog({
                id: generateId(),
                date: logDateStr,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                durationMinutes: 1, // Minimal default
                activity: `${res.eventType === 'REVISION' ? 'Revised' : 'Studied'} FA Page ${res.pageNumber}`,
                category: res.eventType,
                source: 'FA_LOGGER',
                pageNumber: res.pageNumber,
                linkedEntityId: latestLog.id
            });
        }

        setIsProcessing(false);
    };

    const requestDelete = (log: any) => {
        setLogToDelete(log);
    };

    const executeDelete = async () => {
        if (!logToDelete) return;
        
        const log = logToDelete;
        const kbEntry = knowledgeBase.find(kb => kb.pageNumber === log.pageNumber);
        
        if (kbEntry) {
            const remainingLogs = kbEntry.logs.filter(l => l.id !== log.id);
    
            if (remainingLogs.length === 0) {
                const newKB = knowledgeBase.filter(kb => kb.pageNumber !== log.pageNumber);
                await onUpdateKnowledgeBase(newKB);
            } else {
                const sortedRemainingLogs = remainingLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                const newLatestLog = sortedRemainingLogs[0];
        
                const newRevisionCount = sortedRemainingLogs.filter(l => l.type === 'REVISION').length;
                const newCurrentRevisionIndex = newLatestLog.revisionIndex;
                const newNextRevisionDate = calculateNextRevisionDate(new Date(newLatestLog.timestamp), newCurrentRevisionIndex + 1, revisionSettings);
        
                const updatedEntry: KnowledgeBaseEntry = {
                    ...kbEntry,
                    logs: sortedRemainingLogs,
                    revisionCount: newRevisionCount,
                    currentRevisionIndex: newCurrentRevisionIndex,
                    lastStudiedAt: newLatestLog.timestamp,
                    nextRevisionAt: newNextRevisionDate ? newNextRevisionDate.toISOString() : null,
                };
        
                const newKB = knowledgeBase.map(kb => (kb.pageNumber === log.pageNumber ? updatedEntry : kb));
                await onUpdateKnowledgeBase(newKB);
            }
        }
        
        setLogToDelete(null);
        setSwipedLogId(null);
    };

    return (
        <div className="animate-fade-in space-y-6 max-w-4xl mx-auto pb-20">
             {viewingHistoryForPage && (
                <RevisionHistoryModal
                    isOpen={!!viewingHistoryForPage}
                    onClose={() => setViewingHistoryForPage(null)}
                    page={viewingHistoryForPage}
                />
            )}
            
            <DeleteConfirmationModal 
                isOpen={!!logToDelete}
                onClose={() => setLogToDelete(null)}
                onConfirm={executeDelete}
                title="Delete Log Entry?"
                message="Are you sure you want to remove this study log? This action cannot be undone."
            />

            <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <ListCheckIcon className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">FA Page Logger</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Log studied and revised First Aid pages here.</p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 space-y-4">
                <div className="max-h-60 overflow-y-auto space-y-3 p-2 custom-scrollbar" ref={scrollRef}>
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`whitespace-pre-wrap max-w-[85%] rounded-xl px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200'}`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                     {isProcessing && !pendingLogEntry && <div className="text-sm text-slate-400 italic animate-pulse">Processing...</div>}
                </div>
                {attachedFile && (
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 p-2 rounded-lg border border-slate-200 dark:border-slate-600">
                        {attachmentPreview === 'pdf' ? <DocumentIcon className="w-6 h-6 text-red-400" /> : <img src={attachmentPreview || ''} className="w-8 h-8 rounded-md object-cover" />}
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{attachedFile.name}</span>
                        <button onClick={removeAttachment} className="ml-auto p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full text-slate-400">
                            <XMarkIcon className="w-4 h-4" />
                        </button>
                    </div>
                )}
                <div className="relative flex items-end gap-2">
                    <label className={`p-3 self-stretch flex items-center justify-center bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-100 ${isProcessing ? 'opacity-50' : ''}`}>
                        <PaperClipIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                        <input type="file" onChange={handleFileChange} className="hidden" disabled={isProcessing} />
                    </label>
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleLog(); } }}
                        placeholder="e.g. Studied pg 147; Yesterday revised pg 175..."
                        className="flex-1 w-full p-3 pr-12 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        rows={2}
                        disabled={isProcessing}
                    />
                    <button
                        onClick={handleLog}
                        disabled={isProcessing || (!input.trim() && !attachedFile)}
                        className="absolute right-2 bottom-2 p-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50 transition-all"
                    >
                        {isProcessing ? <SparklesIcon className="w-5 h-5 animate-pulse" /> : <PaperAirplaneIcon className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            <div>
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">Today's FA Activity ({todayStr})</h3>
                    <div className="flex items-center gap-2 self-end sm:self-center">
                        <select
                            value={sortKey}
                            onChange={(e) => setSortKey(e.target.value as SortKey)}
                            className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1 text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                            aria-label="Sort by"
                        >
                            <option value="time">Sort by Time</option>
                            <option value="page">Sort by Page</option>
                            <option value="topic">Sort by Topic</option>
                        </select>
                        <button
                            onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
                            className="p-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-slate-500 dark:text-slate-400"
                            aria-label={sortDirection === 'asc' ? 'Sort ascending' : 'Sort descending'}
                        >
                            {sortDirection === 'asc' ? <BarsArrowUpIcon className="w-4 h-4" /> : <BarsArrowDownIcon className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <LogTable title="Studied Today" logs={studiedToday} swipedLogId={swipedLogId} setSwipedLogId={setSwipedLogId} onDeleteLog={requestDelete} onViewPage={onViewPage} onViewHistory={setViewingHistoryForPage} />
                    <LogTable title="Revised Today" logs={revisedToday} isRevisionTable={true} swipedLogId={swipedLogId} setSwipedLogId={setSwipedLogId} onDeleteLog={requestDelete} onViewPage={onViewPage} onViewHistory={setViewingHistoryForPage} />
                </div>
            </div>
        </div>
    );
};
