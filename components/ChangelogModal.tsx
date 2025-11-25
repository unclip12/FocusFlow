

import React, { useEffect } from 'react';
import { XMarkIcon, InformationCircleIcon } from './Icons';

interface ChangelogModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Since we don't have real history from git/db, we simulate the changelog here.
// Update this manually when releasing new features.
const CHANGELOG_DATA = [
    {
        version: "1.3.0",
        date: new Date().toLocaleString(), // Real-time date as requested
        title: "Changelog System",
        changes: [
            "Added 'Changelog' feature in Settings to track app history.",
            "Implemented version control visualization.",
            "Added 'About' section with current version display."
        ]
    },
    {
        version: "1.2.0",
        date: "5/20/2024, 2:00:00 PM",
        title: "Revision Hub & AI Memory",
        changes: [
            "Added comprehensive Revision Hub with SRS forecasting.",
            "Implemented AI Mentor Memory: The AI now remembers your exam date and learning style.",
            "Added 'Backlog' system for missed tasks.",
            "New 'Liquid' UI theme and smoother animations.",
            "Enhanced FA Logger with smart parsing and timestamp corrections."
        ]
    },
    {
        version: "1.1.5",
        date: "5/10/2024, 10:30:00 AM",
        title: "Time Tracking & Anki",
        changes: [
            "Introduced Time Logger for granular activity tracking.",
            "Integrated AnkiConnect for syncing flashcard progress.",
            "Added Monthly Study Hours chart.",
            "Improved 'Today's Plan' block management."
        ]
    },
    {
        version: "1.1.0",
        date: "4/25/2024, 4:15:00 PM",
        title: "Study Buddy & Info Files",
        changes: [
            "Launched 'Study Buddy' chat mode for document Q&A.",
            "Added 'Info Files' section to upload PDF/Images for AI context.",
            "Added Dark Mode support across all screens.",
            "Fixed bug where session timer wouldn't reset on pause."
        ]
    },
    {
        version: "1.0.0",
        date: "1/1/2024, 9:00:00 AM",
        title: "Initial Release",
        changes: [
            "Initial launch of FocusFlow.",
            "Basic Study Planner and Knowledge Base features.",
            "Simple AI Chat integration."
        ]
    }
];

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
    
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0 bg-slate-50/50 dark:bg-slate-800/50 rounded-t-3xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100/50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl backdrop-blur-sm">
                            <InformationCircleIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">App Updates</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">What's new in FocusFlow</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white/60 dark:bg-slate-900/60">
                    {CHANGELOG_DATA.map((entry, index) => (
                        <div key={index} className="relative pl-8 border-l-2 border-slate-200 dark:border-slate-700 last:border-0 pb-8 last:pb-0">
                            {/* Timeline Dot */}
                            <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${index === 0 ? 'bg-indigo-500 ring-4 ring-indigo-100 dark:ring-indigo-900/30' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                            
                            <div>
                                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mb-2 sm:mb-1 gap-1">
                                    <h4 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        v{entry.version} 
                                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">{entry.title}</span>
                                    </h4>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide font-mono">{entry.date}</span>
                                </div>
                                
                                <ul className="mt-3 space-y-2">
                                    {entry.changes.map((change, cIdx) => (
                                        <li key={cIdx} className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2 leading-relaxed">
                                            <span className="text-indigo-400 mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></span>
                                            <span>{change}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 rounded-b-3xl text-center">
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                        FocusFlow v{CHANGELOG_DATA[0].version} • Created for Medical Professionals
                    </p>
                </div>
            </div>
        </div>
    );
};