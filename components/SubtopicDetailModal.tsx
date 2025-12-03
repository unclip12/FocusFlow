
import React, { useState, useEffect } from 'react';
import { TrackableItem, KnowledgeBaseEntry, Attachment } from '../types';
import { XMarkIcon, CheckCircleIcon, PlusIcon, DocumentIcon, PhotoIcon, TrashIcon, HistoryIcon, ArrowPathIcon } from './Icons';
// import { uploadFile } from '../services/firebase'; // Removed
import { AttachmentViewerModal } from './AttachmentViewerModal';

interface SubtopicDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    subtopic: TrackableItem;
    parentEntry: KnowledgeBaseEntry;
    onUpdate: (updatedSubtopic: TrackableItem) => void;
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

export const SubtopicDetailModal: React.FC<SubtopicDetailModalProps> = ({ isOpen, onClose, subtopic, parentEntry, onUpdate }) => {
    const [contentInput, setContentInput] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [activeAttachment, setActiveAttachment] = useState<Attachment | null>(null);
    // const [isUploading, setIsUploading] = useState(false); // Removed

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            // Initialize content
            const initialContent = (subtopic.content || []).join('\n');
            setContentInput(initialContent);
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen, subtopic]);

    if (!isOpen) return null;

    const handleSaveContent = () => {
        const lines = contentInput.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        onUpdate({
            ...subtopic,
            content: lines
        });
        setIsEditing(false);
    };

    /* REMOVED FILE UPLOAD HANDLER
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        // Disabled
    };
    */

    const removeAttachment = (id: string) => {
        if (confirm("Delete this attachment?")) {
            const updatedAttachments = (subtopic.attachments || []).filter(a => a.id !== id);
            onUpdate({
                ...subtopic,
                attachments: updatedAttachments
            });
        }
    };

    // Render helpers
    const attachments = subtopic.attachments || [];
    const logs = subtopic.logs || []; // Currently topics don't have direct logs often, but structure supports it
    const isDue = subtopic.nextRevisionAt && new Date(subtopic.nextRevisionAt) <= new Date();

    return (
        <>
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
                    
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800 uppercase tracking-wider">Subtopic</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Page {parentEntry.pageNumber}</span>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white leading-tight">{subtopic.name}</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Parent: {parentEntry.title}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Stats Bar */}
                    <div className="px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4 text-xs shrink-0 overflow-x-auto">
                        <div className={`flex items-center gap-1.5 font-bold ${isDue ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                            <ArrowPathIcon className="w-4 h-4" />
                            {isDue ? 'Due for Revision' : 'On Track'}
                        </div>
                        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700"></div>
                        <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <HistoryIcon className="w-4 h-4" />
                            Rev #{subtopic.revisionCount}
                        </div>
                        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700"></div>
                        <div className="text-slate-500 dark:text-slate-400">
                            Next: {subtopic.nextRevisionAt ? new Date(subtopic.nextRevisionAt).toLocaleDateString() : 'N/A'}
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30 dark:bg-slate-950/30">
                        
                        {/* Context / Content */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Context & Notes</h3>
                                {!isEditing ? (
                                    <button onClick={() => setIsEditing(true)} className="text-xs font-bold text-indigo-600 hover:underline">Edit</button>
                                ) : (
                                    <div className="flex gap-2">
                                        <button onClick={() => setIsEditing(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                                        <button onClick={handleSaveContent} className="text-xs font-bold text-indigo-600 hover:underline">Save</button>
                                    </div>
                                )}
                            </div>
                            
                            {isEditing ? (
                                <textarea 
                                    value={contentInput}
                                    onChange={e => setContentInput(e.target.value)}
                                    className="w-full h-40 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                    placeholder="Add detailed bullet points, memory hooks, or notes..."
                                />
                            ) : (subtopic.content && subtopic.content.length > 0) ? (
                                <ul className="space-y-2">
                                    {subtopic.content.map((line, i) => (
                                        <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2 leading-relaxed">
                                            <span className="text-indigo-400 mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></span>
                                            <span>{line}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-slate-400 italic">No context added yet.</p>
                            )}
                        </div>

                        {/* Attachments (View Only) */}
                        <div>
                            <div className="flex justify-between items-end mb-3">
                                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Specific Attachments</h3>
                            </div>
                            
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                {attachments.map(att => (
                                    <div key={att.id} className="relative group aspect-square bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-all" onClick={() => setActiveAttachment(att)}>
                                        {att.type === 'IMAGE' ? (
                                            <img src={att.data} alt={att.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-800">
                                                <DocumentIcon className="w-8 h-8 text-red-400" />
                                            </div>
                                        )}
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); removeAttachment(att.id); }} 
                                            className="absolute top-1 right-1 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                        >
                                            <XMarkIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                
                                {/* UPLOAD BUTTON REMOVED */}
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {activeAttachment && (
                <AttachmentViewerModal 
                    attachment={activeAttachment} 
                    onClose={() => setActiveAttachment(null)} 
                />
            )}
        </>
    );
};
