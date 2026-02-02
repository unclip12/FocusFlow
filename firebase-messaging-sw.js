
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// REPLACE "YOUR_NEW_API_KEY_HERE" with your actual restricted API Key if using Push Notifications
// Since this is a service worker file, it cannot read process.env directly.
// You must either paste the key here or use a build step to inject it.
firebase.initializeApp({
  apiKey: "YOUR_NEW_API_KEY_HERE",
  authDomain: "arsh-projects.firebaseapp.com",
  projectId: "arsh-projects",
  storageBucket: "arsh-projects.firebasestorage.app",
  messagingSenderId: "666347925472",
  appId: "1:666347925472:web:2bb83fee081ccd2bc44585",
  measurementId: "G-5MZ7M91X5Q"
});

// Safely attempt to initialize messaging in SW
try {
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      console.log('[firebase-messaging-sw.js] Received background message ', payload);
      const notificationTitle = payload.notification.title;
      const notificationOptions = {
        body: payload.notification.body,
        icon: '/icon.png'
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
} catch (e) {
    // Messaging not supported in this SW environment
    console.debug('Firebase Messaging SW not supported');
}
