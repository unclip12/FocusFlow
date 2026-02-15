/**
 * Service Worker Registration
 * Enables offline support and PWA capabilities
 */

export const isServiceWorkerSupported = (): boolean => {
    return 'serviceWorker' in navigator;
};

export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
    if (!isServiceWorkerSupported()) {
        console.warn('⚠️ Service Workers not supported');
        return null;
    }

    try {
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
            scope: '/',
        });

        console.log('✅ Service Worker registered:', registration.scope);

        // Check for updates
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
                console.log('🔄 New Service Worker installing...');
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('✨ New version available! Reload to update.');
                        // Optionally notify user about update
                    }
                });
            }
        });

        return registration;
    } catch (error) {
        console.error('❌ Service Worker registration failed:', error);
        return null;
    }
};

export const unregisterServiceWorker = async (): Promise<boolean> => {
    if (!isServiceWorkerSupported()) {
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        const success = await registration.unregister();
        console.log('🗑️ Service Worker unregistered:', success);
        return success;
    } catch (error) {
        console.error('❌ Service Worker unregister failed:', error);
        return false;
    }
};

/**
 * Check if app is running in standalone mode (installed PWA)
 */
export const isStandalone = (): boolean => {
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true
    );
};

/**
 * Request persistent storage (for PWA)
 */
export const requestPersistentStorage = async (): Promise<boolean> => {
    if ('storage' in navigator && 'persist' in navigator.storage) {
        try {
            const persisted = await navigator.storage.persist();
            console.log(persisted ? '✅ Storage persisted' : '⚠️ Storage not persisted');
            return persisted;
        } catch (error) {
            console.error('❌ Error requesting persistent storage:', error);
            return false;
        }
    }
    return false;
};
