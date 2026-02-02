import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DailyTracker, TimeSlot, TrackerTask, getAdjustedDate } from '../types';
import { getDailyTracker, saveDailyTracker } from '../services/firebase';
import { ClipboardDocumentCheckIcon, PlusIcon, TrashIcon, ClockIcon } from './Icons';

const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

const generateInitialSlots = (): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  const startHour = 8;
  for (let i = 0; i < 24; i++) {
    const currentHour = (startHour + i) % 24;
    const nextHour = (startHour + i + 1) % 24;
    slots.push({
      startTime: `${String(currentHour).padStart(2, '0')}:00`,
      endTime: `${String(nextHour).padStart(2, '0')}:00`,
      tasks: [],
    });
  }
  return slots;
};

export const DailyTrackerView: React.FC = () => {
    const [date, setDate] = useState(getAdjustedDate(new Date()));
    const [trackerData, setTrackerData] = useState<DailyTracker | null>(null);
    const [loading, setLoading] = useState(true);
    const initialLoadRef = useRef(true);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            initialLoadRef.current = true;
            try {
                const data = await getDailyTracker(date);
                if (data) {
                    setTrackerData(data);
                } else {
                    setTrackerData({
                        date: date,
                        timeSlots: generateInitialSlots(),
                    });
                }
            } catch (error) {
                console.error("Error loading daily tracker:", error);
            } finally {
                setLoading(false);
                setTimeout(() => { initialLoadRef.current = false; }, 500);
            }
        };
        loadData();
    }, [date]);
    
    // Debounced save
    useEffect(() => {
        if (!trackerData || loading || initialLoadRef.current) return;
        
        const handler = setTimeout(() => {
            saveDailyTracker(trackerData);
        }, 1500); // 1.5 second debounce

        return () => {
            clearTimeout(handler);
        };
    }, [trackerData]);

    const handleUpdate = (updater: (draft: DailyTracker) => void) => {
        setTrackerData(prev => {
            if (!prev) return null;
            const draft = JSON.parse(JSON.stringify(prev)); // Deep copy
            updater(draft);
            return draft;
        });
    };

    const handleAddTask = (slotIndex: number) => {
        handleUpdate(draft => {
            draft.timeSlots[slotIndex].tasks.push({
                id: generateId(),
                text: '',
                isCompleted: false,
            });
        });
    };
    
    const handleUpdateTask = (slotIndex: number, taskIndex: number, updatedTask: Partial<TrackerTask>) => {
        handleUpdate(draft => {
            const task = draft.timeSlots[slotIndex].tasks[taskIndex];
            draft.timeSlots[slotIndex].tasks[taskIndex] = { ...task, ...updatedTask };
        });
    };
    
    const handleDeleteTask = (slotIndex: number, taskIndex: number) => {
        handleUpdate(draft => {
            draft.timeSlots[slotIndex].tasks.splice(taskIndex, 1);
        });
    };

    const totalStudyTimeMinutes = useMemo(() => {
        if (!trackerData) return 0;
        return trackerData.timeSlots.reduce((total, slot) => {
            return total + slot.tasks.reduce((slotTotal, task) => {
                return slotTotal + (task.timeInvestedMinutes || 0);
            }, 0);
        }, 0);
    }, [trackerData]);

    return (
        <div className="animate-fade-in space-y-6 pb-24">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                 <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <ClipboardDocumentCheckIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Daily Tracker</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Log your 24-hour activity cycle.</p>
                    </div>
                </div>
                <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium"
                />
            </div>

            {loading ? (
                 <div className="text-center py-20 text-slate-400">Loading tracker...</div>
            ) : (
                <div className="space-y-4">
                    {trackerData?.timeSlots.map((slot, slotIndex) => (
                        <TimeSlotCard 
                            key={slot.startTime} 
                            slot={slot}
                            onAddTask={() => handleAddTask(slotIndex)}
                            onUpdateTask={(taskIndex, updatedTask) => handleUpdateTask(slotIndex, taskIndex, updatedTask)}
                            onDeleteTask={(taskIndex) => handleDeleteTask(slotIndex, taskIndex)}
                        />
                    ))}
                </div>
            )}
            
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center z-20">
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Total Study Time</span>
                <span className="px-4 py-1.5 bg-primary text-white font-bold rounded-lg text-lg">
                    {Math.floor(totalStudyTimeMinutes / 60)}h {totalStudyTimeMinutes % 60}m
                </span>
            </div>
        </div>
    );
};

