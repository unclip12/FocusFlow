
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DayPlan, getAdjustedDate, Block, AppSettings, TimeLogEntry, TimeLogCategory } from '../types';
import { getDayPlan, saveDayPlan } from '../services/firebase';
import { saveTimeLog } from '../services/timeLogService';
import { startBlock, updateBlockInPlan, finishBlock } from '../services/planService';
import { CalendarIcon, ClockIcon, VideoIcon, FireIcon, BookOpenIcon, PlayIcon, PauseIcon, ListCheckIcon, StopIcon, CheckCircleIcon, CoffeeIcon, ChevronLeftIcon, ChevronRightIcon, SparklesIcon } from './Icons';
import { ReflectionModal } from './ReflectionModal';
import { triggerBlockFinishedNotification } from '../services/notificationService';

// --- HELPERS ---
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);
const formatDuration = (mins: number | null | undefined) => {
    if (mins === null || mins === undefined) return "N/A";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h}h ${m > 0 ? m + 'm' : ''}`;
    return `${m}m`;
};
const formatTime12 = (timeStr: string | undefined) => {
    if (!timeStr) return "--:-- AM";
    if (timeStr.toLowerCase().includes('m')) return timeStr;
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr);
    const m = parseInt(mStr);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const d = new Date();
    d.setHours(h, m);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

// --- CARD SUBCOMPONENT FOR FULL DAY PLAN ---
const InfoCard: React.FC<{ title: string; icon: React.ElementType; children: React.ReactNode; className?: string }> = ({ title, icon: Icon, children, className = '' }) => (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm ${className}`}>
        <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-lg">
                <Icon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-700 dark:text-slate-200">{title}</h3>
        </div>
        {children}
    </div>
);

// --- FULL DAY PLAN LAYOUT ---
const FullDayPlanLayout: React.FC<{ plan: DayPlan }> = ({ plan }) => {
    const totalStudyMinutes = plan.totalStudyMinutesPlanned;
    const totalHours = Math.floor(totalStudyMinutes / 60);
    const remainingMinutes = totalStudyMinutes % 60;
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
                <InfoCard title="First Aid Reading" icon={BookOpenIcon}>
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Target Pages</span>
                        <span className="text-xl font-bold text-slate-800 dark:text-white">{plan.faPagesCount || 0} pgs</span>
                    </div>
                    <p className="text-xs text-slate-400 text-right mt-1">Est. {formatDuration(plan.faStudyMinutesPlanned)}</p>
                </InfoCard>

                <InfoCard title="Planned Videos" icon={VideoIcon}>
                    <div className="space-y-4">
                        {plan.videos.length > 0 ? plan.videos.map((video, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm">
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-white">{video.topic || 'Video'}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{video.subject || 'General'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-slate-700 dark:text-slate-300">{formatDuration(video.effectiveStudyMinutes)}</p>
                                    <p className="text-xs text-slate-400">@ {video.playbackRate}x speed</p>
                                </div>
                            </div>
                        )) : <p className="text-sm text-slate-400 italic">No videos planned.</p>}
                    </div>
                </InfoCard>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <InfoCard title="Anki" icon={FireIcon}>
                        <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">{plan.anki?.totalCards || 0}</p>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">CARDS DUE</p>
                        <p className="text-xs text-slate-400 mt-2">Est. {formatDuration(plan.anki?.plannedMinutes)}</p>
                    </InfoCard>
                     <InfoCard title="QBank" icon={CheckCircleIcon}>
                        <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{plan.qbank?.totalQuestions || 0}</p>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">QUESTIONS</p>
                         <p className="text-xs text-slate-400 mt-2">Est. {formatDuration(plan.qbank?.plannedMinutes)}</p>
                    </InfoCard>
                </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
                 <InfoCard title="Total Focused Study" icon={ClockIcon} className="text-center">
                    <span className="text-5xl font-black text-slate-800 dark:text-white">{totalHours}</span><span className="text-2xl font-bold text-slate-500">h</span>
                    {remainingMinutes > 0 && <span className="text-2xl font-bold text-slate-500"> {remainingMinutes}m</span>}
                    <p className="text-xs text-slate-400 mt-2">Does not include breaks</p>
                </InfoCard>

                 <InfoCard title="Timeline" icon={CalendarIcon}>
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-500">Start</span>
                        <span className="text-sm font-mono font-bold text-slate-800 dark:text-white">{formatTime12(plan.startTimePlanned)}</span>
                    </div>
                     <div className="flex justify-between items-center mt-2">
                        <span className="text-sm font-bold text-slate-500">Finish</span>
                        <span className="text-sm font-mono font-bold text-slate-800 dark:text-white">{formatTime12(plan.estimatedEndTime)}</span>
                    </div>
                </InfoCard>

                 <InfoCard title="Breaks & Life" icon={CoffeeIcon}>
                    <div className="space-y-2">
                        {plan.breaks.length > 0 ? plan.breaks.map((br, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                                <span className="font-medium text-slate-600 dark:text-slate-300">{br.label}</span>
                                <span className="font-bold text-slate-500 dark:text-slate-400">{br.startTime ? `${formatTime12(br.startTime)} - ${formatTime12(br.endTime)}` : formatDuration(br.durationMinutes)}</span>
                            </div>
                        )) : <p className="text-sm text-slate-400 italic">No breaks scheduled.</p>}
                    </div>
                </InfoCard>
                
                 <InfoCard title="Mentor Tips" icon={SparklesIcon}>
                    <p className="text-sm text-slate-600 dark:text-slate-300 italic whitespace-pre-wrap">{plan.notesFromAI || "No specific tips from mentor for this plan."}</p>
                </InfoCard>
            </div>
        </div>
    );
};

