import React from 'react';
import { TrashIcon } from './Icons';
import { PopoverModal } from './PopoverModal';
import { usePopoverSupport } from '../hooks/usePopover';

interface DeleteConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message?: string;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title = "Delete Item?", 
    message = "Are you sure you want to delete this? This action cannot be undone." 
}) => {
    const popoverSupported = usePopoverSupport();
    const popoverId = 'delete-confirmation-popover';

    const modalContent = (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-xs p-6 border border-slate-200 dark:border-slate-700 transform transition-all scale-100">
            <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mb-4">
                    <TrashIcon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                    {message}
                </p>
                <div className="flex gap-3 w-full">
                    <button 
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={onConfirm}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 shadow-lg shadow-red-500/30 transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );

    // Use native Popover API if supported
    if (popoverSupported) {
        return (
            <PopoverModal
                id={popoverId}
                isOpen={isOpen}
                onClose={onClose}
                className="flex items-center justify-center"
            >
                {modalContent}
            </PopoverModal>
        );
    }

    // Fallback to traditional modal for unsupported browsers
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
            <div onClick={e => e.stopPropagation()}>
                {modalContent}
            </div>
        </div>
    );
};
