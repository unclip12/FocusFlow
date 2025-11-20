
const DB_NAME = 'FocusFlowDB';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

export const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
};

export const getData = async <T>(key: string): Promise<T | null> => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result === undefined ? null : request.result);
        });
    } catch (e) {
        console.error('DB Get Error', e);
        return null;
    }
};

export const saveData = async (key: string, val: any): Promise<void> => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(val, key);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    } catch (e) {
        console.error('DB Save Error', e);
    }
};
