import React, { useState, useEffect, useRef } from 'react';
import { PauseIcon, PlayIcon, StopIcon, BellIcon, BellAlertIcon } from './Icons';

interface TimerModalProps {
  isOpen: boolean;
  onClose: () => void; // Abort
  onFinish: (startTime: string, endTime: string) => void;
  topic: string;
  targetMinutes?: number;
}

const TimerModal: React.FC<TimerModalProps> = ({ isOpen, onClose, onFinish, topic, targetMinutes }) => {
  const [isActive, setIsActive] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<number | null>(null);

  // Notification & Alert State
  const [alertDuration, setAlertDuration] = useState<number | ''>(targetMinutes || 60);
  const [notified, setNotified] = useState(false);
  // Safe permission check
  const [permission, setPermission] = useState<NotificationPermission>(
      typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

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
      // Auto start
      setStartTime(Date.now());
      setIsActive(true);
      setElapsed(0);
      setNotified(false);
      if (targetMinutes) setAlertDuration(targetMinutes);

      // Request Permission if default
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
          Notification.requestPermission().then(p => setPermission(p));
      }
    } else {
      // Reset when closed
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsActive(false);
    }
  }, [isOpen, targetMinutes]);

  useEffect(() => {
    if (isActive) {
      intervalRef.current = window.setInterval(() => {
        const currentElapsed = Date.now() - (startTime || Date.now());
        setElapsed(currentElapsed);
        
        // Check for Alert
        if (alertDuration && typeof alertDuration === 'number' && !notified) {
            const targetMs = alertDuration * 60 * 1000;
            if (currentElapsed >= targetMs) {
                triggerNotification();
                setNotified(true);
            }
        }

      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, startTime, alertDuration, notified]);

  const handleFinish = () => {
    if (!startTime) return;
    const end = new Date();
    const start = new Date(startTime);
    onFinish(start.toISOString(), end.toISOString());
  };

  const playSound = () => {
      try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(550, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
          
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
          
          osc.start();
          osc.stop(ctx.currentTime + 0.5);
      } catch (e) {
          console.error("Audio play failed", e);
      }
  };

  const triggerNotification = () => {
      playSound();
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification("FocusFlow Timer", {
                body: `Time's up for: ${topic}!`,
                icon: '/icon.png', // Will use PWA icon if available or fail gracefully
                tag: 'timer-alert'
            });
          } catch (e) {
              console.error("Notification failed", e);
          }
      }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    
    if (h > 0) {
         return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Calculate Progress
  const progressPercent = (alertDuration && typeof alertDuration === 'number') 
    ? Math.min(100, (elapsed / (alertDuration * 60 * 1000)) * 100) 
    : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-[300px] max-h-[90vh] flex flex-col animate-fade-in-up border border-indigo-100 dark:border-slate-700 relative overflow-hidden">
        
        {/* Progress Bar Background */}
        <div className="absolute top-0 left-0 h-1 bg-slate-100 dark:bg-slate-700 w-full z-10">
            <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
        </div>

        <div className="p-6 overflow-y-auto">
            <div className="text-center mb-4 mt-2">
                 <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Studying</h3>
                 <p className="text-sm font-bold text-slate-800 dark:text-white truncate px-2">{topic}</p>
            </div>

            <div className="text-5xl font-mono font-bold text-slate-800 dark:text-white text-center mb-6 tracking-tight">
              {formatTime(elapsed)}
            </div>

            <div className="flex items-center justify-center gap-6 mb-6">
              <button 
                onClick={() => setIsActive(!isActive)}
                className={`p-4 rounded-full transition-all shadow-md active:scale-95 ${isActive ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}
              >
                {isActive ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
              </button>
              
              <button 
                onClick={handleFinish}
                className="p-4 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-all shadow-md active:scale-95"
                title="Finish & Log"
              >
                <StopIcon className="w-6 h-6" />
              </button>
            </div>
            
            {/* Alert Settings */}
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 mb-2">
                <div className="flex items-center gap-2 mb-2">
                    {permission === 'granted' ? (
                        <BellAlertIcon className="w-4 h-4 text-primary" />
                    ) : (
                        <BellIcon className="w-4 h-4 text-slate-400" />
                    )}
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Alert In (Min)</label>
                </div>
                <input 
                    type="number" 
                    value={alertDuration}
                    onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setAlertDuration(isNaN(val) ? '' : val);
                        setNotified(false); // Reset notification trigger if time changed
                    }}
                    className="w-full p-2 text-center font-bold text-slate-700 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg focus:border-primary outline-none text-sm"
                    placeholder="No Alert"
                />
                {typeof Notification !== 'undefined' && permission !== 'granted' && (
                    <button 
                        onClick={() => Notification.requestPermission().then(setPermission)}
                        className="text-[10px] text-primary font-bold mt-2 w-full text-center hover:underline"
                    >
                        Enable Notifications
                    </button>
                )}
            </div>

            <button onClick={onClose} className="w-full text-center mt-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                Cancel Timer
            </button>
        </div>
      </div>
    </div>
  );
};

export default TimerModal;