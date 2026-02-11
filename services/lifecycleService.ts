import { App, AppState } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * App Lifecycle Service
 * Handles app state transitions (background/foreground/terminated)
 * Manages timer pausing, state persistence, and notifications
 */

export type LifecycleCallback = (state: AppState) => void;

let listeners: LifecycleCallback[] = [];
let isInitialized = false;
let currentState: AppState = { isActive: true };

/**
 * Initialize lifecycle service
 */
export async function initLifecycleService(): Promise<void> {
    if (isInitialized) return;

    // Get initial state
    if (Capacitor.isNativePlatform()) {
        currentState = await App.getState();
        console.log('Initial app state:', currentState.isActive ? 'active' : 'background');

        // Listen for state changes
        App.addListener('appStateChange', (state: AppState) => {
            console.log('App state changed:', state.isActive ? 'active' : 'background');
            currentState = state;
            notifyListeners(state);
        });

        // Listen for app termination (Android)
        App.addListener('backButton', ({ canGoBack }) => {
            if (!canGoBack) {
                console.log('App will terminate, saving state...');
                // Trigger save before exit
                notifyListeners({ isActive: false });
            }
        });
    } else {
        // Web fallback: use visibility API
        document.addEventListener('visibilitychange', () => {
            const isActive = !document.hidden;
            currentState = { isActive };
            console.log('Web visibility changed:', isActive ? 'visible' : 'hidden');
            notifyListeners(currentState);
        });

        // Beforeunload for saving state
        window.addEventListener('beforeunload', () => {
            console.log('Web page unloading, saving state...');
            notifyListeners({ isActive: false });
        });
    }

    isInitialized = true;
}

/**
 * Check if app is currently active
 */
export function isAppActive(): boolean {
    return currentState.isActive;
}

/**
 * Subscribe to lifecycle changes
 */
export function onLifecycleChange(callback: LifecycleCallback): () => void {
    listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
        listeners = listeners.filter(cb => cb !== callback);
    };
}

/**
 * Notify all listeners of state change
 */
function notifyListeners(state: AppState): void {
    listeners.forEach(callback => {
        try {
            callback(state);
        } catch (err) {
            console.error('Lifecycle listener error:', err);
        }
    });
}

/**
 * Save app state to localStorage
 */
export function saveAppState(state: any): void {
    try {
        const timestamp = new Date().toISOString();
        const stateWithMeta = {
            ...state,
            savedAt: timestamp
        };
        localStorage.setItem('focusflow_app_state', JSON.stringify(stateWithMeta));
        console.log('App state saved:', timestamp);
    } catch (err) {
        console.error('Failed to save app state:', err);
    }
}

/**
 * Restore app state from localStorage
 */
export function restoreAppState<T>(): T | null {
    try {
        const stored = localStorage.getItem('focusflow_app_state');
        if (stored) {
            const state = JSON.parse(stored);
            console.log('App state restored from:', state.savedAt);
            return state;
        }
    } catch (err) {
        console.error('Failed to restore app state:', err);
    }
    return null;
}

/**
 * Clear saved app state
 */
export function clearAppState(): void {
    try {
        localStorage.removeItem('focusflow_app_state');
        console.log('App state cleared');
    } catch (err) {
        console.error('Failed to clear app state:', err);
    }
}

/**
 * Timer-specific lifecycle helpers
 */
export interface TimerState {
    isRunning: boolean;
    startTime: number;
    duration: number;
    mode: 'focus' | 'break';
    pausedAt?: number;
}

/**
 * Save timer state when backgrounding
 */
export function saveTimerState(timer: TimerState): void {
    try {
        localStorage.setItem('focusflow_timer_state', JSON.stringify({
            ...timer,
            savedAt: Date.now()
        }));
        console.log('Timer state saved');
    } catch (err) {
        console.error('Failed to save timer state:', err);
    }
}

/**
 * Restore timer state when foregrounding
 */
export function restoreTimerState(): (TimerState & { savedAt: number }) | null {
    try {
        const stored = localStorage.getItem('focusflow_timer_state');
        if (stored) {
            const state = JSON.parse(stored);
            console.log('Timer state restored');
            return state;
        }
    } catch (err) {
        console.error('Failed to restore timer state:', err);
    }
    return null;
}

/**
 * Clear timer state
 */
export function clearTimerState(): void {
    try {
        localStorage.removeItem('focusflow_timer_state');
        console.log('Timer state cleared');
    } catch (err) {
        console.error('Failed to clear timer state:', err);
    }
}

/**
 * Clean up lifecycle service
 */
export function cleanupLifecycleService(): void {
    if (Capacitor.isNativePlatform()) {
        App.removeAllListeners();
    }
    listeners = [];
    isInitialized = false;
}
