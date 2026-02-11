import { Network, ConnectionStatus } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

/**
 * Network Service
 * Monitors network connectivity and provides status updates
 */

export type NetworkStatusCallback = (isOnline: boolean) => void;

let currentStatus: ConnectionStatus | null = null;
let listeners: NetworkStatusCallback[] = [];
let isInitialized = false;

/**
 * Initialize network monitoring
 */
export async function initNetworkService(): Promise<void> {
    if (isInitialized) return;

    // Get initial status
    currentStatus = await Network.getStatus();
    console.log('Initial network status:', currentStatus.connected);

    // Listen for changes (only on native platforms)
    if (Capacitor.isNativePlatform()) {
        Network.addListener('networkStatusChange', (status: ConnectionStatus) => {
            console.log('Network status changed:', status.connected);
            currentStatus = status;
            notifyListeners(status.connected);
        });
    } else {
        // Fallback for web: use online/offline events
        window.addEventListener('online', () => {
            currentStatus = { connected: true, connectionType: 'wifi' };
            notifyListeners(true);
        });
        
        window.addEventListener('offline', () => {
            currentStatus = { connected: false, connectionType: 'none' };
            notifyListeners(false);
        });
    }

    isInitialized = true;
}

/**
 * Get current network status
 */
export async function isOnline(): Promise<boolean> {
    if (!currentStatus) {
        currentStatus = await Network.getStatus();
    }
    return currentStatus.connected;
}

/**
 * Get current connection type
 */
export async function getConnectionType(): Promise<string> {
    if (!currentStatus) {
        currentStatus = await Network.getStatus();
    }
    return currentStatus.connectionType || 'unknown';
}

/**
 * Subscribe to network status changes
 */
export function onNetworkChange(callback: NetworkStatusCallback): () => void {
    listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
        listeners = listeners.filter(cb => cb !== callback);
    };
}

/**
 * Notify all listeners of status change
 */
function notifyListeners(isOnline: boolean): void {
    listeners.forEach(callback => {
        try {
            callback(isOnline);
        } catch (err) {
            console.error('Network listener error:', err);
        }
    });
}

/**
 * Clean up network service
 */
export function cleanupNetworkService(): void {
    listeners = [];
    if (Capacitor.isNativePlatform()) {
        Network.removeAllListeners();
    }
    isInitialized = false;
}
