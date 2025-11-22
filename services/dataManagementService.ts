
import { collection, getDocs, writeBatch, doc, runTransaction } from "firebase/firestore";
import { auth, db, cleanData } from "./firebase";
import { initDB } from "./dbService";

// List of all collections that store user data
const USER_COLLECTIONS = [
    'knowledgeBase',
    'studyPlan',
    'dayPlans',
    'timeLogs',
    'materials',
    'mentorMessages',
    'dailyTrackers',
    // 'config' and 'profile' are usually kept even on data reset, 
    // but for backup/restore we might want them. 
    // For RESET, we usually want to keep the account settings but wipe data.
];

// Sub-collections are tricky in general export, but based on the app structure,
// most data seems flat or contained within documents. 
// Exception: 'materials/{id}/chats'. We need to handle deep export if necessary.
// For this version, we will focus on the main collections defined in firebase.ts usage.

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

    // 1. Fetch Main Collections
    for (const colName of USER_COLLECTIONS) {
        const colRef = collection(db, 'users', uid, colName);
        const snapshot = await getDocs(colRef);
        backupData.data[colName] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    // 2. Special Handling: Material Chats (Subcollection)
    // We need to fetch materials first to know IDs
    const materials = backupData.data['materials'] || [];
    backupData.data['materialChats'] = {};
    
    for (const mat of materials) {
        const subColRef = collection(db, 'users', uid, 'materials', mat.id, 'chats');
        const snap = await getDocs(subColRef);
        if (!snap.empty) {
            backupData.data['materialChats'][mat.id] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
    }

    // 3. Configs (Single Docs usually)
    const configCollections = ['config', 'profile', 'aiMentorMemory'];
    for (const conf of configCollections) {
        const colRef = collection(db, 'users', uid, conf);
        const snapshot = await getDocs(colRef);
        backupData.data[conf] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    // 4. Trigger Download
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `focusflow_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
};

export const importUserData = async (jsonData: any): Promise<void> => {
    if (!auth.currentUser) throw new Error("No user logged in");
    const uid = auth.currentUser.uid;

    if (!jsonData.data || !jsonData.meta) {
        throw new Error("Invalid backup file format.");
    }

    // Batch writes (Max 500 ops per batch)
    let batch = writeBatch(db);
    let opCount = 0;

    const commitBatch = async () => {
        if (opCount > 0) {
            await batch.commit();
            batch = writeBatch(db);
            opCount = 0;
        }
    };

    // 1. Restore Standard Collections
    for (const colName of Object.keys(jsonData.data)) {
        if (colName === 'materialChats') continue; // Handle separately

        const items = jsonData.data[colName];
        if (Array.isArray(items)) {
            for (const item of items) {
                if (!item.id) continue;
                const docRef = doc(db, 'users', uid, colName, item.id);
                // Use cleanData to ensure no undefined values
                batch.set(docRef, cleanData(item));
                opCount++;

                if (opCount >= 450) await commitBatch();
            }
        }
    }

    // 2. Restore Material Chats
    if (jsonData.data['materialChats']) {
        for (const matId of Object.keys(jsonData.data['materialChats'])) {
            const chats = jsonData.data['materialChats'][matId];
            if (Array.isArray(chats)) {
                for (const chat of chats) {
                    if (!chat.id) continue;
                    const docRef = doc(db, 'users', uid, 'materials', matId, 'chats', chat.id);
                    batch.set(docRef, cleanData(chat));
                    opCount++;
                    if (opCount >= 450) await commitBatch();
                }
            }
        }
    }

    await commitBatch();
    
    // Clear local cache to ensure UI refresh picks up new data
    await clearLocalDatabase();
};

export const resetAppData = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error("No user logged in");
    const uid = auth.currentUser.uid;

    // Helper to delete collection in batches
    const deleteCollection = async (collectionPath: string, subCollection?: string) => {
        const colRef = collection(db, collectionPath);
        const snapshot = await getDocs(colRef);
        
        let batch = writeBatch(db);
        let count = 0;

        for (const d of snapshot.docs) {
            // If subcollection exists (like material chats), delete those first
            if (subCollection) {
                const subPath = `${collectionPath}/${d.id}/${subCollection}`;
                await deleteCollection(subPath); // Recursive delete for sub
            }

            batch.delete(d.ref);
            count++;
            if (count >= 400) {
                await batch.commit();
                batch = writeBatch(db);
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

    // 2. Delete Config/Memory (Optional - usually reset implies data, but keeping settings is nice. 
    // The user asked for "New App" feel, so let's wipe memory but maybe keep basic settings?)
    // Prompt requested "completely start my app as a completely new app". Wipe everything.
    await deleteCollection(`users/${uid}/aiMentorMemory`);
    await deleteCollection(`users/${uid}/config`);
    
    // We keep 'profile' usually so they don't lose their name/subscription status if applicable,
    // but we wipe the study data.

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
