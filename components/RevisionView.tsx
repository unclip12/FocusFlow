
import React, { useState, useMemo } from 'react';
import { KnowledgeBaseEntry, TrackableItem, getAdjustedDate, RevisionLog } from '../types';
import { ArrowPathIcon, CheckCircleIcon, ChevronRightIcon, BookOpenIcon, BarsArrowUpIcon, BarsArrowDownIcon, FireIcon } from './Icons';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine 
} from 'recharts';
import { PageBadge } from './PageBadge';

interface RevisionItem {
    type: 'PAGE' | 'TOPIC' | 'SUBTOPIC';
    pageNumber: string;
    title: string;
    parentTitle: string;
    nextRevisionAt: string;
    currentRevisionIndex: number;
    id: string; // a unique ID like pageNumber-topicId
    kbEntry: KnowledgeBaseEntry;
    topic?: TrackableItem;
    subTopic?: TrackableItem;
}

interface RevisionItemCardProps {
    item: RevisionItem;
    knowledgeBase: KnowledgeBaseEntry[];
    onLogRevision: (item: RevisionItem) => void;
    onViewPage: (pageNumber: string) => void;
}

const RevisionItemCard: React.FC<RevisionItemCardProps> = ({ item, knowledgeBase, onLogRevision, onViewPage }) => {
    const { pageNumber, title, parentTitle, nextRevisionAt, currentRevisionIndex, type } = item;
    const isDue = new Date(nextRevisionAt) <= new Date();

    return (
        <div className={`group relative bg-white dark:bg-dark-surface border rounded-xl p-4 transition-all duration-200 hover:shadow-md ${isDue ? 'border-l-4 border-l-amber-400 border-slate-200 dark:border-dark-border bg-amber-50/10 dark:bg-amber-900/10' : 'border-slate-100 dark:border-dark-border'}`}>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex-shrink-0">
                    <PageBadge
                        pageNumber={pageNumber}
                        attachments={item.kbEntry.attachments}
                        revisionCount={item.kbEntry.revisionCount}
                        onClick={() => onViewPage(pageNumber)}
                    />
                </div>
                <div className="flex-grow min-w-0 w-full" onClick={() => onViewPage(pageNumber)}>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 truncate text-base sm:text-lg">
                        {title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {type !== 'PAGE' ? `From: ${parentTitle}` : item.kbEntry.system}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-2">
                        <span className="font-bold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">R{currentRevisionIndex}</span>
                        <span>Due: {new Date(nextRevisionAt).toLocaleString([], {
                            year: '2-digit', month: 'numeric', day: 'numeric',
                            hour: 'numeric', minute: '2-digit', hour12: true
                        })}</span>
                        {isDue && <span className="text-amber-600 dark:text-amber-400 font-bold animate-pulse text-[10px]">DUE</span>}
                    </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0 justify-end">
                    <button
                        onClick={() => onLogRevision(item)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${isDue ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-800 border'}`}
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

    return (
        <div className={`group relative bg-white dark:bg-dark-surface border rounded-xl p-4 transition-all duration-200 hover:shadow-md ${isStudy ? 'border-slate-100 dark:border-dark-border' : 'border-green-100 dark:border-green-800/30'}`}>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex-shrink-0">
                    <PageBadge
                        pageNumber={kbEntry.pageNumber}
                        attachments={kbEntry.attachments}
                        revisionCount={kbEntry.revisionCount}
                        onClick={() => onViewPage(kbEntry.pageNumber)}
                    />
                </div>
                <div className="flex-grow min-w-0 w-full cursor-pointer" onClick={() => onViewPage(kbEntry.pageNumber)}>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 truncate text-base sm:text-lg">
                        {kbEntry.title}
                    </h4>
                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-2">
                        <span className={`font-bold px-2 py-1 rounded ${isStudy ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'}`}>
                            {isStudy ? 'First Study' : `Revision #${log.revisionIndex}`}
                        </span>
                        <span>
                            {new Date(log.timestamp).toLocaleString([], {
                                year: '2-digit', month: 'numeric', day: 'numeric',
                                hour: 'numeric', minute: '2-digit', hour12: true
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
}

type SortOption = 'TIME' | 'PAGE' | 'TOPIC' | 'SYSTEM';
type SortOrder = 'ASC' | 'DESC';

const RevisionView: React.FC<RevisionViewProps> = ({ knowledgeBase, onLogRevision, onDeleteSession, onViewPage }) => {
  const [activeTab, setActiveTab] = useState<'DUE' | 'UPCOMING' | 'HISTORY'>('DUE');
  const [sortBy, setSortBy] = useState<SortOption>('TIME');
  const [sortOrder, setSortOrder] = useState<SortOrder>('ASC');

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
        // 1. Page Level
        if(kb.nextRevisionAt) {
            items.push({
                type: 'PAGE',
                pageNumber: kb.pageNumber,
                title: kb.title,
                parentTitle: kb.system,
                nextRevisionAt: kb.nextRevisionAt,
                currentRevisionIndex: kb.currentRevisionIndex,
                id: kb.pageNumber,
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
                    id: `${kb.pageNumber}-${topic.id}`,
                    kbEntry: kb,
                    topic: topic
                });
            }
            // 3. Subtopic Level
            (topic.subTopics || []).forEach(subTopic => {
                if (subTopic.nextRevisionAt) {
                    items.push({
                        type: 'SUBTOPIC',
                        pageNumber: kb.pageNumber,
                        title: subTopic.name,
                        parentTitle: topic.name,
                        nextRevisionAt: subTopic.nextRevisionAt,
                        currentRevisionIndex: subTopic.currentRevisionIndex,
                        id: `${kb.pageNumber}-${topic.id}-${subTopic.id}`,
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

  // Helper to consolidate multiple items for the same page
  // Returns the item with the highest revision index or earliest due date if tied
  const consolidateItems = (items: RevisionItem[]) => {
      const map = new Map<string, RevisionItem>();
      
      items.forEach(item => {
          const existing = map.get(item.pageNumber);
          if (!existing) {
              map.set(item.pageNumber, item);
          } else {
              // Preference Logic:
              // 1. Prefer PAGE type over TOPIC/SUBTOPIC to represent the whole page
              if (item.type === 'PAGE' && existing.type !== 'PAGE') {
                  map.set(item.pageNumber, item);
              } 
              // 2. If same type or both not PAGE, pick highest revision index (most progress)
              else if (item.currentRevisionIndex > existing.currentRevisionIndex) {
                  map.set(item.pageNumber, item);
              }
          }
      });
      return Array.from(map.values());
  };

  const dueItems = useMemo(() => {
      const rawDue = allRevisionItems.filter(item => new Date(item.nextRevisionAt) <= now);
      return consolidateItems(rawDue);
  }, [allRevisionItems, now]);

  const upcomingItems = useMemo(() => {
      const rawUpcoming = allRevisionItems.filter(item => new Date(item.nextRevisionAt) > now);
      return consolidateItems(rawUpcoming);
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


  const totalRevisionsCount = knowledgeBase.reduce((sum, page) => sum + page.revisionCount, 0);

  return (
    <div className="animate-fade-in space-y-8">
        <div className="bg-white dark:bg-dark-surface rounded-2xl border border-slate-200 dark:border-dark-border p-6 shadow-sm">
             <div className="flex justify-between items-start mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <ArrowPathIcon className="w-6 h-6 text-primary" />
                        Revision Hub
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Forecast & History</p>
                </div>
                <div className="flex gap-4 text-sm">
                     <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-900/50 text-center hidden sm:block">
                         <span className="block text-xs font-bold text-indigo-400 uppercase">Total Revisions</span>
                         <span className="block text-xl font-bold text-indigo-700 dark:text-indigo-300">{totalRevisionsCount}</span>
                     </div>
                     <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-900/50 text-center">
                         <span className="block text-xs font-bold text-amber-400 uppercase">Due Now</span>
                         <span className="block text-xl font-bold text-amber-700 dark:text-amber-400">{dueItems.length}</span>
                     </div>
                </div>
            </div>
             { (todaysLogs.studied.length > 0 || todaysLogs.revised.length > 0) &&
                <div className="mt-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Today's Log</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">Studied (First Time):</p>
                            <p className="text-slate-600 dark:text-slate-400">{todaysLogs.studied.length > 0 ? `Pg ${todaysLogs.studied.join(', ')}` : 'None'}</p>
                        </div>
                        <div>
                            <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">Revised:</p>
                            <p className="text-slate-600 dark:text-slate-400">{todaysLogs.revised.length > 0 ? todaysLogs.revised.map(([pg, idx]) => `Pg ${pg} (R${idx})`).join(', ') : 'None'}</p>
                        </div>
                    </div>
                </div>
            }
        </div>
        
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 dark:border-dark-border mb-4 gap-4">
                <div className="flex overflow-x-auto max-w-full">
                    <button 
                        onClick={() => handleTabClick('DUE')}
                        className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'DUE' ? 'border-amber-500 text-amber-600 dark:text-amber-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        Due Now ({dueItems.length})
                    </button>
                    <button 
                        onClick={() => handleTabClick('UPCOMING')}
                        className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'UPCOMING' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        Upcoming ({upcomingItems.length})
                    </button>
                    <button 
                        onClick={() => handleTabClick('HISTORY')}
                        className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'HISTORY' ? 'border-green-500 text-green-600 dark:text-green-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        Past Logs
                    </button>
                    {activeTab === 'HISTORY' && (
                        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                            <select
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value as SortOption)}
                                className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1 text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                aria-label="Sort by"
                            >
                                <option value="TIME">Date</option>
                                <option value="PAGE">Page</option>
                                <option value="TOPIC">Topic</option>
                            </select>
                            <button
                                onClick={() => setSortOrder(d => d === 'ASC' ? 'DESC' : 'ASC')}
                                className="p-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-slate-500 dark:text-slate-400"
                                aria-label={sortOrder === 'ASC' ? 'Sort ascending' : 'Sort descending'}
                            >
                                {sortOrder === 'ASC' ? <BarsArrowUpIcon className="w-4 h-4" /> : <BarsArrowDownIcon className="w-4 h-4" />}
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <div className="space-y-3">
                {activeTab === 'DUE' && (
                    sortedDue.length > 0 ? (
                        sortedDue.map(item => (
                            <RevisionItemCard 
                                key={item.id}
                                item={item}
                                knowledgeBase={knowledgeBase}
                                onLogRevision={onLogRevision}
                                onViewPage={onViewPage}
                            />
                        ))
                    ) : (
                         <div className="p-8 text-center bg-white dark:bg-dark-surface rounded-xl border border-slate-200 dark:border-dark-border border-dashed">
                            <CheckCircleIcon className="w-10 h-10 text-green-300 dark:text-green-600 mx-auto mb-3" />
                            <p className="text-slate-500 dark:text-slate-400">No revisions due right now. You're all caught up!</p>
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
                            />
                        ))
                    ) : (
                         <div className="p-8 text-center bg-white dark:bg-dark-surface rounded-xl border border-slate-200 dark:border-dark-border border-dashed">
                            <p className="text-slate-500 dark:text-slate-400">No upcoming revisions scheduled.</p>
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
                        <div className="p-8 text-center bg-white dark:bg-dark-surface rounded-xl border border-slate-200 dark:border-dark-border border-dashed">
                            <p className="text-slate-500 dark:text-slate-400">No past logs found.</p>
                        </div>
                    )
                 )}
            </div>
        </div>
    </div>
  );
};

export default RevisionView;
