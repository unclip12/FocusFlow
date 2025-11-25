import React, { useState, useMemo } from 'react';
import { KnowledgeBaseEntry, TrackableItem, getAdjustedDate, RevisionLog, RevisionItem } from '../types';
import { ArrowPathIcon, CheckCircleIcon, ChevronRightIcon, BookOpenIcon, BarsArrowUpIcon, BarsArrowDownIcon, FireIcon, ListCheckIcon, DocumentTextIcon, TrashIcon } from './Icons';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine 
} from 'recharts';
import { PageBadge } from './PageBadge';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

// Helper from KnowledgeBaseView
const calculatePageProgress = (entry: KnowledgeBaseEntry): number => {
    if (entry.topics && entry.topics.length > 0) {
        const completedTopics = entry.topics.filter(t => t.lastStudiedAt !== null).length;
        return (completedTopics / entry.topics.length) * 100;
    }
    return entry.lastStudiedAt !== null ? 100 : 0;
};

interface RevisionItemCardProps {
    item: RevisionItem;
    knowledgeBase: KnowledgeBaseEntry[];
    onLogRevision: (item: RevisionItem) => void;
    onViewPage: (pageNumber: string) => void;
    onDelete: () => void; // Added Delete Callback
}

const RevisionItemCard: React.FC<RevisionItemCardProps> = ({ item, knowledgeBase, onLogRevision, onViewPage, onDelete }) => {
    const { pageNumber, title, parentTitle, nextRevisionAt, currentRevisionIndex, type } = item;
    const isDue = new Date(nextRevisionAt) <= new Date();
    const isWholePage = type === 'PAGE';
    
    const progress = calculatePageProgress(item.kbEntry);

    return (
        <div className={`group relative bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_15px_30px_rgba(0,0,0,0.1)] border border-white/40 dark:border-slate-700/50 shadow-sm ${isDue ? 'border-l-4 border-l-amber-400' : ''}`}>
            <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                <div className="flex-shrink-0 relative">
                    <PageBadge
                        pageNumber={pageNumber}
                        attachments={item.kbEntry.attachments}
                        revisionCount={item.kbEntry.revisionCount}
                        progress={progress}
                        onClick={() => onViewPage(pageNumber)}
                    />
                    {!isWholePage && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-sm" title="Subtopic Revision">
                            <ListCheckIcon className="w-3 h-3" />
                        </div>
                    )}
                </div>
                <div className="flex-grow min-w-0 w-full cursor-pointer" onClick={() => onViewPage(pageNumber)}>
                    <div className="flex items-center gap-2 mb-1">
                        {isWholePage ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                                Whole Page
                            </span>
                        ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">
                                Subtopic
                            </span>
                        )}
                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate max-w-[150px]">
                            {item.kbEntry.system}
                        </span>
                    </div>
                    
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate text-lg group-hover:text-indigo-600 transition-colors">
                        {title}
                    </h4>
                    
                    {!isWholePage && (
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                            <DocumentTextIcon className="w-3 h-3" />
                            Context: {parentTitle}
                        </p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-3">
                        <span className="font-bold bg-slate-100/50 dark:bg-slate-700/50 px-2 py-1 rounded-md text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200/50 dark:border-slate-600/50 backdrop-blur-sm">
                            Rev #{currentRevisionIndex}
                        </span>
                        <span className="font-medium">Due: {new Date(nextRevisionAt).toLocaleString([], {
                            month: 'short', day: 'numeric',
                            hour: 'numeric', minute: '2-digit'
                        })}</span>
                        {isDue && <span className="text-amber-600 dark:text-amber-400 font-black animate-pulse bg-amber-100/50 dark:bg-amber-900/30 px-2 py-0.5 rounded-md text-[10px] tracking-wide uppercase backdrop-blur-sm">DUE NOW</span>}
                    </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto mt-3 sm:mt-0 justify-end">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="p-2.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Remove from schedule"
                    >
                        <TrashIcon className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => onLogRevision(item)}
                        className={`btn-3d flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md backdrop-blur-sm ${isDue ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
                    >
                        <ArrowPathIcon className="w-4 h-4" />
                        Revise
                    </button>
                </div>
            </div>
        </div>
    );
};

interface PastLogItem {
    log: RevisionLog;
    kbEntry: KnowledgeBaseEntry;
}

const PastLogItemCard: React.FC<{ item: PastLogItem, onViewPage: (page: string) => void }> = ({ item, onViewPage }) => {
    const { log, kbEntry } = item;
    const isStudy = log.type === 'STUDY';
    const progress = calculatePageProgress(kbEntry);

    return (
        <div className={`group relative bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 rounded-2xl p-4 transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 ${isStudy ? '' : 'border-l-4 border-l-green-400'} shadow-sm`}>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex-shrink-0">
                    <PageBadge
                        pageNumber={kbEntry.pageNumber}
                        attachments={kbEntry.attachments}
                        revisionCount={kbEntry.revisionCount}
                        progress={progress}
                        onClick={() => onViewPage(kbEntry.pageNumber)}
                        className="scale-90"
                    />
                </div>
                <div className="flex-grow min-w-0 w-full cursor-pointer" onClick={() => onViewPage(kbEntry.pageNumber)}>
                    <h4 className="font-bold text-slate-700 dark:text-slate-200 truncate text-base">
                        {kbEntry.title}
                    </h4>
                    {log.topics && log.topics.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {log.topics.map((t, i) => (
                                <span key={i} className="text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">
                                    {t}
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-2">
                        <span className={`font-bold px-2 py-1 rounded-md shadow-sm border backdrop-blur-sm ${isStudy ? 'bg-blue-50/50 border-blue-100 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300' : 'bg-green-50/50 border-green-100 text-green-600 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'}`}>
                            {isStudy ? 'First Study' : `Revision #${log.revisionIndex}`}
                        </span>
                        <span className="font-mono text-slate-400">
                            {new Date(log.timestamp).toLocaleString([], {
                                month: 'short', day: 'numeric',
                                hour: 'numeric', minute: '2-digit'
                            })}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};


interface RevisionViewProps {
  knowledgeBase: KnowledgeBaseEntry[];
  onLogRevision: (item: RevisionItem) => void;
  onDeleteSession: (id: string) => void;
  onViewPage: (page: string) => void;
  onDeleteRevision: (item: RevisionItem) => void; // New Prop
}

type SortOption = 'TIME' | 'PAGE' | 'TOPIC' | 'SYSTEM';
type SortOrder = 'ASC' | 'DESC';

export const RevisionView: React.FC<RevisionViewProps> = ({ knowledgeBase, onLogRevision, onDeleteSession, onViewPage, onDeleteRevision }) => {
  const [activeTab, setActiveTab] = useState<'DUE' | 'UPCOMING' | 'HISTORY'>('DUE');
  const [sortBy, setSortBy] = useState<SortOption>('TIME');
  const [sortOrder, setSortOrder] = useState<SortOrder>('ASC');
  
  const [itemToDelete, setItemToDelete] = useState<RevisionItem | null>(null);

  const now = new Date();
  
  const handleTabClick = (tab: 'DUE' | 'UPCOMING' | 'HISTORY') => {
      setActiveTab(tab);
      setSortBy('TIME');
      if (tab === 'HISTORY') {
          setSortOrder('DESC'); // Newest first for history
      } else {
          setSortOrder('ASC'); // Soonest first for due/upcoming
      }
  };

  const confirmDelete = () => {
      if (itemToDelete) {
          onDeleteRevision(itemToDelete);
          setItemToDelete(null);
      }
  };

  const todaysLogs = useMemo(() => {
    const todayStr = getAdjustedDate(new Date());
    const studied = new Set<string>();
    const revised = new Map<string, number>();

    knowledgeBase.forEach(kb => {
        (kb.logs || []).forEach(log => {
            if (getAdjustedDate(log.timestamp) === todayStr) {
                if (log.type === 'STUDY') {
                    studied.add(kb.pageNumber);
                } else {
                    revised.set(kb.pageNumber, log.revisionIndex);
                }
            }
        });
    });
    return { studied: Array.from(studied), revised: Array.from(revised.entries()) };
  }, [knowledgeBase]);

  const allRevisionItems = useMemo((): RevisionItem[] => {
    const items: RevisionItem[] = [];
    knowledgeBase.forEach(kb => {
        // 1. Page Level (Only add if page itself has a nextRevisionAt)
        if(kb.nextRevisionAt) {
            items.push({
                type: 'PAGE',
                pageNumber: kb.pageNumber,
                title: kb.title,
                parentTitle: kb.system,
                nextRevisionAt: kb.nextRevisionAt,
                currentRevisionIndex: kb.currentRevisionIndex,
                id: `page-${kb.pageNumber}`, // Unique ID for page
                kbEntry: kb,
            });
        }
        // 2. Topic Level
        kb.topics.forEach(topic => {
            if (topic.nextRevisionAt) {
                items.push({
                    type: 'TOPIC',
                    pageNumber: kb.pageNumber,
                    title: topic.name,
                    parentTitle: kb.title,
                    nextRevisionAt: topic.nextRevisionAt,
                    currentRevisionIndex: topic.currentRevisionIndex,
                    id: `topic-${kb.pageNumber}-${topic.id}`, // Unique ID for topic
                    kbEntry: kb,
                    topic: topic
                });
            }
            // 3. Subtopic Level (If any - usually same as topic structure)
            (topic.subTopics || []).forEach(subTopic => {
                if (subTopic.nextRevisionAt) {
                    items.push({
                        type: 'SUBTOPIC',
                        pageNumber: kb.pageNumber,
                        title: subTopic.name,
                        parentTitle: topic.name,
                        nextRevisionAt: subTopic.nextRevisionAt,
                        currentRevisionIndex: subTopic.currentRevisionIndex,
                        id: `sub-${kb.pageNumber}-${topic.id}-${subTopic.id}`,
                        kbEntry: kb,
                        topic: topic,
                        subTopic: subTopic
                    });
                }
            });
        });
    });
    return items;
  }, [knowledgeBase]);

  const dueItems = useMemo(() => {
      return allRevisionItems.filter(item => new Date(item.nextRevisionAt) <= now);
  }, [allRevisionItems, now]);

  const upcomingItems = useMemo(() => {
      return allRevisionItems.filter(item => new Date(item.nextRevisionAt) > now);
  }, [allRevisionItems, now]);

  const sortedDue = useMemo(() => {
    return [...dueItems].sort((a,b) => sortOrder === 'ASC' ? new Date(a.nextRevisionAt).getTime() - new Date(b.nextRevisionAt).getTime() : new Date(b.nextRevisionAt).getTime() - new Date(a.nextRevisionAt).getTime());
  }, [dueItems, sortBy, sortOrder]);

  const sortedUpcoming = useMemo(() => {
    return [...upcomingItems].sort((a,b) => sortOrder === 'ASC' ? new Date(a.nextRevisionAt).getTime() - new Date(b.nextRevisionAt).getTime() : new Date(b.nextRevisionAt).getTime() - new Date(a.nextRevisionAt).getTime());
  }, [upcomingItems, sortBy, sortOrder]);
  
  const pastLogs = useMemo((): PastLogItem[] => {
    return knowledgeBase.flatMap(kb => kb.logs.map(log => ({ log, kbEntry: kb })));
  }, [knowledgeBase]);

  const sortedPastLogs = useMemo(() => {
      return [...pastLogs].sort((a,b) => {
          let comparison = 0;
          switch(sortBy) {
              case 'PAGE':
                  comparison = a.kbEntry.pageNumber.localeCompare(b.kbEntry.pageNumber, undefined, { numeric: true });
                  break;
              case 'TOPIC':
                  comparison = a.kbEntry.title.localeCompare(b.kbEntry.title);
                  break;
              case 'SYSTEM':
                   comparison = a.kbEntry.system.localeCompare(b.kbEntry.system);
                   break;
              case 'TIME':
              default:
                  // asc should be oldest, desc should be newest
                  comparison = new Date(a.log.timestamp).getTime() - new Date(b.log.timestamp).getTime();
          }
          return sortOrder === 'ASC' ? comparison : -comparison;
      });
  }, [pastLogs, sortBy, sortOrder]);

  const totalRevisionsCount = useMemo(() => {
    return knowledgeBase.reduce((sum, page) => {
        const revisionLogs = page.logs?.filter(l => l.type === 'REVISION').length || 0;
        return sum + revisionLogs;
    }, 0);
  }, [knowledgeBase]);

  return (
    <div className="animate-fade-in space-y-8 pb-20">
        <DeleteConfirmationModal 
            isOpen={!!itemToDelete}
            onClose={() => setItemToDelete(null)}
            onConfirm={confirmDelete}
            title="Remove Revision?"
            message={`Are you sure you want to remove this revision for "${itemToDelete?.title}"? It will be removed from the schedule but progress is kept.`}
        />

        <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-3xl p-6 border border-white/40 dark:border-slate-700/50 shadow-sm">
             <div className="flex justify-between items-start mb-6">
                <div>
                    <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2 tracking-tight">
                        <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg text-white">
                            <ArrowPathIcon className="w-6 h-6" />
                        </div>
                        Revision Hub
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium ml-12">Forecast & History</p>
                </div>
                <div className="flex gap-4 text-sm">
                     <div className="px-5 py-3 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/50 text-center hidden sm:block shadow-sm backdrop-blur-sm">
                         <span className="block text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Total Revisions</span>
                         <span className="block text-2xl font-black text-indigo-700 dark:text-indigo-300">{totalRevisionsCount}</span>
                     </div>
                     <div className="px-5 py-3 bg-amber-50/50 dark:bg-amber-900/20 rounded-2xl border border-amber-100/50 dark:border-amber-900/50 text-center shadow-sm backdrop-blur-sm">
                         <span className="block text-[10px] font-bold text-amber-400 uppercase tracking-widest">Due Now</span>
                         <span className="block text-2xl font-black text-amber-700 dark:text-amber-400">{dueItems.length}</span>
                     </div>
                </div>
            </div>
             { (todaysLogs.studied.length > 0 || todaysLogs.revised.length > 0) &&
                <div className="mt-6 bg-slate-50/50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-inner backdrop-blur-sm">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Today's Activity Log</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                        <div>
                            <p className="font-bold text-slate-700 dark:text-slate-300 mb-1 text-xs uppercase">Studied (First Time)</p>
                            <p className="text-slate-600 dark:text-slate-400 font-mono text-xs">{todaysLogs.studied.length > 0 ? `Pg ${todaysLogs.studied.join(', ')}` : 'None'}</p>
                        </div>
                        <div>
                            <p className="font-bold text-slate-700 dark:text-slate-300 mb-1 text-xs uppercase">Revised</p>
                            <p className="text-slate-600 dark:text-slate-400 font-mono text-xs">{todaysLogs.revised.length > 0 ? todaysLogs.revised.map(([pg, idx]) => `Pg ${pg} (R${idx})`).join(', ') : 'None'}</p>
                        </div>
                    </div>
                </div>
            }
        </div>
        
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200/50 dark:border-slate-700/50 mb-6 gap-4">
                <div className="flex overflow-x-auto max-w-full gap-6">
                    <button 
                        onClick={() => handleTabClick('DUE')}
                        className={`pb-3 px-2 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'DUE' ? 'border-amber-500 text-amber-600 dark:text-amber-400' : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Due Now <span className="bg-amber-100/50 text-amber-700 px-1.5 py-0.5 rounded-md text-[10px] ml-1">{dueItems.length}</span>
                    </button>
                    <button 
                        onClick={() => handleTabClick('UPCOMING')}
                        className={`pb-3 px-2 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'UPCOMING' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Upcoming <span className="bg-indigo-100/50 text-indigo-700 px-1.5 py-0.5 rounded-md text-[10px] ml-1">{upcomingItems.length}</span>
                    </button>
                    <button 
                        onClick={() => handleTabClick('HISTORY')}
                        className={`pb-3 px-2 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'HISTORY' ? 'border-green-500 text-green-600 dark:text-green-400' : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Log History
                    </button>
                </div>
                
                {activeTab === 'HISTORY' && (
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as SortOption)}
                            className="bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm backdrop-blur-sm"
                            aria-label="Sort by"
                        >
                            <option value="TIME">Date</option>
                            <option value="PAGE">Page</option>
                            <option value="TOPIC">Topic</option>
                        </select>
                        <button
                            onClick={() => setSortOrder(d => d === 'ASC' ? 'DESC' : 'ASC')}
                            className="p-1.5 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 shadow-sm hover:bg-slate-50/50 transition-colors backdrop-blur-sm"
                            aria-label={sortOrder === 'ASC' ? 'Sort ascending' : 'Sort descending'}
                        >
                            {sortOrder === 'ASC' ? <BarsArrowUpIcon className="w-4 h-4" /> : <BarsArrowDownIcon className="w-4 h-4" />}
                        </button>
                    </div>
                )}
            </div>

            <div className="space-y-4">
                {activeTab === 'DUE' && (
                    sortedDue.length > 0 ? (
                        sortedDue.map(item => (
                            <RevisionItemCard 
                                key={item.id}
                                item={item}
                                knowledgeBase={knowledgeBase}
                                onLogRevision={onLogRevision}
                                onViewPage={onViewPage}
                                onDelete={() => setItemToDelete(item)}
                            />
                        ))
                    ) : (
                         <div className="p-12 text-center bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                            <CheckCircleIcon className="w-16 h-16 text-green-200 dark:text-green-900 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">All Caught Up!</h3>
                            <p className="text-slate-400 dark:text-slate-500">No revisions due right now.</p>
                        </div>
                    )
                )}

                 {activeTab === 'UPCOMING' && (
                    sortedUpcoming.length > 0 ? (
                        sortedUpcoming.map(item => (
                            <RevisionItemCard 
                                key={item.id}
                                item={item}
                                knowledgeBase={knowledgeBase}
                                onLogRevision={onLogRevision}
                                onViewPage={onViewPage}
                                onDelete={() => setItemToDelete(item)}
                            />
                        ))
                    ) : (
                         <div className="p-12 text-center bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                            <p className="text-slate-400 dark:text-slate-500">No upcoming revisions scheduled.</p>
                        </div>
                    )
                )}

                 {activeTab === 'HISTORY' && (
                     sortedPastLogs.length > 0 ? (
                        sortedPastLogs.map(item => (
                            <PastLogItemCard 
                                key={item.log.id}
                                item={item}
                                onViewPage={onViewPage}
                            />
                        ))
                    ) : (
                        <div className="p-12 text-center bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                            <p className="text-slate-400 dark:text-slate-500">No past logs found.</p>
                        </div>
                    )
                 )}
            </div>
        </div>
    );
};
