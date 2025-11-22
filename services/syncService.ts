
type SyncListener = (active: boolean) => void;
const listeners = new Set<SyncListener>();
let activeRequests = 0;

export const notifySyncStart = () => {
    if (activeRequests === 0) {
        listeners.forEach(l => l(true));
    }
    activeRequests++;
};

export const notifySyncEnd = () => {
    activeRequests--;
    if (activeRequests <= 0) {
        activeRequests = 0; // Safety reset
        listeners.forEach(l => l(false));
    }
};

export const subscribeToSync = (listener: SyncListener) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};
