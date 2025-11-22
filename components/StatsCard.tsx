
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
        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mt-2">
            <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${percent}%` }}></div>
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
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 mb-6">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
                Today at a Glance
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Time */}
                <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 flex flex-col justify-between h-full">
                    <div>
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                            <ClockIcon className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Study Time</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{metrics.timeString}</p>
                            <span className="text-xs text-slate-500 font-medium">/ {Math.round(metrics.plannedMinutes / 60)}h</span>
                        </div>
                    </div>
                    <ProgressBar current={metrics.todayMinutes} total={metrics.plannedMinutes || 1} colorClass="bg-blue-500" />
                </div>

                {/* Card 2: Pages Studied */}
                <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 flex flex-col justify-between h-full">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                                <BookOpenIcon className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Pages</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{metrics.plannedPagesCompleted}</span>
                                <span className="text-xs text-slate-500 font-bold">/ {metrics.plannedPagesTotal}</span>
                            </div>
                        </div>
                        <div className="text-right bg-white dark:bg-slate-800/50 px-2 py-1 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Total</p>
                            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{metrics.totalUniqueStudied}</p>
                        </div>
                    </div>
                    <div className="mt-auto">
                        <ProgressBar current={metrics.plannedPagesCompleted} total={metrics.plannedPagesTotal || 1} colorClass="bg-emerald-500" />
                    </div>
                </div>

                {/* Card 3: Revisions */}
                <div className="p-4 rounded-xl bg-violet-50/50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-900/30 flex flex-col justify-between h-full">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 mb-1">
                                <ArrowPathIcon className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Revisions</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{metrics.revisionGoalCompleted}</span>
                                <span className="text-xs text-slate-500 font-bold">/ {metrics.revisionGoalTotal}</span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-auto">
                        <ProgressBar current={metrics.revisionGoalCompleted} total={metrics.revisionGoalTotal || 1} colorClass="bg-violet-500" />
                    </div>
                </div>

                {/* Card 4: Anki */}
                <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 flex flex-col justify-between h-full">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
                                <FireIcon className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Anki Cards</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{metrics.ankiCompleted}</span>
                                <span className="text-xs text-slate-500 font-bold">/ {metrics.ankiPlanned}</span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-auto">
                        <ProgressBar current={metrics.ankiCompleted} total={metrics.ankiPlanned || 1} colorClass="bg-amber-500" />
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
             <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2 px-1">
                <ChartBarIcon className="w-4 h-4 text-slate-400" />
                Stats & Progress
            </h3>
            <div className="grid grid-cols-2 gap-4">
                {/* Card 1: Total Pages */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                         <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Total Pages</span>
                         <BookOpenIcon className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                        <span className="text-2xl font-bold text-slate-800 dark:text-white">{stats.totalPages}</span>
                        <span className="text-xs text-slate-400 ml-1">pages</span>
                    </div>
                </div>

                {/* Card 2: Total Hours */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                         <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Total Time</span>
                         <ClockIcon className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                        <span className="text-2xl font-bold text-slate-800 dark:text-white">{stats.totalHours}</span>
                        <span className="text-xs text-slate-400 ml-1">hours</span>
                    </div>
                </div>

                {/* Card 3: Anki */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                         <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Total Cards</span>
                         <FireIcon className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                        <span className="text-2xl font-bold text-slate-800 dark:text-white">{stats.totalAnki}</span>
                        <div className="mt-2">
                             <ProgressBar current={stats.totalAnki} total={stats.totalAnkiTarget || stats.totalAnki * 1.5} colorClass="bg-amber-500" />
                        </div>
                    </div>
                </div>

                {/* Card 4: Streak */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                         <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Streak</span>
                         <TrophyIcon className="w-4 h-4 text-yellow-400" />
                    </div>
                    <div>
                        <span className="text-2xl font-bold text-slate-800 dark:text-white">{streak}</span>
                        <span className="text-xs text-slate-400 ml-1">days</span>
                        <p className="text-[10px] text-green-500 font-bold mt-1">Keep it up!</p>
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
