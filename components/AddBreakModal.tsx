

import React, { useState, useEffect } from 'react';
import { XMarkIcon, CoffeeIcon } from './Icons';

interface AddBreakModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (title: string, startTime: string, endTime: string, notes: string) => void;
    initialStartTime?: string;
}

export const AddBreakModal: React.FC<AddBreakModalProps> = ({ isOpen, onClose, onSave, initialStartTime = '12:00' }) => {
    const [title, setTitle] = useState('Lunch Break');
    const [startTime, setStartTime] = useState(initialStartTime);
    const [endTime, setEndTime] = useState('');
    const [notes, setNotes] = useState('');

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

    useEffect(() => {
        if (isOpen) {
            setTitle('Lunch Break');
            setStartTime(initialStartTime);
            setNotes('');
            // Default 30m
            calculateEndTime(initialStartTime, 30);
        }
    }, [isOpen, initialStartTime]);

    const calculateEndTime = (start: string, durationMins: number) => {
        if (!start) return;
        const [h, m] = start.split(':').map(Number);
        const d = new Date();
        d.setHours(h, m + durationMins);
        setEndTime(d.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'}));
    };

    const handleDurationClick = (minutes: number) => {
        calculateEndTime(startTime, minutes);
    };

    const handleSave = () => {
        if (startTime && endTime) {
            onSave(title, startTime, endTime, notes);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400">
                        <CoffeeIcon className="w-6 h-6" />
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Take a Break</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><XMarkIcon className="w-6 h-6 text-slate-400" /></button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-950/50">
                    
                    <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Break For</label>
                        <input 
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                            placeholder="e.g. Lunch, Power Nap"
                        />
                    </div>

                    {/* Time Controls */}
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="flex-1">
                                <label className="text-[10px] text-slate-400 font-bold mb-1 block">Start</label>
                                <input 
                                    type="time" 
                                    value={startTime} 
                                    onChange={(e) => {
                                        setStartTime(e.target.value);
                                        calculateEndTime(e.target.value, 30); // Default recal 30m
                                    }}
                                    className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 font-bold text-lg outline-none focus:ring-2 focus:ring-teal-500 text-center"
                                />
                            </div>
                            <span className="text-slate-300 dark:text-slate-600 mt-4">➜</span>
                            <div className="flex-1">
                                <label className="text-[10px] text-slate-400 font-bold mb-1 block">End</label>
                                <input 
                                    type="time" 
                                    value={endTime} 
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 font-bold text-lg outline-none focus:ring-2 focus:ring-teal-500 text-center"
                                />
                            </div>
                        </div>
                        
                        <div className="flex gap-2 justify-between">
                            {[15, 30, 45, 60].map(min => (
                                <button 
                                    key={min} 
                                    onClick={() => handleDurationClick(min)}
                                    className="flex-1 py-2 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 text-xs font-bold border border-teal-100 dark:border-teal-800/50 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors shadow-sm"
                                >
                                    {min}m
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Notes / Reminders</label>
                        <textarea 
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                            placeholder="e.g. Call back home, Prepare for Cardio..."
                            rows={3}
                        />
                    </div>

                </div>

                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex gap-3 shrink-0 bg-white dark:bg-slate-900 rounded-b-2xl">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm">Cancel</button>
                    <button onClick={handleSave} disabled={!startTime || !endTime} className="flex-[2] py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-lg transition-colors text-sm disabled:opacity-50">Add Break</button>
                </div>
            </div>
        </div>
    );
};