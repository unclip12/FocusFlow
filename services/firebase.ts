
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import "firebase/compat/messaging";
import { StudyMaterial, MaterialChatMessage, DayPlan, MentorMessage, MentorMemory, UserProfile, KnowledgeBaseEntry, TimeLogEntry, AISettings, RevisionSettings, DailyTracker, AppSettings, FMGEEntry } from "../types";
import { notifySyncStart, notifySyncEnd } from "./syncService";

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCpASx-JIkZr88rJLhpfeqI_11oVnbOLNI",
  authDomain: "arsh-projects.firebaseapp.com",
  databaseURL: "https://arsh-projects-default-rtdb.firebaseio.com",
  projectId: "arsh-projects",
  storageBucket: "arsh-projects.firebasestorage.app",
  messagingSenderId: "666347925472",
  appId: "1:666347925472:web:a5e8177c0e886178c44585",
  measurementId: "G-R8M1GRBTSX"
};

// Initialize Firebase (Compat)
const app = firebase.initializeApp(firebaseConfig);
export const auth = app.auth();
export const db = app.firestore();
export const storage = app.storage();

// Initialize Messaging safely
let messaging: firebase.messaging.Messaging | null = null;
try {
  const isSupported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "indexedDB" in window;

  if (isSupported) {
      messaging = firebase.messaging();
  }
} catch (err) {
  console.warn("Firebase Messaging not initialized (unsupported environment).");
}

export { messaging };

// --- Helper to clean undefined values for Firestore ---
export const cleanData = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj.toISOString();
  
  if (Array.isArray(obj)) {
    return obj.map(cleanData);
  }
  
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    if (value !== undefined) {
      newObj[key] = cleanData(value);
    }
  });
  return newObj;
};

// Helper wrapper for sync notification
const withSync = async <T>(operation: () => Promise<T>): Promise<T> => {
    notifySyncStart();
    try {
        return await operation();
    } finally {
        notifySyncEnd();
    }
};

export const getUserProfile = async (): Promise<UserProfile | null> => {
    return withSync(async () => {
        if (!auth.currentUser) return null;
        const docRef = db.collection('users').doc(auth.currentUser.uid).collection('profile').doc('main');
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            return docSnap.data() as UserProfile;
        }
        return null;
    });
};

export const saveUserProfile = async (profile: UserProfile) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const docRef = db.collection('users').doc(auth.currentUser.uid).collection('profile').doc('main');
        await docRef.set(cleanData(profile), { merge: true });
    });
};


export const loginWithSecretId = async (secretId: string) => {
    const normalizedId = secretId.trim().toLowerCase();
    const email = `${normalizedId}@focusflow.app`;
    const password = `pass_${normalizedId}`;

    try {
        notifySyncStart();
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        notifySyncEnd();
        return userCredential.user;
    } catch (error: any) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
             try {
                 const newUser = await auth.createUserWithEmailAndPassword(email, password);
                 notifySyncEnd();
                 return newUser.user;
             } catch (createError) {
                 notifySyncEnd();
                 throw createError;
             }
        }
        notifySyncEnd();
        throw error;
    }
};

export const uploadFile = async (file: File): Promise<string> => {
    return withSync(async () => {
        if (!auth.currentUser) throw new Error("No user logged in");
        const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const storageRef = storage.ref(`users/${auth.currentUser.uid}/attachments/${Date.now()}_${safeName}`);
        const snapshot = await storageRef.put(file);
        return await snapshot.ref.getDownloadURL();
    });
};

export const uploadTempFile = async (file: File): Promise<{ url: string, fullPath: string }> => {
    return withSync(async () => {
        if (!auth.currentUser) throw new Error("No user logged in");
        const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const storageRef = storage.ref(`temp/${auth.currentUser.uid}/${Date.now()}_${safeName}`);
        const snapshot = await storageRef.put(file);
        const url = await snapshot.ref.getDownloadURL();
        return { url, fullPath: snapshot.ref.fullPath };
    });
};