// --- BLOCKS/TIMELINE LAYOUT ---
const BlocksLayout: React.FC<{ plan: DayPlan, onStartBlock: (id: string) => void, onPauseBlock: (id: string) => void, onFinishBlock: (block: Block) => void }> = ({ plan, onStartBlock, onPauseBlock, onFinishBlock }) => {
    const currentBlock = plan.blocks?.find(b => b.status === 'IN_PROGRESS');
    const nextBlock = plan.blocks?.find(b => b.status === 'NOT_STARTED');

    if (!plan.blocks || plan.blocks.length === 0) {
        return (
            <div className="p-8 text-center flex flex-col items-center">
                <ListCheckIcon className="w-12 h-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-700 dark:text-white">No Blocks Generated</h3>
                <p className="text-slate-500 mb-4">The AI Mentor hasn't created a timeline for this day yet.</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
             {currentBlock && (
                <div className="bg-indigo-600 dark:bg-indigo-900 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200 dark:shadow-none mb-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4"><ClockIcon className="w-48 h-48" /></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2 bg-indigo-500/50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"><span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>In Progress</div>
                            <div className="text-right"><p className="text-3xl font-bold font-mono">{formatTime12(currentBlock.plannedStartTime)}</p><p className="text-xs opacity-70">Started: {formatTime12(currentBlock.actualStartTime)}</p></div>
                        </div>
                        <h3 className="text-2xl font-bold mb-2 leading-tight">{currentBlock.title}</h3>
                        <p className="text-indigo-200 text-sm mb-6">{currentBlock.description}</p>
                        <div className="flex gap-3">
                            <button onClick={() => onFinishBlock(currentBlock)} className="flex-1 bg-white text-indigo-600 py-3 rounded-xl font-bold shadow-md hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"><StopIcon className="w-5 h-5" /> Finish Block</button>
                            <button onClick={() => onPauseBlock(currentBlock.id)} className="w-12 flex items-center justify-center bg-indigo-500/50 hover:bg-indigo-500 rounded-xl transition-colors"><PauseIcon className="w-6 h-6" /></button>
                        </div>
                    </div>
                </div>
            )}
             <div className="space-y-4">
                {plan.blocks?.map((block) => {
                    if (block.status === 'IN_PROGRESS') return null;
                    const isDone = block.status === 'DONE';
                    const isNext = block.status === 'NOT_STARTED' && !currentBlock && block.id === nextBlock?.id;
                    const isBreak = block.type === 'BREAK';

                    return (
                        <div key={block.id} className={`relative pl-4 md:pl-0 transition-all ${isDone ? 'opacity-60' : ''}`}>
                            <div className="absolute left-[-8px] md:left-[-20px] top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700 hidden md:block"></div>
                            <div className={`rounded-xl p-4 border flex flex-col sm:flex-row gap-4 items-start sm:items-center ${isBreak ? 'bg-slate-50 dark:bg-slate-800/50 border-dashed border-slate-300 dark:border-slate-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm'} ${isNext ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900' : ''}`}>
                                <div className="w-full sm:w-20 shrink-0 flex sm:flex-col justify-between sm:justify-start gap-2">
                                    <span className={`font-bold font-mono text-sm ${isDone ? 'text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>{formatTime12(block.plannedStartTime)}</span>
                                    <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded self-center sm:self-start">{block.plannedDurationMinutes}m</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        {isBreak ? <CoffeeIcon className="w-4 h-4 text-slate-400" /> : <BookOpenIcon className="w-4 h-4 text-indigo-500" />}
                                        <span className={`text-xs font-bold uppercase tracking-wider ${isBreak ? 'text-slate-500' : 'text-indigo-600 dark:text-indigo-400'}`}>{block.type}</span>
                                        {isDone && (<span className="ml-auto flex items-center gap-1 text-xs font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full"><CheckCircleIcon className="w-3 h-3" /> Done</span>)}
                                    </div>
                                    <h4 className={`font-bold text-sm md:text-base ${isDone ? 'text-slate-500 line-through' : 'text-slate-800 dark:text-white'}`}>{block.title}</h4>
                                    {block.description && (<p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{block.description}</p>)}
                                </div>
                                {!isDone && !currentBlock && (
                                    <button onClick={() => onStartBlock(block.id)} className={`shrink-0 p-3 rounded-full transition-all ${isNext ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-indigo-500'}`}><PlayIcon className="w-5 h-5" /></button>
                                )}
                                {block.status === 'PAUSED' && (<button onClick={() => onStartBlock(block.id)} className="shrink-0 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-200 transition-colors">Resume</button>)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


// --- MAIN VIEW COMPONENT ---
interface TodaysPlanViewProps {
    targetDate?: string;
    settings: AppSettings;
}
export const TodaysPlanView: React.FC<TodaysPlanViewProps> = ({ targetDate, settings }) => {
    const [viewMode, setViewMode] = useState<'full' | 'blocks'>('full');
    const [currentDate, setCurrentDate] = useState(targetDate || getAdjustedDate(new Date()));
    const [plan, setPlan] = useState<DayPlan | null>(null);
    const [loading, setLoading] = useState(true);
    const [finishingBlock, setFinishingBlock] = useState<Block | null>(null);
    const [isReflectionOpen, setIsReflectionOpen] = useState(false);

    useEffect(() => {
        setCurrentDate(targetDate || getAdjustedDate(new Date()));
    }, [targetDate]);

    useEffect(() => {
        loadPlan();
    }, [currentDate]);

    const loadPlan = async () => {
        setLoading(true);
        try {
            const data = await getDayPlan(currentDate);
            setPlan(data);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const handleDateChange = (offset: number) => {
        const d = new Date(currentDate + 'T12:00:00'); // Use noon to avoid timezone day shifts
        d.setDate(d.getDate() + offset);
        setCurrentDate(getAdjustedDate(d));
    };

    const handleStartBlock = async (blockId: string) => {
        try {
            const updatedPlan = await startBlock(currentDate, blockId);
            if (updatedPlan) setPlan(updatedPlan);
        } catch (e) { console.error("Start block failed", e); }
    };
    
    const handlePauseBlock = async (blockId: string) => {
        try {
            const updatedPlan = await updateBlockInPlan(currentDate, blockId, { status: 'PAUSED' });
            if (updatedPlan) setPlan(updatedPlan);
        } catch (e) { console.error("Pause block failed", e); }
    };

    const initiateFinish = (block: Block) => {
        setFinishingBlock(block);
        setIsReflectionOpen(true);
    };

    const handleFinishReflection = async (status: 'COMPLETED' | 'PARTIAL' | 'NOT_DONE', pagesCovered: number[], carryForwardPages: number[], notes: string, interruptions?: { start: string, end: string, reason: string }[]) => {
        if (!finishingBlock) return;
        try {
            const updatedPlan = await finishBlock(currentDate, finishingBlock.id, { status, pagesCovered, carryForwardPages, notes, interruptions });
            if (updatedPlan) {
                setPlan(updatedPlan);
                const updatedBlock = updatedPlan.blocks?.find(b => b.id === finishingBlock.id);
                if (updatedBlock && updatedBlock.actualStartTime && updatedBlock.actualEndTime) {
                    let category: TimeLogCategory = 'STUDY';
                    switch (updatedBlock.type) { case 'VIDEO': category = 'VIDEO'; break; case 'ANKI': category = 'ANKI'; break; case 'QBANK': category = 'QBANK'; break; case 'BREAK': category = 'BREAK'; break; default: category = 'STUDY'; }
                    const start = new Date(`${currentDate}T${updatedBlock.actualStartTime}`);
                    let end = new Date(`${currentDate}T${updatedBlock.actualEndTime}`);
                    if (end < start) end.setDate(end.getDate() + 1);
                    const duration = Math.round((end.getTime() - start.getTime()) / 60000);
                    await saveTimeLog({ id: generateId(), date: currentDate, startTime: start.toISOString(), endTime: end.toISOString(), durationMinutes: duration, category: category, source: 'TODAYS_PLAN_BLOCK', activity: updatedBlock.title, notes: notes || updatedBlock.actualNotes, linkedEntityId: updatedBlock.id });
                }
            }
        } catch (e) { console.error("Finish block failed", e); } finally { setIsReflectionOpen(false); setFinishingBlock(null); }
    };

    const nextBlock = plan?.blocks?.find(b => b.status === 'NOT_STARTED');
    const formattedDate = new Date(currentDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    return (
        <div className="animate-fade-in max-w-4xl mx-auto pb-20 space-y-6">
            {finishingBlock && <ReflectionModal isOpen={isReflectionOpen} block={finishingBlock} nextBlock={nextBlock} onStartNextBlock={handleStartBlock} onClose={() => setIsReflectionOpen(false)} onSave={handleFinishReflection} onUpdateBlock={(bid, updates) => updateBlockInPlan(currentDate, bid, updates).then(p => p && setPlan(p))} />}
            
            <div className="flex justify-between items-center relative">
                <button onClick={() => handleDateChange(-1)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeftIcon className="w-6 h-6 text-slate-500" /></button>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white text-center">{formattedDate}</h2>
                <button onClick={() => handleDateChange(1)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronRightIcon className="w-6 h-6 text-slate-500" /></button>
            </div>

            <div className="flex justify-center">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button onClick={() => setViewMode('full')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${viewMode === 'full' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-white' : 'text-slate-500'}`}>Full Day Plan</button>
                    <button onClick={() => setViewMode('blocks')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${viewMode === 'blocks' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-white' : 'text-slate-500'}`}>Blocks</button>
                </div>
            </div>

            {loading ? <div className="p-8 text-center text-slate-400">Loading Plan...</div> :
             !plan ? (
                <div className="p-8 text-center flex flex-col items-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <CalendarIcon className="w-12 h-12 text-slate-300 mb-4" />
                    <h3 className="text-lg font-bold text-slate-700 dark:text-white">No Plan for this day</h3>
                    <p className="text-slate-500 mb-4">Use the AI Mentor to generate a plan for {formattedDate}.</p>
                </div>
             ) : (
                viewMode === 'full' 
                ? <FullDayPlanLayout plan={plan} /> 
                : <BlocksLayout plan={plan} onStartBlock={handleStartBlock} onPauseBlock={handlePauseBlock} onFinishBlock={initiateFinish} />
             )
            }
        </div>
    );
};
