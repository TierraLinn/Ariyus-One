
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Default fallback sandbox credentials
const defaultFirebaseConfig = {
  apiKey: "AIzaSyDJHxitN732ejMhNX43J7SQfLg4voYr-gg",
  authDomain: "ariyus-one.firebaseapp.com",
  projectId: "ariyus-one",
  storageBucket: "ariyus-one.firebasestorage.app",
  messagingSenderId: "246150701825",
  appId: "1:246150701825:web:72f2a21b8eabe2976bc6fe"
};

// Check if a custom config has been entered by the developer in the settings panel
const customConfigStr = localStorage.getItem('ariyus_firebase_config');
let firebaseConfig = defaultFirebaseConfig;

if (customConfigStr) {
  try {
    firebaseConfig = JSON.parse(customConfigStr);
    console.log("Ariyus-One: Loaded custom production Firebase credentials.");
  } catch (e) {
    console.warn("Ariyus-One: Failed to parse custom Firebase config, falling back to sandbox.");
  }
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Export the services
export { auth, db, storage };
