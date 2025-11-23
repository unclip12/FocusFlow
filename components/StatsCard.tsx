
import React, { useMemo } from 'react';
import { StudyPlanItem, getAdjustedDate, KnowledgeBaseEntry, DayPlan } from '../types';
import { ClockIcon, BookOpenIcon, FireIcon, CheckCircleIcon, ChartBarIcon, TrophyIcon, RepeatIcon, ArrowPathIcon } from './Icons';

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
        <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-3 shadow-inner-3d border border-white/50 dark:border-white/10">
            <div className={`h-full rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.2)] ${colorClass}`} style={{ width: `${percent}%` }}></div>
        </div>
    );
};

export const TodayGlance: React.FC<Pick<StatsProps, 'knowledgeBase' | 'studyPlan' | 'todayPlan'>> = ({ knowledgeBase, studyPlan = [], todayPlan }) => {
    const todayStr = getAdjustedDate(new Date());
    const now = new Date();

    const metrics = useMemo(() => {
        let todayMinutes = 0;
        const studiedPagesLog = new Set<string>();
        const revisedPagesLog = new Set<string>();

        // 1. Calculate base stats from KnowledgeBase Logs (Actual Execution Source of Truth)
        knowledgeBase.forEach(kb => {
            (kb.logs || []).forEach(log => {
                if (getAdjustedDate(log.timestamp) === todayStr) {
                    if (log.type === 'STUDY') {
                        studiedPagesLog.add(kb.pageNumber);
                    } else if (log.type === 'REVISION') {
                        revisedPagesLog.add(kb.pageNumber);
                    }
                }
            });
        });

        // 2. Calculate Time from DayPlan Blocks
        let plannedMinutes = 0;
        let ankiPlanned = 0;
        let ankiCompleted = 0;

        if (todayPlan && todayPlan.blocks) {
            const executedBlocks = todayPlan.blocks.filter(b => b.status === 'DONE');
            todayMinutes = executedBlocks.reduce((acc, b) => acc + (b.actualDurationMinutes || 0), 0);
            plannedMinutes = todayPlan.totalStudyMinutesPlanned || 0;

            // Calculate Anki Stats from Blocks
            todayPlan.blocks.forEach(block => {
                // Check Granular Tasks first
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
                    // Fallback to block generic info if no granular tasks
                    ankiPlanned += block.relatedAnkiInfo.totalCards;
                    if (block.status === 'DONE') {
                        ankiCompleted += block.relatedAnkiInfo.totalCards;
                    }
                }
            });

        } else {
             // Fallback for time if no plan structure
             knowledgeBase.forEach(kb => {
                (kb.logs || []).forEach(log => {
                    if (getAdjustedDate(log.timestamp) === todayStr) {
                         todayMinutes += log.durationMinutes || 0;
                    }
                });
            });
            plannedMinutes = 240;
        }

        // 3. Planned Pages Calculation (From Today's Plan Blocks)
        const plannedPagesSet = new Set<string>();
        const completedPlannedPagesSet = new Set<string>();

        if (todayPlan && todayPlan.blocks) {
            todayPlan.blocks.forEach(block => {
                // Check tasks for FA pages
                if (block.tasks) {
                    block.tasks.forEach(task => {
                        if (task.type === 'FA') {
                            // Extract page number from meta or detail
                            const pg = task.meta?.pageNumber ? String(task.meta.pageNumber) : (task.detail.match(/\d+/)?.[0]);
                            if (pg) {
                                plannedPagesSet.add(pg);
                                // Check completion status
                                if (task.execution?.completed) {
                                    completedPlannedPagesSet.add(pg);
                                }
                            }
                        }
                    });
                }
                // Fallback to relatedFaPages if tasks not detailed
                if (block.relatedFaPages) {
                    block.relatedFaPages.forEach(pg => plannedPagesSet.add(String(pg)));
                    if (block.status === 'DONE' && (!block.tasks || block.tasks.length === 0)) {
                        block.relatedFaPages.forEach(pg => completedPlannedPagesSet.add(String(pg)));
                    }
                }
            });
        }

        const plannedPagesTotal = plannedPagesSet.size;
        const plannedPagesCompleted = completedPlannedPagesSet.size;


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
            timeString, 
            todayMinutes,
            plannedMinutes,
            
            // Study Pages
            plannedPagesTotal,
            plannedPagesCompleted,
            totalUniqueStudied: studiedPagesLog.size,

            // Revision Pages
            revisionGoalTotal,
            revisionGoalCompleted: revisedTodayCount,
            totalUniqueRevised: revisedPagesLog.size,

            // Anki
            ankiPlanned,
            ankiCompleted
        };
    }, [knowledgeBase, todayStr, now, todayPlan]);

    return (
        <div className="card-3d rounded-3xl p-6 mb-8 bg-white dark:bg-slate-800 border border-white/50 dark:border-slate-700/50">
            <h3 className="text-base font-extrabold text-slate-800 dark:text-white mb-6 flex items-center gap-2 tracking-tight">
                <span className="w-2 h-5 bg-indigo-600 rounded-full shadow-sm"></span>
                Today at a Glance
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Card 1: Time */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/10 border border-white/60 dark:border-white/5 shadow-[0_10px_20px_-5px_rgba(59,130,246,0.15)] flex flex-col justify-between h-full relative group hover:-translate-y-1 transition-transform card-3d">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <ClockIcon className="w-16 h-16 text-blue-600" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 mb-3">
                            <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                <ClockIcon className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider">Study Time</span>
                        </div>
                        <div className="flex items-baseline gap-2 relative z-10">
                            <p className="text-3xl font-black text-slate-800 dark:text-slate-100 drop-shadow-sm">{metrics.timeString}</p>
                            <span className="text-xs text-slate-500 font-bold bg-white/60 dark:bg-black/20 px-2 py-0.5 rounded-md">/ {Math.round(metrics.plannedMinutes / 60)}h</span>
                        </div>
                    </div>
                    <ProgressBar current={metrics.todayMinutes} total={metrics.plannedMinutes || 1} colorClass="bg-gradient-to-r from-blue-500 to-blue-600" />
                </div>

                {/* Card 2: Pages Studied */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-900/10 border border-white/60 dark:border-white/5 shadow-[0_10px_20px_-5px_rgba(16,185,129,0.15)] flex flex-col justify-between h-full relative group hover:-translate-y-1 transition-transform card-3d">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <BookOpenIcon className="w-16 h-16 text-emerald-600" />
                    </div>
                    <div className="flex justify-between items-start mb-2 relative z-10">
                        <div>
                            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 mb-3">
                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                    <BookOpenIcon className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold uppercase tracking-wider">Pages</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-black text-slate-800 dark:text-slate-100 drop-shadow-sm">{metrics.plannedPagesCompleted}</span>
                                <span className="text-xs text-slate-500 font-bold bg-white/60 dark:bg-black/20 px-2 py-0.5 rounded-md">/ {metrics.plannedPagesTotal}</span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-auto">
                        <ProgressBar current={metrics.plannedPagesCompleted} total={metrics.plannedPagesTotal || 1} colorClass="bg-gradient-to-r from-emerald-500 to-emerald-600" />
                    </div>
                </div>

                {/* Card 3: Revisions */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-900/30 dark:to-violet-900/10 border border-white/60 dark:border-white/5 shadow-[0_10px_20px_-5px_rgba(139,92,246,0.15)] flex flex-col justify-between h-full relative group hover:-translate-y-1 transition-transform card-3d">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <ArrowPathIcon className="w-16 h-16 text-violet-600" />
                    </div>
                    <div className="flex justify-between items-start mb-2 relative z-10">
                        <div>
                            <div className="flex items-center gap-2 text-violet-700 dark:text-violet-400 mb-3">
                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                    <ArrowPathIcon className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold uppercase tracking-wider">Revisions</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-black text-slate-800 dark:text-slate-100 drop-shadow-sm">{metrics.revisionGoalCompleted}</span>
                                <span className="text-xs text-slate-500 font-bold bg-white/60 dark:bg-black/20 px-2 py-0.5 rounded-md">/ {metrics.revisionGoalTotal}</span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-auto">
                        <ProgressBar current={metrics.revisionGoalCompleted} total={metrics.revisionGoalTotal || 1} colorClass="bg-gradient-to-r from-violet-500 to-violet-600" />
                    </div>
                </div>

                {/* Card 4: Anki */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-900/10 border border-white/60 dark:border-white/5 shadow-[0_10px_20px_-5px_rgba(245,158,11,0.15)] flex flex-col justify-between h-full relative group hover:-translate-y-1 transition-transform card-3d">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <FireIcon className="w-16 h-16 text-amber-600" />
                    </div>
                    <div className="flex justify-between items-start mb-2 relative z-10">
                        <div>
                            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-3">
                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                    <FireIcon className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold uppercase tracking-wider">Anki Cards</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-black text-slate-800 dark:text-slate-100 drop-shadow-sm">{metrics.ankiCompleted}</span>
                                <span className="text-xs text-slate-500 font-bold bg-white/60 dark:bg-black/20 px-2 py-0.5 rounded-md">/ {metrics.ankiPlanned}</span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-auto">
                        <ProgressBar current={metrics.ankiCompleted} total={metrics.ankiPlanned || 1} colorClass="bg-gradient-to-r from-amber-500 to-amber-600" />
                    </div>
                </div>
            </div>
        </div>
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
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-white/50 dark:border-slate-700/50 flex flex-col justify-between relative overflow-hidden group card-3d">
                    <div className="absolute top-0 right-0 p-4 opacity-5 transform translate-x-1/3 -translate-y-1/3">
                        <BookOpenIcon className="w-24 h-24" />
                    </div>
                    <div className="flex justify-between items-start mb-2 relative z-10">
                         <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Pages</span>
                         <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-500">
                            <BookOpenIcon className="w-4 h-4" />
                         </div>
                    </div>
                    <div className="relative z-10">
                        <span className="text-3xl font-black text-slate-800 dark:text-white">{stats.totalPages}</span>
                        <span className="text-xs text-slate-400 ml-1 font-bold">pages</span>
                    </div>
                </div>

                {/* Card 2: Total Hours */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-white/50 dark:border-slate-700/50 flex flex-col justify-between relative overflow-hidden group card-3d">
                    <div className="absolute top-0 right-0 p-4 opacity-5 transform translate-x-1/3 -translate-y-1/3">
                        <ClockIcon className="w-24 h-24" />
                    </div>
                    <div className="flex justify-between items-start mb-2 relative z-10">
                         <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Time</span>
                         <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-500">
                            <ClockIcon className="w-4 h-4" />
                         </div>
                    </div>
                    <div className="relative z-10">
                        <span className="text-3xl font-black text-slate-800 dark:text-white">{stats.totalHours}</span>
                        <span className="text-xs text-slate-400 ml-1 font-bold">hours</span>
                    </div>
                </div>

                {/* Card 3: Anki */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-white/50 dark:border-slate-700/50 flex flex-col justify-between relative overflow-hidden group card-3d">
                    <div className="absolute top-0 right-0 p-4 opacity-5 transform translate-x-1/3 -translate-y-1/3">
                        <FireIcon className="w-24 h-24" />
                    </div>
                    <div className="flex justify-between items-start mb-2 relative z-10">
                         <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Cards</span>
                         <div className="p-1.5 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-amber-500">
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
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-white/50 dark:border-slate-700/50 flex flex-col justify-between relative overflow-hidden group card-3d">
                    <div className="absolute top-0 right-0 p-4 opacity-5 transform translate-x-1/3 -translate-y-1/3">
                        <TrophyIcon className="w-24 h-24" />
                    </div>
                    <div className="flex justify-between items-start mb-2 relative z-10">
                         <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Streak</span>
                         <div className="p-1.5 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg text-yellow-500">
                            <TrophyIcon className="w-4 h-4" />
                         </div>
                    </div>
                    <div className="relative z-10">
                        <span className="text-3xl font-black text-slate-800 dark:text-white">{streak}</span>
                        <span className="text-xs text-slate-400 ml-1 font-bold">days</span>
                        <p className="text-[10px] text-green-500 font-bold mt-1 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-md inline-block">Keep it up!</p>
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