export const deleteTempFile = async (fullPath: string) => {
    return withSync(async () => {
        const storageRef = storage.ref(fullPath);
        await storageRef.delete();
    });
};

export const saveStudyMaterial = async (material: StudyMaterial) => {
    return withSync(async () => {
        if (!auth.currentUser) throw new Error("No user logged in");
        const docRef = db.collection('users').doc(auth.currentUser.uid).collection('materials').doc(material.id);
        await docRef.set(cleanData(material));
    });
};

export const getStudyMaterials = async (): Promise<StudyMaterial[]> => {
    return withSync(async () => {
        if (!auth.currentUser) return [];
        const colRef = db.collection('users').doc(auth.currentUser.uid).collection('materials');
        const snap = await colRef.get();
        return snap.docs.map(d => d.data() as StudyMaterial).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });
};

export const deleteStudyMaterial = async (materialId: string) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        await db.collection('users').doc(auth.currentUser.uid).collection('materials').doc(materialId).delete();
    });
};

export const toggleMaterialActive = async (materialId: string, isActive: boolean) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const materialsRef = db.collection('users').doc(auth.currentUser.uid).collection('materials');
        
        if (isActive) {
            const batch = db.batch();
            // Since we can't easily batch update based on query in client SDK without fetching, we fetch active ones.
            // Optimally we fetch all, but for safety let's fetch active.
            const activeSnap = await materialsRef.where('isActive', '==', true).get();
            activeSnap.forEach(doc => {
                if (doc.id !== materialId) {
                    batch.update(doc.ref, { isActive: false });
                }
            });
            await batch.commit();
        }
        await materialsRef.doc(materialId).update({ isActive });
    });
};

export const updateMaterialTitle = async (materialId: string, newTitle: string) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        await db.collection('users').doc(auth.currentUser.uid).collection('materials').doc(materialId).update({ title: newTitle });
    });
};

export const saveMaterialChat = async (materialId: string, chat: MaterialChatMessage) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const colRef = db.collection('users').doc(auth.currentUser.uid).collection('materials').doc(materialId).collection('chats');
        await colRef.add(cleanData(chat));
    });
};

export const getMaterialChats = async (materialId: string): Promise<MaterialChatMessage[]> => {
    return withSync(async () => {
        if (!auth.currentUser) return [];
        const colRef = db.collection('users').doc(auth.currentUser.uid).collection('materials').doc(materialId).collection('chats');
        const snap = await colRef.orderBy('timestamp', 'asc').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as MaterialChatMessage));
    });
};

export const saveMentorMessage = async (message: MentorMessage) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const docRef = db.collection('users').doc(auth.currentUser.uid).collection('mentorMessages').doc(message.id);
        await docRef.set(cleanData(message));
    });
};

export const getMentorMessages = async (): Promise<MentorMessage[]> => {
    return withSync(async () => {
        if (!auth.currentUser) return [];
        const colRef = db.collection('users').doc(auth.currentUser.uid).collection('mentorMessages');
        const snap = await colRef.orderBy('timestamp', 'asc').get();
        return snap.docs.map(d => d.data() as MentorMessage);
    });
};

export const clearMentorMessages = async () => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const colRef = db.collection('users').doc(auth.currentUser.uid).collection('mentorMessages');
        const snap = await colRef.get();
        const batch = db.batch();
        snap.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
    });
};

export const saveChatMaterial = async (text: string, filename: string) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const id = Date.now().toString();
        const docRef = db.collection('users').doc(auth.currentUser.uid).collection('materialsFromChat').doc(id);
        await docRef.set({
            text,
            originalFileName: filename,
            sourceType: 'CHAT_ATTACHMENT',
            createdAt: new Date().toISOString()
        });
        return id;
    });
};

