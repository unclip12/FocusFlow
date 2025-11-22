import React, { useMemo } from 'react';
import { StudyPlanItem, getAdjustedDate, KnowledgeBaseEntry } from '../types';
import { ClockIcon, BookOpenIcon, FireIcon, CheckCircleIcon, ChartBarIcon, TrophyIcon, RepeatIcon, ArrowPathIcon } from './Icons';

interface StatsProps {
  knowledgeBase: KnowledgeBaseEntry[];
  studyPlan?: StudyPlanItem[];
  streak?: number;
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

export const TodayGlance: React.FC<Pick<StatsProps, 'knowledgeBase' | 'studyPlan'>> = ({ knowledgeBase, studyPlan = [] }) => {
    const todayStr = getAdjustedDate(new Date());
    const now = new Date();

    const metrics = useMemo(() => {
        let todayMinutes = 0;
        const studiedPages = new Set<string>();
        const revisedPages = new Set<string>();

        knowledgeBase.forEach(kb => {
            (kb.logs || []).forEach(log => {
                if (getAdjustedDate(log.timestamp) === todayStr) {
                    todayMinutes += log.durationMinutes || 0;
                    if (log.type === 'STUDY') {
                        studiedPages.add(kb.pageNumber);
                    } else if (log.type === 'REVISION') {
                        revisedPages.add(kb.pageNumber);
                    }
                }
            });
        });

        // Calculate revision goal
        const pagesWithDueRevisions = new Set<string>();
        knowledgeBase.forEach(kb => {
            const checkItem = (item: { nextRevisionAt: string | null }, pageNum: string) => {
                if (item.nextRevisionAt && new Date(item.nextRevisionAt) <= now) {
                    pagesWithDueRevisions.add(pageNum);
                }
            };
            checkItem(kb, kb.pageNumber);
            kb.topics.forEach(topic => {
                checkItem(topic, kb.pageNumber);
                (topic.subTopics || []).forEach(subTopic => checkItem(subTopic, kb.pageNumber));
            });
        });

        const revisionGoalTotal = pagesWithDueRevisions.size;
        // Count how many of the due pages were actually revised today
        const revisionGoalCompleted = Array.from(revisedPages).filter(p => pagesWithDueRevisions.has(p)).length;


        const hours = Math.floor(todayMinutes / 60);
        const mins = todayMinutes % 60;
        const timeString = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

        const totalTodayPages = studiedPages.size + revisedPages.size;

        return { 
            timeString, 
            todayMinutes,
            pagesStudiedToday: studiedPages.size,
            pagesRevisedToday: revisedPages.size,
            totalTodayPages,
            revisionGoalTotal,
            revisionGoalCompleted
        };
    }, [knowledgeBase, todayStr, now]);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 mb-6">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
                Today at a Glance
            </h3>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Time Card */}
                <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                        <ClockIcon className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Study Time</span>
                    </div>
                    <p className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{metrics.timeString}</p>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                        Total duration logged
                    </div>
                    <ProgressBar current={metrics.todayMinutes} total={240} colorClass="bg-blue-500" />
                </div>

                {/* Pages Studied Card */}
                <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                        <BookOpenIcon className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Pages Studied</span>
                    </div>
                    <p className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
                        {metrics.pagesStudiedToday}
                    </p>
                     <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                        First-time logs
                    </div>
                    <ProgressBar current={metrics.pagesStudiedToday} total={metrics.totalTodayPages || 1} colorClass="bg-emerald-500" />
                </div>

                {/* Pages Revised Card */}
                <div className="p-3 rounded-xl bg-sky-50/50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-900/30">
                    <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 mb-1">
                        <RepeatIcon className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Pages Revised</span>
                    </div>
                    <p className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{metrics.pagesRevisedToday}</p>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                        Revision logs
                    </div>
                     <ProgressBar current={metrics.pagesRevisedToday} total={metrics.totalTodayPages || 1} colorClass="bg-sky-500" />
                </div>

                {/* NEW Revision Goal Card */}
                <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
                        <ArrowPathIcon className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Revision Goal</span>
                    </div>
                    <p className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
                        {metrics.revisionGoalCompleted}
                        <span className="text-sm font-medium text-slate-400"> / {metrics.revisionGoalTotal} due</span>
                    </p>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                        Due items completed
                    </div>
                    <ProgressBar current={metrics.revisionGoalCompleted} total={metrics.revisionGoalTotal || 1} colorClass="bg-amber-500" />
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

// Default export kept for compatibility if imported elsewhere, 
// but basically rendering the Today view as a fallback
const StatsCard: React.FC<StatsProps> = (props) => {
    return (
        <div className="space-y-6">
            <TodayGlance {...props} />
            <StatsGrid {...props} />
        </div>
    );
};

export default StatsCard;
