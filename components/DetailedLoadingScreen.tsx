import React, { useEffect, useState } from 'react';
import { AppLogo } from './Icons';

export interface LoadingStatus {
    step: string;
    message: string;
    progress: number; // 0-100
    timestamp: Date;
    isError?: boolean;
}

interface DetailedLoadingScreenProps {
    status: LoadingStatus;
    logs: LoadingStatus[];
}

export const DetailedLoadingScreen: React.FC<DetailedLoadingScreenProps> = ({ status, logs }) => {
    const [dots, setDots] = useState('');

    // Animated dots for current loading
    useEffect(() => {
        const interval = setInterval(() => {
            setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
        }, 400);
        return () => clearInterval(interval);
    }, []);

    const getElapsedTime = (timestamp: Date) => {
        const elapsed = Date.now() - timestamp.getTime();
        if (elapsed < 1000) return `${elapsed}ms`;
        return `${(elapsed / 1000).toFixed(1)}s`;
    };

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
            {/* Logo & Title */}
            <div className="flex flex-col items-center mb-8 animate-fade-in">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl mb-4 animate-pulse">
                    <AppLogo className="w-12 h-12 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">FocusFlow</h1>
                <p className="text-sm text-slate-400 dark:text-slate-500">Initializing App...</p>
            </div>

            {/* Current Status Card */}
            <div className="w-full max-w-md px-4 mb-6">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6">
                    {/* Progress Bar */}
                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                {status.step}
                            </span>
                            <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                {status.progress}%
                            </span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500 ease-out"
                                style={{ width: `${status.progress}%` }}
                            />
                        </div>
                    </div>

                    {/* Current Message */}
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                            {status.isError ? (
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            ) : (
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            )}
                        </div>
                        <div className="flex-1">
                            <p className={`text-sm font-medium leading-relaxed ${
                                status.isError 
                                    ? 'text-red-600 dark:text-red-400' 
                                    : 'text-slate-700 dark:text-slate-300'
                            }`}>
                                {status.message}{dots}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Developer Logs */}
            <div className="w-full max-w-md px-4">
                <div className="bg-slate-900 dark:bg-black rounded-2xl shadow-xl border border-slate-700 overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-2 bg-slate-800 dark:bg-slate-950 border-b border-slate-700 flex items-center gap-2">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 bg-red-500 rounded-full" />
                            <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                            <div className="w-3 h-3 bg-green-500 rounded-full" />
                        </div>
                        <span className="text-xs font-mono text-slate-400 ml-2">Loading Console</span>
                    </div>

                    {/* Logs */}
                    <div className="p-4 font-mono text-xs space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
                        {logs.slice(-10).map((log, idx) => ( // Show last 10 logs
                            <div 
                                key={idx} 
                                className="flex items-start gap-2 animate-fade-in"
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                <span className="text-slate-500 dark:text-slate-600 shrink-0">
                                    [{getElapsedTime(log.timestamp)}]
                                </span>
                                <span className={log.isError ? 'text-red-400' : 'text-green-400'}>
                                    {log.isError ? '✗' : '✓'}
                                </span>
                                <span className="text-slate-300 dark:text-slate-400 flex-1">
                                    {log.step}:
                                </span>
                                <span className="text-slate-400 dark:text-slate-500">
                                    {log.message}
                                </span>
                            </div>
                        ))}
                        {logs.length === 0 && (
                            <div className="text-slate-500 dark:text-slate-600 text-center py-8">
                                Waiting for initialization...
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer Info */}
            <div className="mt-6 text-center">
                <p className="text-xs text-slate-400 dark:text-slate-600">
                    Build: {import.meta.env.VITE_BUILD_ID || 'dev'} • 
                    Mode: {import.meta.env.MODE}
                </p>
            </div>
        </div>
    );
};

// Hook for managing loading state
export const useDetailedLoading = () => {
    const [currentStatus, setCurrentStatus] = useState<LoadingStatus>({
        step: 'INIT',
        message: 'Starting application',
        progress: 0,
        timestamp: new Date()
    });

    const [logs, setLogs] = useState<LoadingStatus[]>([]);

    const updateStatus = (step: string, message: string, progress: number, isError = false) => {
        const newStatus: LoadingStatus = {
            step,
            message,
            progress,
            timestamp: new Date(),
            isError
        };
        
        setCurrentStatus(newStatus);
        setLogs(prev => [...prev, newStatus]);
        
        // Console log for debugging
        console.log(`[${step}] ${message} (${progress}%)`);
    };

    return { currentStatus, logs, updateStatus };
};