export const getMentorMemoryData = async (): Promise<MentorMemory | null> => {
    return withSync(async () => {
        if (!auth.currentUser) return null;
        const docRef = db.collection('users').doc(auth.currentUser.uid).collection('aiMentorMemory').doc('profile');
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            return docSnap.data() as MentorMemory;
        }
        return null;
    });
};

export const saveMentorMemoryData = async (memory: MentorMemory) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const docRef = db.collection('users').doc(auth.currentUser.uid).collection('aiMentorMemory').doc('profile');
        await docRef.set(cleanData({ ...memory, lastUpdated: new Date().toISOString() }), { merge: true });
    });
};

export const addToBacklog = async (item: any) => {
    const memory = await getMentorMemoryData();
    const currentBacklog = memory?.backlog || [];
    if (currentBacklog.find((b: any) => b.id === item.id)) return;
    const updatedBacklog = [...currentBacklog, item];
    await saveMentorMemoryData({ backlog: updatedBacklog });
}

// --- NEW AI & REVISION SETTINGS ---

export const getAISettings = async (): Promise<AISettings | null> => {
    return withSync(async () => {
        if (!auth.currentUser) return null;
        const docRef = db.collection('users').doc(auth.currentUser.uid).collection('config').doc('aiSettings');
        const docSnap = await docRef.get();
        return docSnap.exists ? docSnap.data() as AISettings : null;
    });
};

export const saveAISettings = async (settings: AISettings) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const docRef = db.collection('users').doc(auth.currentUser.uid).collection('config').doc('aiSettings');
        await docRef.set(cleanData(settings), { merge: true });
    });
};

export const getRevisionSettings = async (): Promise<RevisionSettings | null> => {
    return withSync(async () => {
        if (!auth.currentUser) return null;
        const docRef = db.collection('users').doc(auth.currentUser.uid).collection('config').doc('revisionSettings');
        const docSnap = await docRef.get();
        return docSnap.exists ? docSnap.data() as RevisionSettings : null;
    });
};

export const saveRevisionSettings = async (settings: RevisionSettings) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const docRef = db.collection('users').doc(auth.currentUser.uid).collection('config').doc('revisionSettings');
        await docRef.set(cleanData(settings), { merge: true });
    });
};

// --- MAIN APP SETTINGS ---

export const getAppSettings = async (): Promise<AppSettings | null> => {
    return withSync(async () => {
        if (!auth.currentUser) return null;
        const docRef = db.collection('users').doc(auth.currentUser.uid).collection('config').doc('appSettings');
        const docSnap = await docRef.get();
        return docSnap.exists ? docSnap.data() as AppSettings : null;
    });
};

export const saveAppSettings = async (settings: AppSettings) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const docRef = db.collection('users').doc(auth.currentUser.uid).collection('config').doc('appSettings');
        await docRef.set(cleanData(settings), { merge: true });
    });
};

// --- DAY PLANS ---

export const saveDayPlan = async (plan: DayPlan) => {
    return withSync(async () => {
        if (!auth.currentUser) throw new Error("No user logged in");
        
        if (!plan.date || plan.date.length !== 10) {
            console.error("SESSION UPDATE ERROR: Invalid date format", { plan });
            throw new Error("Invalid date format. Must be YYYY-MM-DD.");
        }

        const docRef = db.collection('users').doc(auth.currentUser.uid).collection('dayPlans').doc(plan.date);
        
        try {
            const cleanedPlan = cleanData(plan);
            await docRef.set(cleanedPlan);
        } catch (error: any) {
            console.error("SESSION UPDATE ERROR: Firestore write failed", {
                function: 'saveDayPlan',
                data: plan,
                error: error
            });
            throw error;
        }
    });
};

export const getDayPlan = async (date: string): Promise<DayPlan | null> => {
    return withSync(async () => {
        if (!auth.currentUser) return null;
        const docRef = db.collection('users').doc(auth.currentUser.uid).collection('dayPlans').doc(date);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            return docSnap.data() as DayPlan;
        }
        return null;
    });
};

