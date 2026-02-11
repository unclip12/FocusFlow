import React, { useState, useEffect } from 'react';
import { initNetworkService, isOnline, onNetworkChange, getConnectionType } from '../services/networkService';
import { getQueueSize } from '../services/offlineQueueService';

/**
 * Network Indicator Component
 * Shows current network status and offline queue count
 */
export const NetworkIndicator = () => {
    const [online, setOnline] = useState(true);
    const [queueSize, setQueueSize] = useState(0);
    const [connectionType, setConnectionType] = useState<string>('wifi');

    useEffect(() => {
        // Initialize network service
        initNetworkService();

        // Check initial status
        isOnline().then(status => {
            setOnline(status);
        });

        getConnectionType().then(type => {
            setConnectionType(type);
        });

        // Subscribe to network changes
        const unsubscribe = onNetworkChange((isOnlineNow) => {
            setOnline(isOnlineNow);
            
            // Update connection type
            getConnectionType().then(type => {
                setConnectionType(type);
            });
        });

        // Update queue size periodically
        const updateQueue = () => {
            setQueueSize(getQueueSize());
        };
        
        updateQueue();
        const interval = setInterval(updateQueue, 2000); // Check every 2 seconds

        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, []);

    // Don't show anything if online and no queue
    if (online && queueSize === 0) {
        return null;
    }

    return (
        <div className="flex items-center gap-1 ml-2 animate-fade-in">
            {!online ? (
                <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap bg-amber-50/80 dark:bg-amber-900/30 px-2 py-1 rounded-full shadow-sm backdrop-blur-sm border border-amber-200/50 dark:border-amber-800/30">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                        <path fillRule="evenodd" d="M1 12.5A4.5 4.5 0 005.5 17H15a4 4 0 001.866-7.539 3.504 3.504 0 00-4.504-4.272A4.5 4.5 0 004.06 8.235 4.502 4.502 0 001 12.5zM11 9.25a.75.75 0 10-1.5 0v2.546l-.943-.943a.75.75 0 10-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l2.25-2.25a.75.75 0 10-1.06-1.06l-.943.943V9.25z" clipRule="evenodd" />
                    </svg>
                    <span>Offline</span>
                    {queueSize > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 bg-amber-600 dark:bg-amber-500 text-white rounded-full text-[9px] font-extrabold">
                            {queueSize}
                        </span>
                    )}
                </div>
            ) : queueSize > 0 ? (
                <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap bg-blue-50/80 dark:bg-blue-900/30 px-2 py-1 rounded-full shadow-sm backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/30">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 animate-spin">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v4.59L7.3 9.24a.75.75 0 00-1.1 1.02l3.25 3.5a.75.75 0 001.1 0l3.25-3.5a.75.75 0 10-1.1-1.02l-1.95 2.1V6.75z" clipRule="evenodd" />
                    </svg>
                    <span>Syncing {queueSize}</span>
                </div>
            ) : null}
        </div>
    );
};
