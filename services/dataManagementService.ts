
import { auth, db } from "./firebase";
import { initDB } from "./dbService";

// List of all collections that store user data
const USER_COLLECTIONS = [
    'knowledgeBase',
    'studyPlan',
    'dayPlans',
    'timeLogs',
    'materials',
    'materialsFromChat', 
    'mentorMessages',
    'dailyTrackers',
    'fmgeData', 
    'history'
];

/**
 * Deeply traverses an object to convert Firestore Timestamps to ISO strings.
 * Also removes undefined values.
 */
const sanitizeExportData = (data: any): any => {
    if (data === null || data === undefined) return null;
    
    // Handle Firestore Timestamps (objects with toDate method)
    if (typeof data === 'object' && typeof data.toDate === 'function') {
        return data.toDate().toISOString();
    }
    
    if (Array.isArray(data)) {
        return data.map(sanitizeExportData);
    }

    if (typeof data === 'object') {
        const newData: any = {};
        for (const key in data) {
            const value = data[key];
            if (value !== undefined) {
                newData[key] = sanitizeExportData(value);
            }
        }
        return newData;
    }

    return data;
};

/**
 * Deeply traverses an object to fix broken Timestamp objects ({seconds, nanoseconds})
 * converting them back to valid ISO strings during import.
 * Also removes undefined values which Firestore rejects.
 */
const sanitizeImportData = (data: any, logFix?: (msg: string) => void): any => {
    if (data === null || data === undefined) return null;

    // Detect and fix broken Timestamp objects from JSON
    // Relaxed check: If it has seconds and nanoseconds as numbers, treat as Timestamp
    // Also checks for _seconds (internal format sometimes)
    if (typeof data === 'object' && data !== null) {
        const hasSeconds = typeof data.seconds === 'number' || typeof data._seconds === 'number';
        const hasNanos = typeof data.nanoseconds === 'number' || typeof data._nanoseconds === 'number';
        
        if (hasSeconds && hasNanos && Object.keys(data).length <= 4) { // usually only has these fields + type info
             try {
                 const seconds = data.seconds ?? data._seconds;
                 const nanoseconds = data.nanoseconds ?? data._nanoseconds;
                 const millis = seconds * 1000 + nanoseconds / 1000000;
                 const fixed = new Date(millis).toISOString();
                 return fixed;
             } catch (e) {
                 return data;
             }
        }
    }
    
    if (Array.isArray(data)) {
        return data.map(item => sanitizeImportData(item, logFix));
    }

    if (typeof data === 'object') {
        const newData: any = {};
        for (const key in data) {
            const value = data[key];
            if (value !== undefined) {
                newData[key] = sanitizeImportData(value, logFix);
            }
        }
        return newData;
    }

    return data;
};

export interface BackupAnalysis {
    valid: boolean;
    counts: Record<string, number>;
    warnings: string[];
    totalItems: number;
}

export const analyzeBackup = (jsonData: any): BackupAnalysis => {
    const result: BackupAnalysis = {
        valid: false,
        counts: {},
        warnings: [],
        totalItems: 0
    };

    if (!jsonData || !jsonData.data) {
        result.warnings.push("Invalid File: Missing 'data' root property.");
        return result;
    }

    result.valid = true;

    for (const col of USER_COLLECTIONS) {
        const items = jsonData.data[col];
        if (Array.isArray(items)) {
            result.counts[col] = items.length;
            result.totalItems += items.length;
            
            // Check first item for common issues
            if (items.length > 0) {
                const sample = items[0];
                if (!sample.id) result.warnings.push(`Collection '${col}' has items without IDs.`);
                if (col === 'knowledgeBase' && !sample.pageNumber) {
                    result.warnings.push(`Knowledge Base items missing 'pageNumber'. Auto-fix will attempt to use ID.`);
                }
            }
        }
        
        // Check subcollections (Material Chats)
        if (col === 'materials' && jsonData.data['materialChats']) {
            let chatCount = 0;
            const chatsMap = jsonData.data['materialChats'];
            Object.values(chatsMap).forEach((chats: any) => {
                if (Array.isArray(chats)) chatCount += chats.length;
            });
            if (chatCount > 0) {
                result.counts['materialChats'] = chatCount;
                result.totalItems += chatCount;
            }
        }
    }

    if (result.totalItems === 0) {
        result.warnings.push("File structure seems valid but contains 0 items across all collections.");
    }

    return result;
};

