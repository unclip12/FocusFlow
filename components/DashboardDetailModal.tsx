import React from 'react';
import { Block, RevisionLog, KnowledgeBaseEntry } from '../types';
import { XMarkIcon, CheckCircleIcon, ClockIcon, BookOpenIcon, ArrowPathIcon } from './Icons';

export interface PageInfo {
    pageNumber: string;
    topic: string;
    isCompleted: boolean;
}

export interface RevisionInfo {
    pageNumber: string;
    topic: string;
    timestamp: string;
}

interface DashboardDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'TIME' | 'PAGES' | 'REVISIONS';
    data: {
        timeLogs?: Block[];
        pageLogs?: { all: PageInfo[], completed: PageInfo[] };
        revisionLogs?: RevisionInfo[];
    }
}

const DetailItem: React.FC<{ icon: React.ReactNode, title: string, subtitle: string, value: string, isCompleted?: boolean }> = ({ icon, title, subtitle, value, isCompleted }) => (
    <div className={`flex items-center gap-4 p-3 rounded-xl transition-all ${isCompleted ? 'bg-green-50/50 dark:bg-green-900/20' : 'bg-slate-50/50 dark:bg-slate-800/50'}`}>
        <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${isCompleted ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500'}`}>
            {icon}
        </div>
        <div className="flex-1 min-w-0">
            <p className={`font-bold truncate text-sm ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-800 dark:text-white'}`}>{title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        <div className="font-bold text-sm text-slate-600 dark:text-slate-300">{value}</div>
    </div>
);


export const DashboardDetailModal: React.FC<DashboardDetailModalProps> = ({ isOpen, onClose, type, data }) => {
    if (!isOpen) return null;

    let title = '';
    let icon = <ClockIcon className="w-5 h-5" />;
    let content = null;

    switch (type) {
        case 'TIME':
            title = 'Study Time Breakdown';
            icon = <ClockIcon className="w-5 h-5" />;
            content = (
                <div className="space-y-2">
                    {data.timeLogs?.length ? data.timeLogs.map(block => (
                        <DetailItem 
                            key={block.id}
                            icon={<ClockIcon className="w-5 h-5" />}
                            title={block.title}
                            subtitle={`Executed from ${block.actualStartTime} to ${block.actualEndTime}`}
                            value={`${block.actualDurationMinutes || 0}m`}
                        />
                    )) : <p className="text-center text-slate-400 text-sm py-8">No study sessions logged today.</p>}
                </div>
            );
            break;
        case 'PAGES':
            title = 'Daily Page Progress';
            icon = <BookOpenIcon className="w-5 h-5" />;
            const completedPages = data.pageLogs?.completed || [];
            const pendingPages = data.pageLogs?.all.filter(p => !completedPages.some(c => c.pageNumber === p.pageNumber)) || [];
            content = (
                 <div className="space-y-4">
                    <div>
                        <h4 className="text-xs font-bold text-green-600 uppercase mb-2">Completed Today</h4>
                        <div className="space-y-2">
                            {completedPages.length > 0 ? completedPages.map(page => (
                                <DetailItem 
                                    key={`comp-${page.pageNumber}`}
                                    icon={<CheckCircleIcon className="w-5 h-5" />}
                                    title={page.topic}
                                    subtitle={`Page ${page.pageNumber}`}
                                    value="Done"
                                    isCompleted
                                />
                            )) : <p className="text-center text-slate-400 text-sm py-4">No pages completed yet.</p>}
                        </div>
                    </div>
                     <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Pending</h4>
                        <div className="space-y-2">
                            {pendingPages.length > 0 ? pendingPages.map(page => (
                                <DetailItem 
                                    key={`pend-${page.pageNumber}`}
                                    icon={<BookOpenIcon className="w-5 h-5" />}
                                    title={page.topic}
                                    subtitle={`Page ${page.pageNumber}`}
                                    value="Pending"
                                />
                            )) : <p className="text-center text-slate-400 text-sm py-4">All planned pages completed!</p>}
                        </div>
                    </div>
                </div>
            );
            break;
        case 'REVISIONS':
            title = 'Revisions Logged Today';
            icon = <ArrowPathIcon className="w-5 h-5" />;
            content = (
                 <div className="space-y-2">
                    {data.revisionLogs?.length ? data.revisionLogs.map((rev, i) => (
                        <DetailItem 
                            key={`${rev.pageNumber}-${i}`}
                            icon={<ArrowPathIcon className="w-5 h-5" />}
                            title={`Revise: ${rev.topic}`}
                            subtitle={`Page ${rev.pageNumber}`}
                            value={new Date(rev.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            isCompleted
                        />
                    )) : <p className="text-center text-slate-400 text-sm py-8">No revisions logged today.</p>}
                </div>
            );
            break;
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg">
                           {icon}
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-lg">{title}</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><XMarkIcon className="w-5 h-5 text-slate-400" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50 dark:bg-slate-950/50">
                    {content}
                </div>
            </div>
        </div>
    );
};
