

// components/FALoggerView.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { KnowledgeBaseEntry, RevisionLog, getAdjustedDate, Attachment, TimeLogEntry, RevisionSettings, TrackableItem, FALogData, ViewStates } from '../types';
import { ListCheckIcon, PaperAirplaneIcon, SparklesIcon, PaperClipIcon, XMarkIcon, DocumentIcon, BarsArrowUpIcon, BarsArrowDownIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon, CalendarIcon, PencilSquareIcon, PlusIcon, BookOpenIcon, ArrowPathIcon } from './Icons';
import { parseFALoggerInput, processLogEntries, ParsedLogEntry, recalculateEntryStats } from '../services/faLoggerService';
import { RevisionHistoryModal } from './RevisionHistoryModal';
import { PageBadge } from './PageBadge';
import { extractTextFromMedia, summarizeTextToTopics, parseTimeLogRequest } from '../services/geminiService';
import { uploadFile, getRevisionSettings } from '../services/firebase';
import { saveTimeLog } from '../services/timeLogService';
import { calculateNextRevisionDate } from '../services/srsService';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { FALogModal } from './FALogModal';

interface FALoggerViewProps {
    knowledgeBase: KnowledgeBaseEntry[];
    onUpdateKnowledgeBase: (newKB: KnowledgeBaseEntry[]) => Promise<void>;
    onViewPage: (pageNumber: string) => void;
    faState: ViewStates['fa'];
    setFaState: React.Dispatch<React.SetStateAction<ViewStates['fa']>>;
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

// Helper from KnowledgeBaseView
const calculatePageProgress = (entry: KnowledgeBaseEntry): number => {
    if (entry.topics && entry.topics.length > 0) {
        const completedTopics = entry.topics.filter(t => t.lastStudiedAt !== null).length;
        return (completedTopics / entry.topics.length) * 100;
    }
    return entry.lastStudiedAt !== null ? 100 : 0;
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
    onEditLog: (log: any) => void; // Added Edit Handler
    onViewPage: (pageNumber: string) => void;
    onViewHistory: (kbEntry: KnowledgeBaseEntry) => void;
}

const LogTable: React.FC<LogTableProps> = ({ title, logs, isRevisionTable = false, swipedLogId, setSwipedLogId, onDeleteLog, onEditLog, onViewPage, onViewHistory }) => {
    const touchStartRef = useRef<{ x: number, y: number, logId: string } | null>(null);

    // Touch Handlers (Swipe logic omitted for brevity, same as original)
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
                <div className="col-span-2">Page</div>
                <div className="col-span-6 text-left pl-2">Topic & Subtopics</div>
                <div className="col-span-4 text-right">Time (Dur)</div>
            </div>

            <div className="space-y-3">
                {logs.length > 0 ? logs.map(log => {
                    const startDate = new Date(log.timestamp);
                    const endDate = new Date(startDate.getTime() + (log.durationMinutes || 30) * 60000);
                    const startStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const endStr = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const durStr = log.durationMinutes ? `${log.durationMinutes}m` : '--';
                    const progress = calculatePageProgress(log.kbEntry);

                    return (
                        <div key={log.id} className="relative w-full select-none overflow-hidden rounded-2xl group">
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
                                className="relative z-10 w-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-md shadow-sm border border-white/40 dark:border-slate-700/50 p-4 flex items-center min-h-[5rem] cursor-grab active:cursor-grabbing"
                                style={{ 
                                    transform: swipedLogId === log.id ? 'translateX(-96px)' : 'translateX(0px)' 
                                }}
                                onTouchStart={(e) => handleTouchStart(e, log.id)}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                                onClick={() => {
                                    if (swipedLogId === log.id) setSwipedLogId(null);
                                    else onEditLog(log);
                                }}
                            >
                                <div className="grid grid-cols-12 w-full items-center gap-3 pointer-events-none">
                                    {/* Page Badge - Left */}
                                    <div className="col-span-2 flex flex-col items-start justify-center pointer-events-auto">
                                        <PageBadge 
                                            pageNumber={log.pageNumber} 
                                            attachments={log.kbEntry.attachments} 
                                            revisionCount={log.kbEntry.revisionCount} 
                                            progress={progress}
                                            onClick={() => onViewPage(log.pageNumber)} 
                                            className="shadow-sm scale-90 origin-left"
                                        />
                                    </div>

                                    {/* Topic & Subtopics - Middle */}
                                    <div className="col-span-6 flex flex-col justify-center">
                                        <p className="text-sm font-bold text-slate-800 dark:text-white line-clamp-2 leading-tight">
                                            {log.title.startsWith('First Aid Page') ? 'General Study' : log.title}
                                        </p>
                                        {log.topics && log.topics.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {log.topics.map((t: string, i: number) => (
                                                    <span key={i} className="text-[10px] text-slate-600 dark:text-slate-300 bg-slate-100/50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded border border-slate-200/50 dark:border-slate-600/50 backdrop-blur-sm">
                                                        {t}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Time & Duration - Right */}
                                    <div className="col-span-4 flex flex-col justify-center text-right">
                                        <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{startStr} - {endStr}</span>
                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{durStr}</span>
                                        {isRevisionTable && (
                                            <span className="mt-1 inline-block text-[9px] font-bold text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded w-fit self-end border border-indigo-100/50 dark:border-indigo-800/50">
                                                Rev #{log.revisionIndex}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="p-8 text-center border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-2xl">
                        <p className="text-slate-400 text-sm italic">No activity recorded.</p>
                    </div>
                )}
            </div>
        </div>
    );
}


export const FALoggerView: React.FC<FALoggerViewProps> = ({ knowledgeBase, onUpdateKnowledgeBase, onViewPage, faState, setFaState }) => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<LogMessage[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const todayStr = getAdjustedDate(new Date());

    const [selectedDate, setSelectedDate] = useState(getAdjustedDate(new Date()));

    const [viewingHistoryForPage, setViewingHistoryForPage] = useState<KnowledgeBaseEntry | null>(null);
    
    const [logToDelete, setLogToDelete] = useState<any | null>(null);

    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
    
    const [pendingLogEntry, setPendingLogEntry] = useState<ParsedLogEntry | null>(null);

    const [sortKey, setSortKey] = useState<SortKey>('time');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    
    const [swipedLogId, setSwipedLogId] = useState<string | null>(null);
    const [revisionSettings, setRevisionSettings] = useState<RevisionSettings>({ mode: 'balanced', targetCount: 7 });

    // Modal State handled by parent props (faState)
    const { isLogModalOpen, modalMode, draftLog, logToEdit } = faState;

    useEffect(() => {
        getRevisionSettings().then(settings => {
            if(settings) setRevisionSettings(settings);
        });
    }, []);

    const dateLabel = useMemo(() => {
        const today = getAdjustedDate(new Date());
        const d = new Date(today + 'T12:00:00');
        d.setDate(d.getDate() - 1);
        const yesterday = getAdjustedDate(d);
        
        if (selectedDate === today) return "Today";
        if (selectedDate === yesterday) return "Yesterday";
        return selectedDate;
    }, [selectedDate]);

    const filteredLogs = useMemo(() => knowledgeBase.flatMap(kb => 
        kb.logs.filter(log => getAdjustedDate(log.timestamp) === selectedDate).map(log => ({ ...log, pageNumber: kb.pageNumber, title: kb.title, topics: log.topics, kbEntry: kb }))
    ).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), [knowledgeBase, selectedDate]);

    const studiedList = useMemo(() => {
        const list = filteredLogs.filter(l => l.type === 'STUDY');
        return list;
    }, [filteredLogs]);
    
    const revisedList = useMemo(() => {
        const list = filteredLogs.filter(l => l.type === 'REVISION');
        return list;
    }, [filteredLogs]);
    
    const handleDateChange = (offset: number) => {
        const d = new Date(selectedDate + 'T12:00:00');
        d.setDate(d.getDate() + offset);
        setSelectedDate(getAdjustedDate(d));
    };

    // --- EDIT HANDLER ---
    const handleEditLog = (log: any) => {
        const startDate = new Date(log.timestamp);
        const endDate = new Date(startDate.getTime() + (log.durationMinutes || 30) * 60000);
        
        const startTime = startDate.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'});
        const endTime = endDate.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'});
        
        const editData: FALogData = {
            logId: log.id,
            pageNumber: log.pageNumber,
            date: getAdjustedDate(startDate),
            startTime,
            endTime,
            notes: log.notes || '',
            selectedTopics: log.topics || []
        };

        setFaState(prev => ({
            ...prev,
            isLogModalOpen: true,
            logToEdit: editData,
            modalMode: log.type,
            draftLog: null // Clear draft when editing
        }));
    };

    const handleOpenNewLog = (mode: 'STUDY' | 'REVISION') => {
        setFaState(prev => ({
            ...prev,
            isLogModalOpen: true,
            logToEdit: null,
            draftLog: null, // Explicitly clear draft to ensure fresh time calculation
            modalMode: mode
        }));
    }

    const handleCloseModal = () => {
        setFaState(prev => ({ ...prev, isLogModalOpen: false, logToEdit: null }));
    };

    // --- MODAL SAVE HANDLER ---
    const handleSaveModalLog = async (data: FALogData) => {
        // Construct Full Timestamp for accuracy
        const newStart = new Date(`${data.date}T${data.startTime}:00`);
        let newEnd = new Date(`${data.date}T${data.endTime}:00`);
        if (newEnd < newStart) newEnd.setDate(newEnd.getDate() + 1); // Handle midnight
        const duration = Math.round((newEnd.getTime() - newStart.getTime()) / 60000);

        // Note: We pass the user-selected mode implicitly by calling processLogEntries with isExplicitRevision
        // If the user manually toggled 'Revision' in the modal, modalMode will be 'REVISION'.
        const isExplicitRevision = modalMode === 'REVISION';

        const entry: ParsedLogEntry = {
            pageNumber: parseInt(data.pageNumber),
            isExplicitRevision: isExplicitRevision, 
            topics: data.selectedTopics,
            date: data.date,
            timestamp: newStart.toISOString() // Pass exact time!
        };

        if (data.logId) {
            // UPDATE EXISTING
            let updatedKB = [...knowledgeBase];
            const kbIndex = updatedKB.findIndex(k => k.pageNumber === data.pageNumber);
            
            if (kbIndex !== -1) {
                const kbEntry = updatedKB[kbIndex];
                const logIndex = kbEntry.logs.findIndex(l => l.id === data.logId);
                
                if (logIndex !== -1) {
                    const oldLog = kbEntry.logs[logIndex];
                    
                    const updatedLog: RevisionLog = {
                        ...oldLog,
                        timestamp: newStart.toISOString(),
                        durationMinutes: duration,
                        notes: data.notes,
                        topics: data.selectedTopics,
                        type: isExplicitRevision ? 'REVISION' : 'STUDY' // Allow switching type on edit
                    };
                    
                    const newLogs = [...kbEntry.logs];
                    newLogs[logIndex] = updatedLog;
                    
                    updatedKB[kbIndex] = { ...kbEntry, logs: newLogs };
                    
                    // Recalculate stats with settings to fix schedule
                    const finalizedEntry = recalculateEntryStats(updatedKB[kbIndex], revisionSettings);
                    updatedKB[kbIndex] = finalizedEntry;

                    await onUpdateKnowledgeBase(updatedKB);
                }
            }
        } else {
            // CREATE NEW
            const { results, updatedKB } = processLogEntries([entry], knowledgeBase, revisionSettings);
            
            // Update timestamp/duration for the newly created log
            const result = results[0];
            const createdKbEntry = updatedKB.find(k => k.pageNumber === String(entry.pageNumber));
            
            if (createdKbEntry) {
                const latestLog = createdKbEntry.logs[createdKbEntry.logs.length - 1];
                
                latestLog.timestamp = newStart.toISOString();
                latestLog.durationMinutes = duration;
                latestLog.notes = data.notes;
                
                await onUpdateKnowledgeBase(updatedKB);
                
                await saveTimeLog({
                    id: generateId(),
                    date: data.date,
                    startTime: newStart.toISOString(),
                    endTime: newEnd.toISOString(),
                    durationMinutes: duration,
                    activity: `${result.eventType === 'REVISION' ? 'Revised' : 'Studied'} FA Pg ${entry.pageNumber}`,
                    category: result.eventType,
                    source: 'FA_LOGGER',
                    pageNumber: entry.pageNumber,
                    linkedEntityId: latestLog.id
                });
            }
        }
        
        // Clear draft after successful save
        setFaState(prev => ({ ...prev, draftLog: null }));
    };

    // Function to handle deleting a log from within the Modal (passed as prop)
    const handleDeleteLogFromModal = async (logId: string, pageNumber: string) => {
        const kbEntry = knowledgeBase.find(kb => kb.pageNumber === pageNumber);
        if (kbEntry) {
            const remainingLogs = kbEntry.logs.filter(l => l.id !== logId);
            const tempEntry = { ...kbEntry, logs: remainingLogs };
            
            // Recalculate with settings to fix schedule
            const updatedEntry = recalculateEntryStats(tempEntry, revisionSettings);
            
            const newKB = knowledgeBase.map(kb => (kb.pageNumber === pageNumber ? updatedEntry : kb));
            await onUpdateKnowledgeBase(newKB);
        }
    };

    const requestDelete = (log: any) => {
        setLogToDelete(log);
    };

    const executeDelete = async () => {
        if (!logToDelete) return;
        const log = logToDelete;
        // Use the same logic as the modal delete
        await handleDeleteLogFromModal(log.id, log.pageNumber);
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

            <FALogModal 
                isOpen={isLogModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveModalLog}
                knowledgeBase={knowledgeBase}
                initialData={logToEdit || draftLog} // Use draft if not editing specific log
                mode={modalMode}
                onDeletePastLog={handleDeleteLogFromModal}
                onStateChange={(data) => setFaState(prev => ({ ...prev, draftLog: data }))} // Update draft in real-time
            />

            <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-100/50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl backdrop-blur-sm">
                    <ListCheckIcon className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">FA Page Logger</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Log studied and revised First Aid pages.</p>
                </div>
            </div>

            {/* Main Actions */}
            <div className="grid grid-cols-2 gap-4">
                <button 
                    onClick={() => handleOpenNewLog('STUDY')}
                    className="p-5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-sm border border-white/40 dark:border-slate-700/50 flex flex-col items-center gap-3 hover:border-indigo-300 hover:shadow-md transition-all group"
                >
                    <div className="w-12 h-12 rounded-full bg-indigo-50/50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform backdrop-blur-sm">
                        <BookOpenIcon className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                        <h3 className="font-bold text-slate-800 dark:text-white">Study Today</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Log new material</p>
                    </div>
                </button>

                <button 
                    onClick={() => handleOpenNewLog('REVISION')}
                    className="p-5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-sm border border-white/40 dark:border-slate-700/50 flex flex-col items-center gap-3 hover:border-amber-300 hover:shadow-md transition-all group"
                >
                    <div className="w-12 h-12 rounded-full bg-amber-50/50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform backdrop-blur-sm">
                        <ArrowPathIcon className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                        <h3 className="font-bold text-slate-800 dark:text-white">Revise Today</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Log revisions</p>
                    </div>
                </button>
            </div>

            {/* Date Switcher */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 bg-slate-50/50 dark:bg-slate-800/50 p-2 rounded-2xl border border-white/40 dark:border-slate-700/50 backdrop-blur-sm">
                <button onClick={() => handleDateChange(-1)} className="p-2 hover:bg-white/50 dark:hover:bg-slate-700/50 rounded-full transition-colors"><ChevronLeftIcon className="w-5 h-5 text-slate-500" /></button>
                
                <div className="relative">
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={e => setSelectedDate(e.target.value)}
                        className="bg-transparent font-bold text-slate-800 dark:text-white text-lg text-center outline-none cursor-pointer"
                    />
                </div>

                <button onClick={() => handleDateChange(1)} className="p-2 hover:bg-white/50 dark:hover:bg-slate-700/50 rounded-full transition-colors"><ChevronRightIcon className="w-5 h-5 text-slate-500" /></button>
            </div>

            {/* Restore Separate Tables */}
            <LogTable
                title={`Studied ${dateLabel}`}
                logs={studiedList}
                swipedLogId={swipedLogId}
                setSwipedLogId={setSwipedLogId}
                onDeleteLog={requestDelete}
                onEditLog={handleEditLog}
                onViewPage={onViewPage}
                onViewHistory={(entry) => setViewingHistoryForPage(entry)}
            />

            <LogTable
                title={`Revised ${dateLabel}`}
                logs={revisedList}
                isRevisionTable={true}
                swipedLogId={swipedLogId}
                setSwipedLogId={setSwipedLogId}
                onDeleteLog={requestDelete}
                onEditLog={handleEditLog}
                onViewPage={onViewPage}
                onViewHistory={(entry) => setViewingHistoryForPage(entry)}
            />
        </div>
    );
};
