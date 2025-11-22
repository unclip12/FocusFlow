import React from 'react';
import { KnowledgeBaseEntry, RevisionLog } from '../types';
import { XMarkIcon, HistoryIcon } from './Icons';

interface RevisionHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    page: KnowledgeBaseEntry | null;
}

export const RevisionHistoryModal: React.FC<RevisionHistoryModalProps> = ({ isOpen, onClose, page }) => {
    if (!isOpen || !page) return null;

    const sortedLogs = [...page.logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div 
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg animate-fade-in-up max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-700"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
                            <HistoryIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Revision History</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Page {page.pageNumber} - {page.title}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl leading-none">&times;</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {sortedLogs.length > 0 ? (
                        sortedLogs.map(log => (
                            <div key={log.id} className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between items-center">
                                    <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${log.type === 'STUDY' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                                        {log.type === 'STUDY' ? 'First Study' : `Revision #${log.revisionIndex}`}
                                    </span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                        {new Date(log.timestamp).toLocaleString([], {
                                            year: 'numeric', month: 'numeric', day: 'numeric',
                                            hour: 'numeric', minute: '2-digit', hour12: true
                                        })}
                                    </span>
                                </div>
                                {log.topics && log.topics.length > 0 && log.topics[0] && (
                                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 italic">
                                        Notes: "{log.topics.join(', ')}"
                                    </p>
                                )}
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-slate-400 italic py-8">No history found for this page.</p>
                    )}
                </div>
            </div>
        </div>
    );
};