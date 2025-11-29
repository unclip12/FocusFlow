
import { auth, db, messaging } from "./firebase";
import { AppSettings } from "../types";

export const requestNotificationPermission = async (): Promise<boolean> => {
    if (!("Notification" in window)) {
        console.warn("This browser does not support desktop notification");
        return false;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            // Get FCM Token only if messaging is initialized
            if (auth.currentUser && messaging) {
                try {
                    // Using messaging.getToken() from compat library
                    // VAPID key usually passed as object: { vapidKey: ... }
                    const token = await messaging.getToken({ 
                        vapidKey: "BMX8y-1... (Replace with actual VAPID from Firebase Console if available, or rely on default)" 
                    });
                    
                    if (token) {
                        // Store token in Firestore (compat syntax)
                        await db.collection('users').doc(auth.currentUser.uid).collection('notificationTokens').doc(token).set({
                            token: token,
                            platform: 'web-pwa',
                            createdAt: new Date().toISOString(),
                            lastUsedAt: new Date().toISOString()
                        });
                    }
                } catch (e) {
                    console.error("FCM Token retrieval failed", e);
                    // Continue anyway, we can still use local Notifications api for active tab
                }
            }
            return true;
        }
        return false;
    } catch (error) {
        console.error("Error requesting notification permission", error);
        return false;
    }
};

export const getNotificationTone = (settings: AppSettings): 'STRICT' | 'GENTLE' | 'NORMAL' => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    if (settings.quietHours.enabled) {
        const [startH, startM] = settings.quietHours.start.split(':').map(Number);
        const [endH, endM] = settings.quietHours.end.split(':').map(Number);
        
        const startTotal = startH * 60 + startM;
        const endTotal = endH * 60 + endM;

        let isQuiet = false;
        if (startTotal > endTotal) {
            // Crosses midnight (e.g. 23:00 to 07:00)
            isQuiet = currentMinutes >= startTotal || currentMinutes < endTotal;
        } else {
            isQuiet = currentMinutes >= startTotal && currentMinutes < endTotal;
        }

        if (isQuiet) return 'GENTLE';
    }

    if (settings.notifications.mode === 'strict') return 'STRICT';
    return 'NORMAL';
};

export const sendLocalNotification = (title: string, body: string) => {
    if (Notification.permission === 'granted') {
        try {
            // If running as PWA/Service Worker isn't ready for showNotification, fallback to new Notification
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                 navigator.serviceWorker.ready.then(registration => {
                     registration.showNotification(title, {
                         body,
                         icon: '/icon.png',
                         badge: '/icon.png'
                     });
                 });
            } else {
                new Notification(title, {
                    body,
                    icon: '/icon.png'
                });
            }
        } catch (e) {
            console.error("Notification send failed", e);
        }
    }
};

export const triggerBlockFinishedNotification = (settings: AppSettings, blockTitle: string) => {
    if (!settings.notifications.enabled || !settings.notifications.types.blockTimers) return;

    const tone = getNotificationTone(settings);
    let title = "FocusFlow - Timer Done";
    let body = `Time is up for ${blockTitle}.`;

    if (tone === 'STRICT') {
        title = "BLOCK FINISHED";
        body = `Time's up for ${blockTitle}. Stop now. Move to the next task immediately. No delays.`;
    } else if (tone === 'GENTLE') {
        title = "Session Complete";
        body = `You've finished ${blockTitle}. Great effort. If you're tired, it's okay to rest now.`;
    }

    sendLocalNotification(title, body);
};

export const triggerBreakFinishedNotification = (settings: AppSettings) => {
    if (!settings.notifications.enabled || !settings.notifications.types.breaks) return;

    const tone = getNotificationTone(settings);
    let title = "Break Over";
    let body = "Time to get back to work.";

    if (tone === 'STRICT') {
        title = "BREAK IS OVER";
        body = "Back to study NOW. Every minute counts for the exam. No excuses.";
    } else if (tone === 'GENTLE') {
        title = "Break Finished";
        body = "Hope you're refreshed. Let's gently get back to it if you can.";
    }

    sendLocalNotification(title, body);
};
