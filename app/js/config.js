// ============================================================================
// config.js — the only file that changes per installation.
// Leave `firebase: null` to run in DEMO mode (sample data in the browser).
// ============================================================================
export const CONFIG = {
  appName: 'Gatebreaker Fitness',
  version: '1.3.1',
  // Paste the firebaseConfig object from the Firebase console here:
  firebase: {
    apiKey: 'AIzaSyBQ8V3enPwZqbpbixnPW_8KqaJwUu6_FBs', // public identifier, not a password; access is controlled by firestore.rules
    authDomain: 'pytt-pt-system.firebaseapp.com',
    projectId: 'pytt-pt-system',
    storageBucket: 'pytt-pt-system.firebasestorage.app',
    messagingSenderId: '90849533347',
    appId: '1:90849533347:web:f899ef0517087e75430e16',
  },
  // Push notifications while the app is closed: the "Web Push certificate" public key
  // from Firebase → Project settings → Cloud Messaging. Leave '' until the notifier is set up.
  vapidKey: '',
  // The one email that is the coach (must match firestore.rules):
  coachEmail: 'pytt286@gmail.com',
};
