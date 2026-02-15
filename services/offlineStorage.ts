/**
 * Offline Storage Service using IndexedDB
 * Provides instant app loads and offline functionality
 * Alternative to Dexie.js - native IndexedDB wrapper
 */

const DB_NAME = 'FocusFlowDB';
const DB_VERSION = 1;

// Store names
const STORES = {
  KNOWLEDGE_BASE: 'knowledgeBase',
  STUDY_SESSIONS: 'studySessions',
  PLANNER: 'planner',
  SETTINGS: 'settings',
  CACHE: 'cache',
};

let db: IDBDatabase | null = null;

/**
 * Initialize IndexedDB
 */
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log('✅ IndexedDB initialized');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create object stores
      if (!database.objectStoreNames.contains(STORES.KNOWLEDGE_BASE)) {
        const kbStore = database.createObjectStore(STORES.KNOWLEDGE_BASE, {
          keyPath: 'pageNumber',
        });
        kbStore.createIndex('system', 'system', { unique: false });
        kbStore.createIndex('lastStudiedAt', 'lastStudiedAt', { unique: false });
      }

      if (!database.objectStoreNames.contains(STORES.STUDY_SESSIONS)) {
        const sessionsStore = database.createObjectStore(STORES.STUDY_SESSIONS, {
          keyPath: 'id',
        });
        sessionsStore.createIndex('date', 'date', { unique: false });
        sessionsStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!database.objectStoreNames.contains(STORES.PLANNER)) {
        database.createObjectStore(STORES.PLANNER, { keyPath: 'id' });
      }

      if (!database.objectStoreNames.contains(STORES.SETTINGS)) {
        database.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }

      if (!database.objectStoreNames.contains(STORES.CACHE)) {
        const cacheStore = database.createObjectStore(STORES.CACHE, {
          keyPath: 'key',
        });
        cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      console.log('✅ IndexedDB stores created');
    };
  });
};

/**
 * Generic get operation
 */
export const getItem = async <T>(
  storeName: string,
  key: string | number
): Promise<T | null> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Generic set operation
 */
export const setItem = async <T>(
  storeName: string,
  item: T
): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * Generic delete operation
 */
export const deleteItem = async (
  storeName: string,
  key: string | number
): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * Get all items from a store
 */
export const getAllItems = async <T>(storeName: string): Promise<T[]> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Clear all items from a store
 */
export const clearStore = async (storeName: string): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * Cache Firebase data for offline access
 */
export const cacheFirebaseData = async <T>(key: string, data: T): Promise<void> => {
  await setItem(STORES.CACHE, {
    key,
    data,
    timestamp: Date.now(),
  });
};

/**
 * Get cached Firebase data
 */
export const getCachedData = async <T>(key: string): Promise<T | null> => {
  const cached = await getItem<{ key: string; data: T; timestamp: number }>(
    STORES.CACHE,
    key
  );
  return cached ? cached.data : null;
};

/**
 * Check if cached data is fresh (within 5 minutes)
 */
export const isCacheFresh = async (
  key: string,
  maxAge: number = 5 * 60 * 1000
): Promise<boolean> => {
  const cached = await getItem<{ timestamp: number }>(STORES.CACHE, key);
  if (!cached) return false;
  return Date.now() - cached.timestamp < maxAge;
};

/**
 * Sync local changes to Firebase when online
 */
export const getPendingSync = async (): Promise<any[]> => {
  // Get items marked for sync from local storage
  const pending = localStorage.getItem('pendingSync');
  return pending ? JSON.parse(pending) : [];
};

export const addToPendingSync = (item: any): void => {
  const pending = getPendingSync();
  localStorage.setItem('pendingSync', JSON.stringify([...pending, item]));
};

export const clearPendingSync = (): void => {
  localStorage.removeItem('pendingSync');
};

/**
 * Knowledge Base specific operations
 */
export const kbStorage = {
  getAll: () => getAllItems(STORES.KNOWLEDGE_BASE),
  get: (pageNumber: string) => getItem(STORES.KNOWLEDGE_BASE, pageNumber),
  set: (entry: any) => setItem(STORES.KNOWLEDGE_BASE, entry),
  delete: (pageNumber: string) => deleteItem(STORES.KNOWLEDGE_BASE, pageNumber),
  clear: () => clearStore(STORES.KNOWLEDGE_BASE),
};

/**
 * Study Sessions specific operations
 */
export const sessionsStorage = {
  getAll: () => getAllItems(STORES.STUDY_SESSIONS),
  get: (id: string) => getItem(STORES.STUDY_SESSIONS, id),
  set: (session: any) => setItem(STORES.STUDY_SESSIONS, session),
  delete: (id: string) => deleteItem(STORES.STUDY_SESSIONS, id),
  clear: () => clearStore(STORES.STUDY_SESSIONS),
};

/**
 * Settings specific operations
 */
export const settingsStorage = {
  get: (key: string) => getItem(STORES.SETTINGS, key),
  set: (key: string, value: any) =>
    setItem(STORES.SETTINGS, { key, value }),
  delete: (key: string) => deleteItem(STORES.SETTINGS, key),
};

/**
 * Example usage:
 * 
 * // Cache Knowledge Base data
 * await cacheFirebaseData('knowledgeBase', knowledgeBaseEntries);
 * 
 * // Get cached data (instant load)
 * const cached = await getCachedData('knowledgeBase');
 * if (cached) {
 *   setKnowledgeBase(cached); // Instant UI update
 * }
 * 
 * // Then fetch fresh data from Firebase in background
 * const fresh = await fetchFromFirebase();
 * setKnowledgeBase(fresh);
 * await cacheFirebaseData('knowledgeBase', fresh);
 */
