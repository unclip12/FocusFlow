

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, updateDoc, addDoc, query, orderBy, writeBatch, where } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getMessaging } from "firebase/messaging";
import { StudyMaterial, MaterialChatMessage, DayPlan, MentorMessage, MentorMemory, UserProfile, KnowledgeBaseEntry, TimeLogEntry, AISettings, RevisionSettings, DailyTracker } from "../types";
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize Messaging safely
let messaging: any = null;
try {
  const isSupported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "indexedDB" in window;

  if (isSupported) {
      messaging = getMessaging(app);
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
        const docRef = doc(db, 'users', auth.currentUser.uid, 'profile', 'main');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as UserProfile;
        }
        return null;
    });
};

export const saveUserProfile = async (profile: UserProfile) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const docRef = doc(db, 'users', auth.currentUser.uid, 'profile', 'main');
        await setDoc(docRef, cleanData(profile), { merge: true });
    });
};


export const loginWithSecretId = async (secretId: string) => {
    const normalizedId = secretId.trim().toLowerCase();
    const email = `${normalizedId}@focusflow.app`;
    const password = `pass_${normalizedId}`;

    try {
        // Auth operations technically sync too, but often handled by auth state listeners
        notifySyncStart();
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        notifySyncEnd();
        return userCredential.user;
    } catch (error: any) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
             try {
                 const newUser = await createUserWithEmailAndPassword(auth, email, password);
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
        const storageRef = ref(storage, `users/${auth.currentUser.uid}/attachments/${Date.now()}_${safeName}`);
        const snapshot = await uploadBytes(storageRef, file);
        return getDownloadURL(snapshot.ref);
    });
};

