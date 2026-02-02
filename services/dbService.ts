
const DB_NAME = 'FocusFlowDB';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

let dbInstance: IDBDatabase | null = null;
let connectionPending: Promise<IDBDatabase> | null = null;

export const initDB = (): Promise<IDBDatabase> => {
    if (dbInstance) {
        return Promise.resolve(dbInstance);
    }
    
    if (connectionPending) {
        return connectionPending;
    }

    connectionPending = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('IndexedDB error:', request.error);
            connectionPending = null;
            reject(request.error);
        };

        request.onsuccess = (event) => {
            const db = request.result;
            
            db.onclose = () => {
                console.warn('IndexedDB connection closed');
                dbInstance = null;
                connectionPending = null;
            };

            db.onversionchange = () => {
                console.warn('IndexedDB version change');
                db.close();
                dbInstance = null;
                connectionPending = null;
            };

            dbInstance = db;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });

    // Clean up pending promise if it fails
    connectionPending.catch(() => {
        connectionPending = null;
    });

    return connectionPending;
};

export const getData = async <T>(key: string): Promise<T | null> => {
    try {
        const db = await initDB();
        return new Promise((resolve) => {
            try {
                const transaction = db.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(key);

                request.onsuccess = () => resolve(request.result ?? null);
                request.onerror = () => {
                    console.error(`Error reading ${key}:`, request.error);
                    resolve(null);
                };
            } catch (e) {
                // If transaction fails creation (e.g. connection closed), reset and return null (safe fail)
                console.warn("Transaction creation failed (read), resetting connection", e);
                dbInstance = null;
                connectionPending = null;
                resolve(null); 
            }
        });
    } catch (e) {
        console.error("DB Init failed (read)", e);
        return null;
    }
};

export const saveData = async (key: string, val: any, retryCount = 0): Promise<void> => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put(val, key);

                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            } catch (e: any) {
                // Catch "Database connection is closing" or InvalidStateError
                if (retryCount < 1) {
                    console.warn("Transaction failed (write), retrying...", e);
                    dbInstance = null;
                    connectionPending = null;
                    // Recursive retry
                    saveData(key, val, retryCount + 1).then(resolve).catch(reject);
                } else {
                    console.error("Max retries reached for DB Save", e);
                    reject(e);
                }
            }
        });
    } catch (e) {
        // Catch initDB failures
        if (retryCount < 1) {
            dbInstance = null;
            connectionPending = null;
            return saveData(key, val, retryCount + 1);
        }
        console.error(`DB Save failed for ${key}`, e);
        throw e;
    }
};
