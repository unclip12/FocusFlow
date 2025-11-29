
import { AppSnapshot, HistoryRecord } from "../types";
import { auth, db, getDayPlan, getFMGEData, getKnowledgeBase, saveDayPlan, saveFMGEEntry, saveKnowledgeBase } from "./firebase";

const MAX_HISTORY_ITEMS = 30; // Keep last 30 in cloud to save space

// --- CORE SNAPSHOT LOGIC ---

/**
 * Captures the current state of the critical parts of the app and saves to Firebase.
 * @param description - Description of the snapshot
 * @param type - 'SNAPSHOT' (Manual) or 'AUTO_DAILY' (4 AM)
 */
export const createSnapshot = async (description: string, type: 'SNAPSHOT' | 'AUTO_DAILY' = 'SNAPSHOT'): Promise<void> => {
    if (!auth.currentUser) return;

    try {
        // 1. Gather Data
        const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
        
        const [kb, plan, fmge] = await Promise.all([
            getKnowledgeBase(),
            getDayPlan(todayStr), // Snapshot today's plan specifically
            getFMGEData()
        ]);

        const snapshotData: AppSnapshot = {
            kb: kb || [],
            dayPlan: plan,
            fmge: fmge || []
        };

        const record: HistoryRecord = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            type: type,
            description,
            snapshot: snapshotData,
            isFullSnapshot: true
        };

        // 2. Save to Firebase Subcollection
        const historyRef = db.collection('users').doc(auth.currentUser.uid).collection('history');
        
        // Add new record
        await historyRef.add(record);

        // 3. Prune Old History
        pruneOldHistory();

    } catch (e) {
        console.error("Failed to create cloud snapshot", e);
    }
};

/**
 * Checks if a daily automatic backup (4 AM) has been made for today.
 * If not, and the current time is past 4 AM, triggers the backup.
 * optimized to avoid composite index requirements.
 */
export const checkAndTriggerDailyBackup = async () => {
    if (!auth.currentUser) return;

    try {
        const now = new Date();
        const today4AM = new Date();
        today4AM.setHours(4, 0, 0, 0);

        // If currently before 4 AM, do nothing (wait for 4 AM to pass)
        if (now.getTime() < today4AM.getTime()) {
            return;
        }

        const historyRef = db.collection('users').doc(auth.currentUser.uid).collection('history');
        
        // OPTIMIZATION: Avoid .where('type') .orderBy('timestamp') composite index.
        // Just fetch the most recent logs and filter in memory. 
        // Since we prune to 30 items, this is very cheap.
        const snapshot = await historyRef
            .orderBy('timestamp', 'desc')
            .limit(30)
            .get();

        let lastBackupTime = 0;
        
        // Find the most recent AUTO_DAILY record
        const autoBackupDoc = snapshot.docs.find(doc => {
            const data = doc.data();
            return data.type === 'AUTO_DAILY';
        });

        if (autoBackupDoc) {
            const data = autoBackupDoc.data();
            lastBackupTime = new Date(data.timestamp).getTime();
        }

        // If last backup was before today's 4 AM cutoff, we need a new one.
        if (lastBackupTime < today4AM.getTime()) {
            console.log("Triggering Daily Auto Backup (4 AM Cycle)...");
            await createSnapshot(`Auto Backup (${new Date().toLocaleDateString()})`, 'AUTO_DAILY');
        }

    } catch (e) {
        console.error("Failed to check daily backup", e);
    }
};

const pruneOldHistory = async () => {
    if (!auth.currentUser) return;
    try {
        const historyRef = db.collection('users').doc(auth.currentUser.uid).collection('history');
        const snapshot = await historyRef.orderBy('timestamp', 'desc').get();
        
        if (snapshot.size > MAX_HISTORY_ITEMS) {
            const docsToDelete = snapshot.docs.slice(MAX_HISTORY_ITEMS);
            const batch = db.batch();
            docsToDelete.forEach(d => batch.delete(d.ref));
            await batch.commit();
        }
    } catch (e) {
        console.warn("Pruning failed", e);
    }
};

export const getHistory = async (): Promise<HistoryRecord[]> => {
    if (!auth.currentUser) return [];

    try {
        const historyRef = db.collection('users').doc(auth.currentUser.uid).collection('history');
        const snapshot = await historyRef.orderBy('timestamp', 'desc').limit(MAX_HISTORY_ITEMS).get();

        return snapshot.docs.map(d => {
            const data = d.data();
            return {
                id: d.id, // Use Firestore ID
                timestamp: data.timestamp,
                type: data.type,
                description: data.description,
                snapshot: data.snapshot,
                isFullSnapshot: data.isFullSnapshot
            } as HistoryRecord;
        });
    } catch (e) {
        console.error("Failed to fetch history", e);
        return [];
    }
};

export const restoreSnapshot = async (snapshotId: string): Promise<boolean> => {
    if (!auth.currentUser) return false;

    try {
        const docRef = db.collection('users').doc(auth.currentUser.uid).collection('history').doc(snapshotId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            console.error("Snapshot not found");
            return false;
        }

        const record = docSnap.data() as HistoryRecord;
        if (!record.snapshot) {
            console.error("Snapshot data missing content");
            return false;
        }

        const snap = record.snapshot as AppSnapshot;

        // RESTORE PROCESS
        // 1. Knowledge Base (Overwrite)
        if (snap.kb) await saveKnowledgeBase(snap.kb);
        
        // 2. Day Plan (Overwrite for the specific date in snapshot)
        if (snap.dayPlan) await saveDayPlan(snap.dayPlan);
        
        // 3. FMGE (Overwrite)
        if (snap.fmge) {
            for (const entry of snap.fmge) {
                await saveFMGEEntry(entry);
            }
        }

        return true;
    } catch (e) {
        console.error("Restore failed", e);
        return false;
    }
};

// Alias for compatibility
export const saveSnapshot = createSnapshot;
// No-op for legacy granular updates
export const addToHistory = (record: any) => {
    // Intentionally empty to stop auto-backup on every action
};
export const clearHistory = async () => {
    // Not implemented for cloud to prevent accidental wipe of backups
};
