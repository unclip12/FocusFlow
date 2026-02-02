
import React, { useState, useEffect } from 'react';
import { Attachment } from '../types';
import { XMarkIcon, ArrowPathIcon, DocumentIcon, ArrowRightIcon, ArrowLeftIcon } from './Icons';
// import { uploadFile } from '../services/firebase'; // Removed

interface AttachmentViewerModalProps {
    attachment: Attachment;
    onClose: () => void;
    onUpdateAttachment?: (newAttachment: Attachment) => void;
}

// Helper to convert Base64 to Blob for opening
const base64ToBlob = (base64: string, type: string = 'application/pdf') => {
    const binStr = atob(base64.split(',')[1]);
    const len = binStr.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        arr[i] = binStr.charCodeAt(i);
    }
    return new Blob([arr], { type: type });
};

export const AttachmentViewerModal: React.FC<AttachmentViewerModalProps> = ({ attachment, onClose, onUpdateAttachment }) => {
    // const [isUploading, setIsUploading] = useState(false); // Removed

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    const handleOpenNative = () => {
        if (attachment.data.startsWith('http')) {
            // Cloud URL - Open directly
            window.open(attachment.data, '_blank');
        } else {
            // Base64 - Convert to Blob URL
            try {
                const blob = base64ToBlob(attachment.data, attachment.type === 'PDF' ? 'application/pdf' : 'image/jpeg');
                const blobUrl = URL.createObjectURL(blob);
                window.open(blobUrl, '_blank');
                // Clean up URL object after a delay to ensure it opens
                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            } catch (e) {
                console.error("Error opening file", e);
                alert("Could not open file. It might be corrupted.");
            }
        }
    };

    /* REMOVED UPDATE HANDLER
    const handleUpdateFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        // Disabled
    };
    */

    // --- IMAGE VIEWER (Simple Lightbox) ---
    if (attachment.type === 'IMAGE') {
        return (
            <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-sm flex flex-col animate-fade-in" onClick={onClose}>
                <div className="absolute top-4 right-4 z-20 flex gap-4">
                    <button onClick={onClose} className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>
                <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
                    <img src={attachment.data} alt={attachment.name} className="max-w-full max-h-full object-contain rounded shadow-2xl" onClick={e => e.stopPropagation()}/>
                </div>
            </div>
        );
    }

    // --- PDF / FILE NATIVE OPENER ---
    return (
        <div className="fixed inset-0 z-[150] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                
                <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-inner">
                    <DocumentIcon className="w-10 h-10" />
                </div>
                
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1 truncate px-2">{attachment.name}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">PDF Document</p>

                <div className="space-y-3">
                    <button 
                        onClick={handleOpenNative}
                        className="w-full py-3.5 bg-primary hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2"
                    >
                        <span>Open in Native Viewer</span>
                        <ArrowRightIcon className="w-4 h-4" />
                    </button>
                    
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 px-4">
                        To edit: Open the file, make changes in your PDF app, save it to 'Files'.
                    </p>

                    {/* UPDATE BUTTON REMOVED */}
                </div>

                <button onClick={onClose} className="mt-6 text-slate-400 hover:text-slate-600 text-sm font-medium">
                    Close
                </button>
            </div>
        </div>
    );
};