export const exportUserData = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error("No user logged in");
    const uid = auth.currentUser.uid;
    const backupData: Record<string, any> = {
        meta: {
            version: 1,
            timestamp: new Date().toISOString(),
            uid: uid
        },
        data: {}
    };

    console.log("Starting export...");

    // 1. Fetch Main Collections
    for (const colName of USER_COLLECTIONS) {
        try {
            const colRef = db.collection('users').doc(uid).collection(colName);
            const snapshot = await colRef.get();
            if (!snapshot.empty) {
                const rawData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                // Sanitize dates before saving
                backupData.data[colName] = sanitizeExportData(rawData);
                console.log(`Exported ${snapshot.size} items from ${colName}`);
            }
        } catch (e) {
            console.warn(`Failed to export collection ${colName}`, e);
        }
    }

    // 2. Special Handling: Material Chats (Subcollection)
    const materials = backupData.data['materials'] || [];
    backupData.data['materialChats'] = {};
    
    if (materials.length > 0) {
        for (const mat of materials) {
            try {
                const subColRef = db.collection('users').doc(uid).collection('materials').doc(mat.id).collection('chats');
                const snap = await subColRef.get();
                if (!snap.empty) {
                    const rawChats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    backupData.data['materialChats'][mat.id] = sanitizeExportData(rawChats);
                }
            } catch (e) {
                console.warn(`Failed to export chats for material ${mat.id}`, e);
            }
        }
    }

    // 3. Configs (Single Docs)
    const configCollections = ['config', 'profile', 'aiMentorMemory'];
    for (const conf of configCollections) {
        try {
            const colRef = db.collection('users').doc(uid).collection(conf);
            const snapshot = await colRef.get();
            if (!snapshot.empty) {
                const rawData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                backupData.data[conf] = sanitizeExportData(rawData);
            }
        } catch (e) {
            console.warn(`Failed to export config ${conf}`, e);
        }
    }

    // 4. Trigger Download using Blob
    try {
        const jsonStr = JSON.stringify(backupData);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", url);
        downloadAnchorNode.setAttribute("download", `focusflow_FULL_backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode); 
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        URL.revokeObjectURL(url);
        console.log("Export complete.");
    } catch (e) {
        console.error("Export failed during file creation", e);
        throw new Error("Failed to create backup file. Data might be too large.");
    }
};

export const importUserData = async (
    jsonData: any,
    onProgress?: (current: number, total: number, status: string) => void
): Promise<{ success: boolean, logs: string[] }> => {
    if (!auth.currentUser) throw new Error("No user logged in");
    const uid = auth.currentUser.uid;
    const logs: string[] = [];

    const log = (msg: string) => {
        console.log(`[RESTORE] ${msg}`);
        logs.push(`${new Date().toLocaleTimeString()} - ${msg}`);
    };

    if (!jsonData.data) {
        log("ERROR: Invalid backup file. Missing 'data' object.");
        return { success: false, logs };
    }

    log("Starting import analysis...");

    // 1. Calculate Total Operations
    let totalOps = 0;
    const collectionsToRestore = Object.keys(jsonData.data);
    
    for (const colName of collectionsToRestore) {
        if (colName === 'materialChats') {
            const matIds = Object.keys(jsonData.data['materialChats']);
            for (const matId of matIds) {
                if (Array.isArray(jsonData.data['materialChats'][matId])) {
                    totalOps += jsonData.data['materialChats'][matId].length;
                }
            }
        } else if (Array.isArray(jsonData.data[colName])) {
            totalOps += jsonData.data[colName].length;
        }
    }

    if (totalOps === 0) {
        log("WARNING: Backup file contains 0 items.");
        return { success: true, logs };
    }

    log(`Found ${totalOps} items to restore across ${collectionsToRestore.length} collections.`);

    let processedOps = 0;
    let batch = db.batch();
    let batchCount = 0;
    
    // SMART BATCHING CONFIG (CONSERVATIVE)
    let currentBatchSizeBytes = 0;
    const MAX_BATCH_COUNT = 50; // Very small chunks to prevent "Payload too large"
    const MAX_BATCH_SIZE_BYTES = 500 * 1024; // 0.5 MB limit per batch request (Safe zone)
    const MAX_DOC_SIZE_BYTES = 1 * 1024 * 1024 - 1024; // 1MB - 1KB safety margin (Firestore Limit)

    // Helper to calculate size properly
    const getObjectSize = (obj: any) => new Blob([JSON.stringify(obj)]).size;

    // Helper to commit and reset batch
    const commitCurrentBatch = async () => {
        if (batchCount > 0) {
            const sizeKB = (currentBatchSizeBytes / 1024).toFixed(2);
            log(`Committing batch of ${batchCount} items (~${sizeKB}KB)...`);
            try {
                await batch.commit();
                batch = db.batch(); // Create NEW batch instance
                batchCount = 0;
                currentBatchSizeBytes = 0;
                // log("Batch committed.");
            } catch (e: any) {
                log(`ERROR Committing Batch: ${e.message}`);
                throw e;
            }
        }
    };

    try {
        // 2. Restore Collections
        for (const colName of collectionsToRestore) {
            if (colName === 'materialChats') continue; // Handled later

            const items = jsonData.data[colName];
            if (Array.isArray(items) && items.length > 0) {
                log(`Processing ${colName} (${items.length} items)...`);
                if (onProgress) onProgress(processedOps, totalOps, `Restoring ${colName}...`);
                
                for (const item of items) {
                    if (!item.id) {
                        log(`WARN: Item in ${colName} missing 'id', skipping.`);
                        continue;
                    }
                    
                    const docRef = db.collection('users').doc(uid).collection(colName).doc(item.id);
                    
                    if (colName === 'knowledgeBase') {
                        if (!item.pageNumber) {
                            item.pageNumber = item.id;
                        }
                        if (!item.logs) item.logs = [];
                        if (!item.topics) item.topics = [];
                    }

                    if (colName === 'fmgeData' && !item.subject) {
                        item.subject = 'Unknown';
                    }

                    // Sanitize Data
                    const dataToSave = sanitizeImportData(item);
                    const itemSize = getObjectSize(dataToSave);

                    // CHECK 1: Single Document Limit
                    if (itemSize > MAX_DOC_SIZE_BYTES) {
                        const pageNum = item.pageNumber || item.id;
                        log(`SKIPPING item '${pageNum}' in ${colName}: Too large (${(itemSize/1024).toFixed(1)}KB). Firestore limit is 1MB.`);
                        // Optional: Could strip attachments here to save partial data, but skipping is safer to avoid corruption.
                        continue; 
                    }

                    // CHECK 2: Batch Limit (Size or Count)
                    if (batchCount >= MAX_BATCH_COUNT || (currentBatchSizeBytes + itemSize) > MAX_BATCH_SIZE_BYTES) {
                        await commitCurrentBatch();
                    }
                    
                    batch.set(docRef, dataToSave);
                    batchCount++;
                    currentBatchSizeBytes += itemSize;
                    processedOps++;

                    if (onProgress && processedOps % 20 === 0) {
                         onProgress(processedOps, totalOps, `Restoring ${colName}...`);
                    }
                }
            }
        }

        // 3. Restore Material Chats
        if (jsonData.data['materialChats']) {
            if (onProgress) onProgress(processedOps, totalOps, `Restoring Chat History...`);
            
            const matIds = Object.keys(jsonData.data['materialChats']);
            for (const matId of matIds) {
                const chats = jsonData.data['materialChats'][matId];
                if (Array.isArray(chats)) {
                    for (const chat of chats) {
                        if (!chat.id) continue;
                        
                        const docRef = db.collection('users').doc(uid).collection('materials').doc(matId).collection('chats').doc(chat.id);
                        const dataToSave = sanitizeImportData(chat);
                        const itemSize = getObjectSize(dataToSave);
                        
                        if (batchCount >= MAX_BATCH_COUNT || (currentBatchSizeBytes + itemSize) > MAX_BATCH_SIZE_BYTES) {
                            await commitCurrentBatch();
                        }

                        batch.set(docRef, dataToSave);
                        batchCount++;
                        currentBatchSizeBytes += itemSize;
                        processedOps++;
                    }
                }
            }
        }

        // Final Flush
        await commitCurrentBatch();
        
        if (onProgress) onProgress(totalOps, totalOps, "Finalizing...");
        
        // Clear local cache to force reload from Firestore on next app start
        try {
            log("Clearing local device cache...");
            await clearLocalDatabase();
        } catch (e: any) {
            log(`WARN: Failed to clear local DB: ${e.message}`);
        }

        log("Import Process Complete.");
        return { success: true, logs };

    } catch (e: any) {
        log(`CRITICAL ERROR: ${e.message}`);
        console.error("Import Batch Failed:", e);
        return { success: false, logs };
    }
};

export const resetAppData = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error("No user logged in");
    const uid = auth.currentUser.uid;

    const deleteCollection = async (collectionPath: string, subCollection?: string) => {
        const colRef = db.collection(collectionPath);
        const snapshot = await colRef.get();
        
        if (snapshot.empty) return;

        let batch = db.batch();
        let count = 0;

        for (const d of snapshot.docs) {
            if (subCollection) {
                const subPath = `${collectionPath}/${d.id}/${subCollection}`;
                const subRef = db.collection(subPath);
                const subSnap = await subRef.get();
                for (const subDoc of subSnap.docs) {
                    batch.delete(subDoc.ref);
                    count++;
                    if (count >= 400) { await batch.commit(); batch = db.batch(); count = 0; }
                }
            }

            batch.delete(d.ref);
            count++;
            if (count >= 400) {
                await batch.commit();
                batch = db.batch();
                count = 0;
            }
        }
        if (count > 0) await batch.commit();
    };

    // 1. Delete Main Data Collections
    for (const col of USER_COLLECTIONS) {
        if (col === 'materials') {
            await deleteCollection(`users/${uid}/${col}`, 'chats');
        } else {
            await deleteCollection(`users/${uid}/${col}`);
        }
    }

    // 2. Delete Config/Memory
    await deleteCollection(`users/${uid}/aiMentorMemory`);
    await deleteCollection(`users/${uid}/config`);
    
    // 3. Clear Local Cache
    await clearLocalDatabase();
};

const clearLocalDatabase = async () => {
    try {
        const idb = await initDB();
        const transaction = idb.transaction('keyval', 'readwrite');
        const store = transaction.objectStore('keyval');
        store.clear();
        return new Promise<void>((resolve) => {
            transaction.oncomplete = () => resolve();
        });
    } catch (e) {
        console.warn("Failed to clear IndexedDB", e);
    }
};
