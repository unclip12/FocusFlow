import React, { useMemo, useState } from 'react';
import { StudyPlanItem, getAdjustedDate, KnowledgeBaseEntry, DayPlan, RevisionLog } from '../types';
import { ClockIcon, BookOpenIcon, FireIcon, CheckCircleIcon, ChartBarIcon, TrophyIcon, RepeatIcon, ArrowPathIcon } from './Icons';
import { DashboardDetailModal, PageInfo, RevisionInfo } from './DashboardDetailModal';

interface StatsProps {
  knowledgeBase: KnowledgeBaseEntry[];
  studyPlan?: StudyPlanItem[];
  streak?: number;
  todayPlan?: DayPlan | null; // NEW prop
}

// Helper for progress bars
const ProgressBar = ({ current, total, colorClass }: { current: number, total: number, colorClass: string }) => {
    const percent = total > 0 ? Math.min(100, (current / total) * 100) : 0;
    return (
        <div className="h-2.5 w-full bg-white/40 dark:bg-slate-700/40 rounded-full overflow-hidden mt-3 shadow-inner-3d border border-white/30 dark:border-white/10">
            <div className={`h-full rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.2)] ${colorClass}`} style={{ width: `${percent}%` }}></div>
        </div>
    );
};

export const TodayGlance: React.FC<Pick<StatsProps, 'knowledgeBase' | 'studyPlan' | 'todayPlan'>> = ({ knowledgeBase, studyPlan = [], todayPlan }) => {
    const todayStr = getAdjustedDate(new Date());
    const now = new Date();
    
    // State for the detail modal
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [detailType, setDetailType] = useState<'TIME' | 'PAGES' | 'REVISIONS' | null>(null);
    const [modalData, setModalData] = useState<any>({});

    const metrics = useMemo(() => {
        const studiedPagesLog = new Set<string>();
        const revisedPagesLog = new Set<string>();
        const revisionLogsToday: RevisionInfo[] = [];

        // 1. Calculate base stats from KnowledgeBase Logs (Actual Execution Source of Truth)
        knowledgeBase.forEach(kb => {
            (kb.logs || []).forEach(log => {
                if (getAdjustedDate(log.timestamp) === todayStr) {
                    if (log.type === 'STUDY') {
                        studiedPagesLog.add(kb.pageNumber);
                    } else if (log.type === 'REVISION') {
                        revisedPagesLog.add(kb.pageNumber);
                        revisionLogsToday.push({
                            pageNumber: kb.pageNumber,
                            topic: kb.title,
                            timestamp: log.timestamp
                        });
                    }
                }
            });
        });

        // 2. Calculate Time from DayPlan Blocks
        let todayMinutes = 0;
        let plannedMinutes = 0;
        let ankiPlanned = 0;
        let ankiCompleted = 0;
        const studyTimeBlocks = (todayPlan?.blocks || []).filter(b => b.status === 'DONE' && b.type !== 'BREAK');

        if (todayPlan && todayPlan.blocks) {
            todayMinutes = studyTimeBlocks.reduce((acc, b) => acc + (b.actualDurationMinutes || 0), 0);
            plannedMinutes = todayPlan.totalStudyMinutesPlanned || 0;

            // Calculate Anki Stats from Blocks
            todayPlan.blocks.forEach(block => {
                const ankiTasks = block.tasks?.filter(t => t.type === 'ANKI') || [];
                if (ankiTasks.length > 0) {
                    ankiTasks.forEach(t => {
                        const count = t.meta?.count || 0;
                        ankiPlanned += count;
                        if (t.execution?.completed) {
                            ankiCompleted += count;
                        }
                    });
                } else if (block.relatedAnkiInfo?.totalCards) {
                    ankiPlanned += block.relatedAnkiInfo.totalCards;
                    if (block.status === 'DONE') {
                        ankiCompleted += block.relatedAnkiInfo.totalCards;
                    }
                }
            });

        } else {
             knowledgeBase.forEach(kb => {
                (kb.logs || []).forEach(log => {
                    if (getAdjustedDate(log.timestamp) === todayStr) {
                         todayMinutes += log.durationMinutes || 0;
                    }
                });
            });
            plannedMinutes = 240;
        }

        // 3. Planned Pages Calculation
        const allPlannedPages: PageInfo[] = [];
        const completedPlannedPages: PageInfo[] = [];
        
        if (todayPlan && todayPlan.blocks) {
            todayPlan.blocks.forEach(block => {
                if (block.type === 'REVISION_FA' || block.type === 'MIXED') {
                    (block.tasks || []).filter(t => t.type === 'FA').forEach(task => {
                        const pageNum = String(task.meta?.pageNumber || task.detail.match(/\d+/)?.[0] || 'N/A');
                        const pageInfo = {
                            pageNumber: pageNum,
                            topic: task.meta?.topic || block.title,
                            isCompleted: task.execution?.completed || false
                        };
                        
                        if (!allPlannedPages.some(p => p.pageNumber === pageNum)) {
                            allPlannedPages.push(pageInfo);
                        }
                        if (pageInfo.isCompleted && !completedPlannedPages.some(p => p.pageNumber === pageNum)) {
                            completedPlannedPages.push(pageInfo);
                        }
                    });
                }
            });
        }
        
        // 4. Revision Goal Calculation
        let currentDueCount = 0;
        knowledgeBase.forEach(kb => {
            if (kb.nextRevisionAt && new Date(kb.nextRevisionAt) <= now) {
                currentDueCount++;
            } 
        });

        const revisedTodayCount = revisedPagesLog.size;
        const revisionGoalTotal = currentDueCount + revisedTodayCount; 
        
        const hours = Math.floor(todayMinutes / 60);
        const mins = todayMinutes % 60;
        const timeString = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

        return { 
            timeString, todayMinutes, plannedMinutes,
            plannedPagesTotal: allPlannedPages.length,
            plannedPagesCompleted: completedPlannedPages.length,
            totalUniqueStudied: studiedPagesLog.size,
            revisionGoalTotal,
            revisionGoalCompleted: revisedTodayCount,
            totalUniqueRevised: revisedPagesLog.size,
            ankiPlanned, ankiCompleted,
            // Data for modal
            studyTimeBlocks, allPlannedPages, completedPlannedPages, revisionLogsToday
        };
    }, [knowledgeBase, todayStr, now, todayPlan]);

    const openDetail = (type: 'TIME' | 'PAGES' | 'REVISIONS') => {
        setDetailType(type);
        if (type === 'TIME') setModalData({ timeLogs: metrics.studyTimeBlocks });
        if (type === 'PAGES') setModalData({ pageLogs: { all: metrics.allPlannedPages, completed: metrics.completedPlannedPages } });
        if (type === 'REVISIONS') setModalData({ revisionLogs: metrics.revisionLogsToday });
        setIsDetailOpen(true);
    };

    return (
        <>
            {isDetailOpen && detailType && (
                <DashboardDetailModal 
                    isOpen={isDetailOpen}
                    onClose={() => setIsDetailOpen(false)}
                    type={detailType}
                    data={modalData}
                />
            )}
            <div className="card-3d rounded-3xl p-5 mb-8 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-white/10">
                <h3 className="text-base font-extrabold text-slate-800 dark:text-white mb-4 flex items-center gap-2 tracking-tight">
                    <span className="w-1.5 h-5 bg-indigo-600 rounded-full shadow-sm"></span>
                    Today at a Glance
                </h3>
                
                {/* Horizontal scroll on mobile to save vertical space, Grid on desktop */}
                <div className="flex overflow-x-auto snap-x gap-4 pb-2 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:pb-0 scrollbar-hide">
                    {/* Card 1: Time */}
                    <button onClick={() => openDetail('TIME')} className="snap-start shrink-0 w-[240px] sm:w-auto text-left p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-900/20 border border-blue-100/50 dark:border-blue-900/30 shadow-[0_8px_30px_rgba(0,0,0,0.04)] backdrop-blur-sm flex flex-col justify-between relative group hover:-translate-y-1 transition-transform h-32 sm:h-auto">
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                            <ClockIcon className="w-12 h-12 text-blue-600" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 mb-2">
                                <div className="p-1.5 bg-white/70 dark:bg-slate-800/70 rounded-lg shadow-sm backdrop-blur-md">
                                    <ClockIcon className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider">Study Time</span>
                            </div>
                            <div className="flex items-baseline gap-2 relative z-10">
                                <p className="text-2xl font-black text-slate-800 dark:text-slate-100 drop-shadow-sm">{metrics.timeString}</p>
                                <span className="text-[10px] text-slate-500 font-bold bg-white/40 dark:bg-black/20 px-1.5 py-0.5 rounded-md backdrop-blur-sm">/ {Math.round(metrics.plannedMinutes / 60)}h</span>
                            </div>
                        </div>
                        <ProgressBar current={metrics.todayMinutes} total={metrics.plannedMinutes || 1} colorClass="bg-gradient-to-r from-blue-500 to-blue-600" />
                    </button>

                    {/* Card 2: Pages Studied */}
                    <button onClick={() => openDetail('PAGES')} className="snap-start shrink-0 w-[240px] sm:w-auto text-left p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-900/20 border border-emerald-100/50 dark:border-emerald-900/30 shadow-[0_8px_30px_rgba(0,0,0,0.04)] backdrop-blur-sm flex flex-col justify-between relative group hover:-translate-y-1 transition-transform h-32 sm:h-auto">
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                            <BookOpenIcon className="w-12 h-12 text-emerald-600" />
                        </div>
                        <div className="flex justify-between items-start mb-1 relative z-10">
                            <div>
                                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 mb-2">
                                    <div className="p-1.5 bg-white/70 dark:bg-slate-800/70 rounded-lg shadow-sm backdrop-blur-md">
                                        <BookOpenIcon className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Pages</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-slate-800 dark:text-slate-100 drop-shadow-sm">{metrics.plannedPagesCompleted}</span>
                                    <span className="text-[10px] text-slate-500 font-bold bg-white/40 dark:bg-black/20 px-1.5 py-0.5 rounded-md backdrop-blur-sm">/ {metrics.plannedPagesTotal}</span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-auto">
                            <ProgressBar current={metrics.plannedPagesCompleted} total={metrics.plannedPagesTotal || 1} colorClass="bg-gradient-to-r from-emerald-500 to-emerald-600" />
                        </div>
                    </button>

                    {/* Card 3: Revisions */}
                    <button onClick={() => openDetail('REVISIONS')} className="snap-start shrink-0 w-[240px] sm:w-auto text-left p-4 rounded-2xl bg-violet-50/60 dark:bg-violet-900/20 border border-violet-100/50 dark:border-violet-900/30 shadow-[0_8px_30px_rgba(0,0,0,0.04)] backdrop-blur-sm flex flex-col justify-between relative group hover:-translate-y-1 transition-transform h-32 sm:h-auto">
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                            <ArrowPathIcon className="w-12 h-12 text-violet-600" />
                        </div>
                        <div className="flex justify-between items-start mb-1 relative z-10">
                            <div>
                                <div className="flex items-center gap-2 text-violet-700 dark:text-violet-400 mb-2">
                                    <div className="p-1.5 bg-white/70 dark:bg-slate-800/70 rounded-lg shadow-sm backdrop-blur-md">
                                        <ArrowPathIcon className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Revisions</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-slate-800 dark:text-slate-100 drop-shadow-sm">{metrics.revisionGoalCompleted}</span>
                                    <span className="text-[10px] text-slate-500 font-bold bg-white/40 dark:bg-black/20 px-1.5 py-0.5 rounded-md backdrop-blur-sm">/ {metrics.revisionGoalTotal}</span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-auto">
                            <ProgressBar current={metrics.revisionGoalCompleted} total={metrics.revisionGoalTotal || 1} colorClass="bg-gradient-to-r from-violet-500 to-violet-600" />
                        </div>
                    </button>

                    {/* Card 4: Anki */}
                    <div className="snap-start shrink-0 w-[240px] sm:w-auto p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-900/20 border border-amber-100/50 dark:border-amber-900/30 shadow-[0_8px_30px_rgba(0,0,0,0.04)] backdrop-blur-sm flex flex-col justify-between relative group hover:-translate-y-1 transition-transform h-32 sm:h-auto">
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                            <FireIcon className="w-12 h-12 text-amber-600" />
                        </div>
                        <div className="flex justify-between items-start mb-1 relative z-10">
                            <div>
                                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-2">
                                    <div className="p-1.5 bg-white/70 dark:bg-slate-800/70 rounded-lg shadow-sm backdrop-blur-md">
                                        <FireIcon className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Anki Cards</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-slate-800 dark:text-slate-100 drop-shadow-sm">{metrics.ankiCompleted}</span>
                                    <span className="text-[10px] text-slate-500 font-bold bg-white/40 dark:bg-black/20 px-1.5 py-0.5 rounded-md backdrop-blur-sm">/ {metrics.ankiPlanned}</span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-auto">
                            <ProgressBar current={metrics.ankiCompleted} total={metrics.ankiPlanned || 1} colorClass="bg-gradient-to-r from-amber-500 to-amber-600" />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export const StatsGrid: React.FC<Pick<StatsProps, 'knowledgeBase' | 'streak'>> = ({ knowledgeBase, streak = 0 }) => {
    
    const stats = useMemo(() => {
        const totalPages = knowledgeBase.length;
        
        const totalMinutes = knowledgeBase.reduce((acc, kb) => 
            acc + (kb.logs || []).reduce((hAcc: number, h: any) => hAcc + (h.durationMinutes || 0), 0), 0);
        const totalHours = Math.round(totalMinutes / 60);

        const totalAnki = knowledgeBase.reduce((acc, kb) => acc + (kb.ankiCovered || 0), 0);
        const totalAnkiTarget = knowledgeBase.reduce((acc, kb) => acc + (kb.ankiTotal || 0), 0);

        return { totalPages, totalHours, totalAnki, totalAnkiTarget };
    }, [knowledgeBase]);

    return (
        <div className="mb-8">
             <h3 className="text-sm font-extrabold text-slate-800 dark:text-white mb-4 flex items-center gap-2 px-1 tracking-tight">
                <ChartBarIcon className="w-4 h-4 text-slate-400" />
                Stats & Progress
            </h3>
            <div className="grid grid-cols-2 gap-4">
                {/* Card 1: Total Pages */}
                <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-5 rounded-3xl border border-white/40 dark:border-white/10 flex flex-col justify-between relative overflow-hidden group card-3d">
                    <div className="absolute top-0 right-0 p-4 opacity-5 transform translate-x-1/3 -translate-y-1/3">
                        <BookOpenIcon className="w-24 h-24" />
                    </div>
                    <div className="flex justify-between items-start mb-2 relative z-10">
                         <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Pages</span>
                         <div className="p-1.5 bg-indigo-50/80 dark:bg-indigo-900/30 rounded-lg text-indigo-500 backdrop-blur-sm">
                            <BookOpenIcon className="w-4 h-4" />
                         </div>
                    </div>
                    <div className="relative z-10">
                        <span className="text-3xl font-black text-slate-800 dark:text-white">{stats.totalPages}</span>
                        <span className="text-xs text-slate-400 ml-1 font-bold">pages</span>
                    </div>
                </div>

                {/* Card 2: Total Hours */}
                <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-5 rounded-3xl border border-white/40 dark:border-white/10 flex flex-col justify-between relative overflow-hidden group card-3d">
                    <div className="absolute top-0 right-0 p-4 opacity-5 transform translate-x-1/3 -translate-y-1/3">
                        <ClockIcon className="w-24 h-24" />
                    </div>
                    <div className="flex justify-between items-start mb-2 relative z-10">
                         <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Time</span>
                         <div className="p-1.5 bg-blue-50/80 dark:bg-blue-900/30 rounded-lg text-blue-500 backdrop-blur-sm">
                            <ClockIcon className="w-4 h-4" />
                         </div>
                    </div>
                    <div className="relative z-10">
                        <span className="text-3xl font-black text-slate-800 dark:text-white">{stats.totalHours}</span>
                        <span className="text-xs text-slate-400 ml-1 font-bold">hours</span>
                    </div>
                </div>

                {/* Card 3: Anki */}
                <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-5 rounded-3xl border border-white/40 dark:border-white/10 flex flex-col justify-between relative overflow-hidden group card-3d">
                    <div className="absolute top-0 right-0 p-4 opacity-5 transform translate-x-1/3 -translate-y-1/3">
                        <FireIcon className="w-24 h-24" />
                    </div>
                    <div className="flex justify-between items-start mb-2 relative z-10">
                         <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Cards</span>
                         <div className="p-1.5 bg-amber-50/80 dark:bg-amber-900/30 rounded-lg text-amber-500 backdrop-blur-sm">
                            <FireIcon className="w-4 h-4" />
                         </div>
                    </div>
                    <div className="relative z-10">
                        <span className="text-3xl font-black text-slate-800 dark:text-white">{stats.totalAnki}</span>
                        <div className="mt-3">
                             <ProgressBar current={stats.totalAnki} total={stats.totalAnkiTarget || stats.totalAnki * 1.5} colorClass="bg-gradient-to-r from-amber-500 to-amber-600" />
                        </div>
                    </div>
                </div>

                {/* Card 4: Streak */}
                <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-5 rounded-3xl border border-white/40 dark:border-white/10 flex flex-col justify-between relative overflow-hidden group card-3d">
                    <div className="absolute top-0 right-0 p-4 opacity-5 transform translate-x-1/3 -translate-y-1/3">
                        <TrophyIcon className="w-24 h-24" />
                    </div>
                    <div className="flex justify-between items-start mb-2 relative z-10">
                         <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Streak</span>
                         <div className="p-1.5 bg-yellow-50/80 dark:bg-yellow-900/30 rounded-lg text-yellow-500 backdrop-blur-sm">
                            <TrophyIcon className="w-4 h-4" />
                         </div>
                    </div>
                    <div className="relative z-10">
                        <span className="text-3xl font-black text-slate-800 dark:text-white">{streak}</span>
                        <span className="text-xs text-slate-400 ml-1 font-bold">days</span>
                        <p className="text-[10px] text-green-500 font-bold mt-1 bg-green-50/80 dark:bg-green-900/20 px-2 py-0.5 rounded-md inline-block backdrop-blur-sm">Keep it up!</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Default export kept for compatibility if imported elsewhere
const StatsCard: React.FC<StatsProps> = (props) => {
    return (
        <div className="space-y-6">
            <TodayGlance {...props} />
            <StatsGrid {...props} />
        </div>
    );
};

export default StatsCard;