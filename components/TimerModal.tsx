
import React, { useState, useEffect, useRef } from 'react';
import { PauseIcon, PlayIcon, StopIcon } from './Icons';

interface TimerModalProps {
  isOpen: boolean;
  onClose: () => void; // Abort
  onFinish: (startTime: string, endTime: string) => void;
  topic: string;
}

const TimerModal: React.FC<TimerModalProps> = ({ isOpen, onClose, onFinish, topic }) => {
  const [isActive, setIsActive] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Auto start
      setStartTime(Date.now());
      setIsActive(true);
      setElapsed(0);
    } else {
      // Reset when closed
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsActive(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isActive) {
      intervalRef.current = window.setInterval(() => {
        setElapsed(Date.now() - (startTime || Date.now()));
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, startTime]);

  const handleFinish = () => {
    if (!startTime) return;
    const end = new Date();
    const start = new Date(startTime);
    onFinish(start.toISOString(), end.toISOString());
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/10 backdrop-blur-[2px] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[280px] p-6 animate-fade-in-up border border-indigo-100 relative">
        
        <div className="text-center mb-4">
             <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Studying</h3>
             <p className="text-sm font-bold text-slate-800 truncate">{topic}</p>
        </div>

        <div className="text-4xl font-mono font-bold text-slate-800 text-center mb-6 tracking-tight">
          {formatTime(elapsed)}
        </div>

        <div className="flex items-center justify-center gap-4">
          <button 
            onClick={() => setIsActive(!isActive)}
            className={`p-3 rounded-full transition-all shadow-sm ${isActive ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}
          >
            {isActive ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
          </button>
          
          <button 
            onClick={handleFinish}
            className="p-3 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-all shadow-sm"
            title="Finish & Log"
          >
            <StopIcon className="w-5 h-5" />
          </button>
        </div>
        
        <button onClick={onClose} className="w-full text-center mt-4 text-xs text-slate-400 hover:text-slate-600">
            Cancel
        </button>
      </div>
    </div>
  );
};

export default TimerModal;
