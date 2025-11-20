
import React, { useState } from 'react';
import { KnowledgeBaseEntry, StudySession } from '../types';
import { BookOpenIcon, FireIcon, HistoryIcon, PaperClipIcon, PhotoIcon, DocumentIcon, VideoIcon, XMarkIcon } from './Icons';

interface PageDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageNumber: string | null;
  knowledgeBase: KnowledgeBaseEntry[];
  sessions: StudySession[];
}

export const PageDetailModal: React.FC<PageDetailModalProps> = ({ isOpen, onClose, pageNumber, knowledgeBase, sessions }) => {
  const [activeImage, setActiveImage] = useState<string | null>(null);

  if (!isOpen || !pageNumber) return null;

  // Aggregate Data
  const kbEntry = knowledgeBase.find(k => k.pageNumber === pageNumber);
  const session = sessions.find(s => s.pageNumber === pageNumber);

  const topic = kbEntry?.topic || session?.topic || 'Unknown Topic';
  const subject = kbEntry?.subject || session?.category || 'General';
  const system = kbEntry?.system || session?.system || 'General Principles';
  
  // Stats
  const revisionCount = session?.history.filter(h => h.type === 'REVISION').length || 0;
  const lastStudied = session?.lastStudied ? new Date(session.lastStudied).toLocaleDateString() : 'Never';
  
  // Anki
  const ankiTotal = kbEntry?.ankiTotal || session?.ankiTotal || 0;
  const ankiCovered = session?.ankiCovered || 0;

  // Content
  const subTopics = kbEntry?.subTopics || [];
  const notes = session?.notes || kbEntry?.notes || '';
  
  const attachments = kbEntry?.attachments || [];
  const videoLinks = kbEntry?.videoLinks || [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-between items-start">
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <span className="px-3 py-1 bg-indigo-600 text-white text-sm font-bold rounded-lg shadow-sm">
                        PG {pageNumber}
                    </span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border border-slate-200 dark:border-slate-600 px-2 py-0.5 rounded">
                        {subject}
                    </span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border border-slate-200 dark:border-slate-600 px-2 py-0.5 rounded">
                        {system}
                    </span>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{topic}</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                <XMarkIcon className="w-6 h-6 text-slate-500" />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* LEFT COL: Resources & Visuals */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* Attachments Gallery */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase mb-3 flex items-center gap-2">
                            <PhotoIcon className="w-4 h-4" /> Visuals & Documents ({attachments.length})
                        </h3>
                        {attachments.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {attachments.map(att => (
                                    <div 
                                        key={att.id} 
                                        onClick={() => att.type === 'IMAGE' ? setActiveImage(att.data) : window.open(att.data)}
                                        className="relative group aspect-video bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden cursor-pointer hover:shadow-md transition-all"
                                    >
                                        {att.type === 'IMAGE' ? (
                                            <img src={att.data} alt={att.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                                <DocumentIcon className="w-8 h-8 mb-1" />
                                                <span className="text-[10px] uppercase font-bold">PDF</span>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-center text-slate-400 text-sm italic">
                                No attachments synced to this page.
                            </div>
                        )}
                    </div>

                    {/* Active Image Preview (Large) */}
                    {activeImage && (
                        <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner bg-slate-900">
                            <img src={activeImage} alt="Preview" className="w-full max-h-[400px] object-contain" />
                            <button 
                                onClick={() => setActiveImage(null)}
                                className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                    )}

                    {/* Notes & Subtopics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                             <h3 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                                 <BookOpenIcon className="w-3 h-3" /> Subtopics
                             </h3>
                             {subTopics.length > 0 ? (
                                 <ul className="space-y-1">
                                     {subTopics.map((st, i) => (
                                         <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                                             <span className="text-indigo-500 mt-1.5">•</span> {st}
                                         </li>
                                     ))}
                                 </ul>
                             ) : (
                                 <p className="text-sm text-slate-400 italic">No subtopics defined.</p>
                             )}
                        </div>

                        <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30 shadow-sm">
                             <h3 className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase mb-2 flex items-center gap-1">
                                 <FireIcon className="w-3 h-3" /> Flashcards (Anki)
                             </h3>
                             <div className="flex items-end gap-2 mb-2">
                                 <span className="text-3xl font-bold text-slate-800 dark:text-white">{ankiCovered}</span>
                                 <span className="text-sm text-slate-500 mb-1.5 font-medium">/ {ankiTotal} Done</span>
                             </div>
                             <div className="w-full bg-amber-200 dark:bg-amber-900 rounded-full h-2 overflow-hidden">
                                 <div 
                                    className="bg-amber-500 h-full transition-all" 
                                    style={{ width: `${ankiTotal > 0 ? (ankiCovered / ankiTotal) * 100 : 0}%` }}
                                 />
                             </div>
                        </div>
                    </div>

                    {/* Persistent Notes */}
                    {notes && (
                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                            <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">My Notes</h3>
                            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{notes}</p>
                        </div>
                    )}

                     {/* Video Links */}
                     {videoLinks.length > 0 && (
                        <div className="space-y-2">
                             <h3 className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                                 <VideoIcon className="w-3 h-3" /> Linked Videos
                             </h3>
                             {videoLinks.map(v => (
                                 <a key={v.id} href={v.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors group">
                                     <div className="w-8 h-8 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-blue-500 shadow-sm">
                                         <VideoIcon className="w-4 h-4" />
                                     </div>
                                     <span className="text-sm font-bold text-blue-700 dark:text-blue-300 group-hover:underline">{v.title}</span>
                                 </a>
                             ))}
                        </div>
                     )}
                </div>

                {/* RIGHT COL: History & Meta */}
                <div className="space-y-6">
                     <div className="bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 text-center">
                         <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-indigo-600 shadow-sm">
                             <HistoryIcon className="w-6 h-6" />
                         </div>
                         <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{revisionCount}</h3>
                         <p className="text-xs font-bold text-indigo-500 uppercase tracking-wide">Total Revisions</p>
                         <p className="text-xs text-slate-400 mt-2">Last: {lastStudied}</p>
                     </div>

                     <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                         <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                             <h3 className="text-xs font-bold text-slate-500 uppercase">Session Log</h3>
                         </div>
                         <div className="max-h-[300px] overflow-y-auto p-2 space-y-2">
                             {session?.history.map((log, i) => (
                                 <div key={log.id} className="p-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-sm">
                                     <div className="flex justify-between mb-1">
                                         <span className="font-bold text-slate-700 dark:text-slate-300">{new Date(log.startTime).toLocaleDateString()}</span>
                                         <span className="text-xs text-slate-400">{log.durationMinutes}m</span>
                                     </div>
                                     <div className="flex items-center gap-2">
                                         <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${log.type === 'INITIAL' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                             {log.type}
                                         </span>
                                         {log.attachments && log.attachments.length > 0 && (
                                             <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                                 <PaperClipIcon className="w-3 h-3" /> {log.attachments.length}
                                             </span>
                                         )}
                                     </div>
                                 </div>
                             ))}
                             {!session?.history.length && (
                                 <p className="text-center text-xs text-slate-400 py-4">No study sessions recorded.</p>
                             )}
                         </div>
                     </div>
                </div>

            </div>
        </div>
      </div>
    </div>
  );
};