interface TimeSlotCardProps {
    slot: TimeSlot;
    onAddTask: () => void;
    onUpdateTask: (taskIndex: number, updatedTask: Partial<TrackerTask>) => void;
    onDeleteTask: (taskIndex: number) => void;
}

const TimeSlotCard: React.FC<TimeSlotCardProps> = ({ slot, onAddTask, onUpdateTask, onDeleteTask }) => {
    
    const formatTime = (timeStr: string) => {
        const [h] = timeStr.split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 === 0 ? 12 : hour % 12;
        return `${displayHour} ${ampm}`;
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                <ClockIcon className="w-4 h-4 text-slate-400" />
                <h3 className="font-mono font-bold text-sm text-slate-700 dark:text-slate-300">
                    {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                </h3>
            </div>
            <div className="p-4 space-y-3">
                {slot.tasks.map((task, taskIndex) => (
                    <TaskItem 
                        key={task.id} 
                        task={task} 
                        onUpdate={(updatedTask) => onUpdateTask(taskIndex, updatedTask)}
                        onDelete={() => onDeleteTask(taskIndex)}
                    />
                ))}
                <button 
                    onClick={onAddTask}
                    className="w-full flex items-center justify-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-indigo-400 bg-slate-50 dark:bg-slate-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 transition-colors"
                >
                    <PlusIcon className="w-3 h-3" /> Add Task
                </button>
            </div>
        </div>
    );
};

interface TaskItemProps {
    task: TrackerTask;
    onUpdate: (updatedTask: Partial<TrackerTask>) => void;
    onDelete: () => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onUpdate, onDelete }) => {
    return (
        <div className={`p-3 rounded-lg border flex flex-col gap-2 transition-all ${task.isCompleted ? 'bg-green-50/30 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-slate-50/30 dark:bg-slate-700/20 border-slate-200 dark:border-slate-700'}`}>
            <div className="flex items-start gap-3">
                <input 
                    type="checkbox"
                    checked={task.isCompleted}
                    onChange={e => onUpdate({ isCompleted: e.target.checked })}
                    className="w-5 h-5 mt-1 rounded text-primary border-slate-300 dark:border-slate-600 focus:ring-primary"
                />
                <input 
                    type="text"
                    value={task.text}
                    onChange={e => onUpdate({ text: e.target.value })}
                    placeholder="Describe your task..."
                    className={`flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium ${task.isCompleted ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-white'}`}
                />
                <button onClick={onDelete} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                    <TrashIcon className="w-3.5 h-3.5" />
                </button>
            </div>
            <div className="pl-8 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="relative">
                    <input 
                        type="text"
                        value={task.reason || ''}
                        onChange={e => onUpdate({ reason: e.target.value })}
                        placeholder="Reason if not done"
                        disabled={task.isCompleted}
                        className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-xs px-2 py-1 focus:ring-1 focus:ring-primary outline-none disabled:opacity-50"
                    />
                </div>
                <div className="relative">
                     <input 
                        type="number"
                        value={task.timeInvestedMinutes || ''}
                        onChange={e => onUpdate({ timeInvestedMinutes: parseInt(e.target.value) || 0 })}
                        placeholder="0"
                        className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-xs px-2 py-1 text-right focus:ring-1 focus:ring-primary outline-none"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">min</span>
                </div>
            </div>
        </div>
    );
};