export const deleteDayPlan = async (date: string) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const docRef = db.collection('users').doc(auth.currentUser.uid).collection('dayPlans').doc(date);
        await docRef.delete();
    });
};

// --- DAILY TRACKER ---
export const getDailyTracker = async (date: string): Promise<DailyTracker | null> => {
    return withSync(async () => {
        if (!auth.currentUser) return null;
        const docRef = db.collection('users').doc(auth.currentUser.uid).collection('dailyTrackers').doc(date);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            return docSnap.data() as DailyTracker;
        }
        return null;
    });
};

export const saveDailyTracker = async (tracker: DailyTracker) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const docRef = db.collection('users').doc(auth.currentUser.uid).collection('dailyTrackers').doc(tracker.date);
        await docRef.set(cleanData(tracker), { merge: true });
    });
};


// --- KNOWLEDGE BASE (FA PAGES) ---
export const getKnowledgeBase = async (): Promise<KnowledgeBaseEntry[]> => {
    return withSync(async () => {
        if (!auth.currentUser) return [];
        const colRef = db.collection('users').doc(auth.currentUser.uid).collection('knowledgeBase');
        const snap = await colRef.get();
        return snap.docs.map(d => d.data() as KnowledgeBaseEntry);
    });
};

export const saveKnowledgeBase = async (kb: KnowledgeBaseEntry[]) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        
        const chunkArray = <T>(array: T[], size: number): T[][] => {
            const chunked: T[][] = [];
            for (let i = 0; i < array.length; i += size) {
                chunked.push(array.slice(i, i + size));
            }
            return chunked;
        };

        const chunks = chunkArray(kb, 450);

        for (const chunk of chunks) {
            const batch = db.batch();
            chunk.forEach(entry => {
                const docRef = db.collection('users').doc(auth.currentUser!.uid).collection('knowledgeBase').doc(entry.pageNumber);
                batch.set(docRef, cleanData(entry));
            });
            await batch.commit();
        }
    });
};

export const deleteKnowledgeBaseEntry = async (pageNumber: string) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const docRef = db.collection('users').doc(auth.currentUser.uid).collection('knowledgeBase').doc(pageNumber);
        await docRef.delete();
    });
};

// --- TIME LOGGER ---

export const saveTimeLog = async (entry: TimeLogEntry) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const docRef = db.collection('users').doc(auth.currentUser.uid).collection('timeLogs').doc(entry.id);
        await docRef.set(cleanData(entry));
    });
};

export const getTimeLogs = async (date: string): Promise<TimeLogEntry[]> => {
    return withSync(async () => {
        if (!auth.currentUser) return [];
        const colRef = db.collection('users').doc(auth.currentUser.uid).collection('timeLogs');
        const snap = await colRef.where('date', '==', date).get();
        return snap.docs.map(d => d.data() as TimeLogEntry).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    });
};

export const deleteTimeLog = async (id: string) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const docRef = db.collection('users').doc(auth.currentUser.uid).collection('timeLogs').doc(id);
        await docRef.delete();
    });
};

// --- FMGE DATA ---

export const getFMGEData = async (): Promise<FMGEEntry[]> => {
    return withSync(async () => {
        if (!auth.currentUser) return [];
        const colRef = db.collection('users').doc(auth.currentUser.uid).collection('fmgeData');
        const snap = await colRef.get();
        return snap.docs.map(d => d.data() as FMGEEntry);
    });
};

export const saveFMGEEntry = async (entry: FMGEEntry) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const docRef = db.collection('users').doc(auth.currentUser.uid).collection('fmgeData').doc(entry.id);
        await docRef.set(cleanData(entry));
    });
};

export const deleteFMGEEntry = async (id: string) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const docRef = db.collection('users').doc(auth.currentUser.uid).collection('fmgeData').doc(id);
        await docRef.delete();
    });
};
