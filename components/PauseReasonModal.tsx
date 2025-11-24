import React, { useState, useEffect } from 'react';
import { CoffeeIcon, XMarkIcon, ClockIcon, CheckCircleIcon } from './Icons';

interface PauseReasonModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string, notes: string, createBreakMinutes?: number) => void;
    blockTitle: string;
}

const REASONS = ["Tired / Fatigue", "Distracted", "Material not available", "Emergency", "Just a quick break", "Procrastination"];

export const PauseReasonModal: React.FC<PauseReasonModalProps> = ({ isOpen, onClose, onConfirm, blockTitle }) => {
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');
    const [breakDuration, setBreakDuration] = useState<number | ''>('');

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

    const handleConfirm = (createBreak: boolean) => {
        const finalReason = reason || "Paused";
        onConfirm(finalReason, notes, createBreak ? (Number(breakDuration) || 10) : undefined);
        onClose();
        // Reset
        setReason('');
        setNotes('');
        setBreakDuration('');
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Pausing Session</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{blockTitle}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><XMarkIcon className="w-6 h-6 text-slate-400" /></button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50 flex-1">
                    
                    {/* Reasons Grid */}
                    <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 block">Reason for Pausing</label>
                        <div className="flex flex-wrap gap-2">
                            {REASONS.map(r => (
                                <button 
                                    key={r}
                                    onClick={() => setReason(r)}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${reason === r ? 'bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-200'}`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                        <input 
                            type="text" 
                            placeholder="Or type custom reason..." 
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            className="w-full mt-3 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500/50"
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 block">What have you covered so far?</label>
                        <textarea 
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="e.g. Read up to page 45, completed 10 questions..."
                            className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-20"
                        />
                    </div>

                    {/* Break Option */}
                    <div className="bg-teal-50 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-900/30 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2 text-teal-700 dark:text-teal-400">
                            <CoffeeIcon className="w-5 h-5" />
                            <h4 className="font-bold text-sm">Taking a formal break?</h4>
                        </div>
                        <div className="flex gap-2 items-center">
                            <input 
                                type="number" 
                                placeholder="10" 
                                value={breakDuration}
                                onChange={e => setBreakDuration(parseInt(e.target.value))}
                                className="w-16 p-2 text-center font-bold bg-white dark:bg-slate-800 border border-teal-200 dark:border-teal-800 rounded-lg text-sm outline-none focus:border-teal-500"
                            />
                            <span className="text-xs text-teal-600 dark:text-teal-500 font-medium mr-auto">minutes</span>
                            
                            <button 
                                onClick={() => handleConfirm(true)}
                                disabled={!breakDuration}
                                className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Start Break
                            </button>
                        </div>
                    </div>

                </div>

                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex gap-3 bg-white dark:bg-slate-900 rounded-b-2xl shrink-0">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm">Cancel</button>
                    <button onClick={() => handleConfirm(false)} className="flex-1 py-3 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-700 font-bold transition-colors text-sm border border-amber-200">Just Pause</button>
                </div>
            </div>
        </div>
    );
};