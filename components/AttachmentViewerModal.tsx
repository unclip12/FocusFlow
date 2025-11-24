import React, { useState, useEffect } from 'react';
import { Attachment } from '../types';
import { XMarkIcon, ArrowPathIcon, DocumentIcon, ArrowRightIcon, ArrowLeftIcon } from './Icons';
import { uploadFile } from '../services/firebase';

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
    const [isUploading, setIsUploading] = useState(false);

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

    const handleUpdateFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);

            try {
                const url = await uploadFile(file);
                
                // Notify parent of update if callback exists
                if (onUpdateAttachment) {
                    const updatedAttachment: Attachment = {
                        ...attachment,
                        data: url,
                        // Preserve ID but update timestamp/name context if needed
                    };
                    // Note: To fully implement update, we need to pass a callback from App.tsx down to here
                    // For now, we alert success as this requires prop drilling updates in App.tsx
                    alert("File uploaded successfully! Please save the session/page to persist changes.");
                }
            } catch (error) {
                console.error("Upload failed", error);
                alert("Failed to upload update.");
            } finally {
                setIsUploading(false);
            }
        }
    };

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
                        To edit: Open the file, make changes in your PDF app, save it to 'Files', then tap below to update.
                    </p>

                    <label className={`w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all cursor-pointer flex items-center justify-center gap-2 ${isUploading ? 'opacity-50' : ''}`}>
                        <ArrowPathIcon className={`w-4 h-4 ${isUploading ? 'animate-spin' : ''}`} />
                        <span>{isUploading ? 'Uploading...' : 'Replace / Update File'}</span>
                        <input type="file" accept="application/pdf" className="hidden" onChange={handleUpdateFile} disabled={isUploading} />
                    </label>
                </div>

                <button onClick={onClose} className="mt-6 text-slate-400 hover:text-slate-600 text-sm font-medium">
                    Close
                </button>
            </div>
        </div>
    );
};