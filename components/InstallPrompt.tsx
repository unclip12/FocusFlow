
import React, { useState, useEffect } from 'react';
import { XMarkIcon } from './Icons';
import { Capacitor } from '@capacitor/core';

export const InstallPrompt: React.FC = () => {
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        // If native, never show
        if (Capacitor.isNativePlatform()) return;

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        
        // Show if iOS and NOT standalone (running in Safari)
        if (isIOS && !isStandalone) {
            // Check if already dismissed in this session
            const dismissed = sessionStorage.getItem('installPromptDismissed');
            if (!dismissed) {
                setShowPrompt(true);
            }
        }
    }, []);

    const dismiss = () => {
        setShowPrompt(false);
        sessionStorage.setItem('installPromptDismissed', 'true');
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 z-[200] bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-indigo-200 dark:border-indigo-900 p-4 rounded-2xl shadow-2xl animate-slide-in-up">
            <div className="flex justify-between items-start">
                <div className="flex-1">
                    <h3 className="font-bold text-indigo-600 dark:text-indigo-400 text-sm mb-1">Enable Full Experience</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        For best results and <strong>notifications</strong> on iPhone/iPad:
                    </p>
                    <ol className="mt-2 text-xs text-slate-700 dark:text-slate-200 list-decimal list-inside space-y-1">
                        <li>Tap the <strong>Share</strong> button <span className="inline-block align-middle"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg></span></li>
                        <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
                    </ol>
                </div>
                <button onClick={dismiss} className="p-1 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-400 hover:text-slate-600">
                    <XMarkIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