export const uploadTempFile = async (file: File): Promise<{ url: string, fullPath: string }> => {
    return withSync(async () => {
        if (!auth.currentUser) throw new Error("No user logged in");
        const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const storageRef = ref(storage, `temp/${auth.currentUser.uid}/${Date.now()}_${safeName}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        return { url, fullPath: snapshot.ref.fullPath };
    });
};

export const deleteTempFile = async (fullPath: string) => {
    return withSync(async () => {
        const storageRef = ref(storage, fullPath);
        await deleteObject(storageRef);
    });
};

export const saveStudyMaterial = async (material: StudyMaterial) => {
    return withSync(async () => {
        if (!auth.currentUser) throw new Error("No user logged in");
        const docRef = doc(db, 'users', auth.currentUser.uid, 'materials', material.id);
        await setDoc(docRef, cleanData(material));
    });
};

export const getStudyMaterials = async (): Promise<StudyMaterial[]> => {
    return withSync(async () => {
        if (!auth.currentUser) return [];
        const colRef = collection(db, 'users', auth.currentUser.uid, 'materials');
        const snap = await getDocs(colRef);
        return snap.docs.map(d => d.data() as StudyMaterial).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });
};

export const deleteStudyMaterial = async (materialId: string) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'materials', materialId));
    });
};

export const toggleMaterialActive = async (materialId: string, isActive: boolean) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        if (isActive) {
            const materials = await getStudyMaterials(); // This will trigger a nested sync notification, which is fine due to counter
            const updatePromises = materials.map(m => {
                if (m.id !== materialId && m.isActive) {
                    return updateDoc(doc(db, 'users', auth.currentUser!.uid, 'materials', m.id), { isActive: false });
                }
                return Promise.resolve();
            });
            await Promise.all(updatePromises);
        }
        const docRef = doc(db, 'users', auth.currentUser.uid, 'materials', materialId);
        await updateDoc(docRef, { isActive });
    });
};

export const updateMaterialTitle = async (materialId: string, newTitle: string) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const docRef = doc(db, 'users', auth.currentUser.uid, 'materials', materialId);
        await updateDoc(docRef, { title: newTitle });
    });
};

export const saveMaterialChat = async (materialId: string, chat: MaterialChatMessage) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const colRef = collection(db, 'users', auth.currentUser.uid, 'materials', materialId, 'chats');
        await addDoc(colRef, cleanData(chat));
    });
};

export const getMaterialChats = async (materialId: string): Promise<MaterialChatMessage[]> => {
    return withSync(async () => {
        if (!auth.currentUser) return [];
        const colRef = collection(db, 'users', auth.currentUser.uid, 'materials', materialId, 'chats');
        const q = query(colRef, orderBy('timestamp', 'asc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as MaterialChatMessage));
    });
};

export const saveMentorMessage = async (message: MentorMessage) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const docRef = doc(db, 'users', auth.currentUser.uid, 'mentorMessages', message.id);
        await setDoc(docRef, cleanData(message));
    });
};

export const getMentorMessages = async (): Promise<MentorMessage[]> => {
    return withSync(async () => {
        if (!auth.currentUser) return [];
        const colRef = collection(db, 'users', auth.currentUser.uid, 'mentorMessages');
        const q = query(colRef, orderBy('timestamp', 'asc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as MentorMessage);
    });
};

export const clearMentorMessages = async () => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const colRef = collection(db, 'users', auth.currentUser.uid, 'mentorMessages');
        const snap = await getDocs(colRef);
        const batch = writeBatch(db);
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
        const docRef = doc(db, 'users', auth.currentUser.uid, 'materialsFromChat', id);
        await setDoc(docRef, {
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
        const docRef = doc(db, 'users', auth.currentUser.uid, 'aiMentorMemory', 'profile');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as MentorMemory;
        }
        return null;
    });
};

export const saveMentorMemoryData = async (memory: MentorMemory) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const docRef = doc(db, 'users', auth.currentUser.uid, 'aiMentorMemory', 'profile');
        await setDoc(docRef, cleanData({ ...memory, lastUpdated: new Date().toISOString() }), { merge: true });
    });
};

export const addToBacklog = async (item: any) => {
    // This composes existing functions, implicit sync from get/save
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
        const docRef = doc(db, 'users', auth.currentUser.uid, 'config', 'aiSettings');
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data() as AISettings : null;
    });
};

export const saveAISettings = async (settings: AISettings) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const docRef = doc(db, 'users', auth.currentUser.uid, 'config', 'aiSettings');
        await setDoc(docRef, cleanData(settings), { merge: true });
    });
};

export const getRevisionSettings = async (): Promise<RevisionSettings | null> => {
    return withSync(async () => {
        if (!auth.currentUser) return null;
        const docRef = doc(db, 'users', auth.currentUser.uid, 'config', 'revisionSettings');
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data() as RevisionSettings : null;
    });
};

export const saveRevisionSettings = async (settings: RevisionSettings) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const docRef = doc(db, 'users', auth.currentUser.uid, 'config', 'revisionSettings');
        await setDoc(docRef, cleanData(settings), { merge: true });
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

        const path = `users/${auth.currentUser.uid}/dayPlans/${plan.date}`;
        const docRef = doc(db, 'users', auth.currentUser.uid, 'dayPlans', plan.date);
        
        try {
            const cleanedPlan = cleanData(plan);
            await setDoc(docRef, cleanedPlan);
        } catch (error: any) {
            console.error("SESSION UPDATE ERROR: Firestore write failed", {
                function: 'saveDayPlan',
                path: path,
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
        const docRef = doc(db, 'users', auth.currentUser.uid, 'dayPlans', date);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as DayPlan;
        }
        return null;
    });
};

export const deleteDayPlan = async (date: string) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const docRef = doc(db, 'users', auth.currentUser.uid, 'dayPlans', date);
        await deleteDoc(docRef);
    });
};

// --- DAILY TRACKER ---
export const getDailyTracker = async (date: string): Promise<DailyTracker | null> => {
    return withSync(async () => {
        if (!auth.currentUser) return null;
        const docRef = doc(db, 'users', auth.currentUser.uid, 'dailyTrackers', date);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as DailyTracker;
        }
        return null;
    });
};

export const saveDailyTracker = async (tracker: DailyTracker) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const docRef = doc(db, 'users', auth.currentUser.uid, 'dailyTrackers', tracker.date);
        await setDoc(docRef, cleanData(tracker), { merge: true });
    });
};


// --- KNOWLEDGE BASE (FA PAGES) ---
export const getKnowledgeBase = async (): Promise<KnowledgeBaseEntry[]> => {
    return withSync(async () => {
        if (!auth.currentUser) return [];
        const colRef = collection(db, 'users', auth.currentUser.uid, 'knowledgeBase');
        const snap = await getDocs(colRef);
        return snap.docs.map(d => d.data() as KnowledgeBaseEntry);
    });
};

export const saveKnowledgeBase = async (kb: KnowledgeBaseEntry[]) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const batch = writeBatch(db);
        kb.forEach(entry => {
            const docRef = doc(db, 'users', auth.currentUser.uid, 'knowledgeBase', entry.pageNumber);
            batch.set(docRef, cleanData(entry));
        });
        await batch.commit();
    });
};

export const deleteKnowledgeBaseEntry = async (pageNumber: string) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const docRef = doc(db, 'users', auth.currentUser.uid, 'knowledgeBase', pageNumber);
        await deleteDoc(docRef);
    });
};

// --- TIME LOGGER ---

export const saveTimeLog = async (entry: TimeLogEntry) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const docRef = doc(db, 'users', auth.currentUser.uid, 'timeLogs', entry.id);
        await setDoc(docRef, cleanData(entry));
    });
};

export const getTimeLogs = async (date: string): Promise<TimeLogEntry[]> => {
    return withSync(async () => {
        if (!auth.currentUser) return [];
        const colRef = collection(db, 'users', auth.currentUser.uid, 'timeLogs');
        const q = query(colRef, where('date', '==', date));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as TimeLogEntry).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    });
};

export const deleteTimeLog = async (id: string) => {
    return withSync(async () => {
        if (!auth.currentUser) return;
        const docRef = doc(db, 'users', auth.currentUser.uid, 'timeLogs', id);
        await deleteDoc(docRef);
    });
};