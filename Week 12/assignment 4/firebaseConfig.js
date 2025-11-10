import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore, setLogLevel } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

// set debug logging for development
setLogLevel('Debug');

// define initialAuthToken to prevent reference error
const initialAuthToken = null; 

// firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAneXnTF0m8J_K-ueYT9ihupa0vijJGt2k",
    authDomain: "pixel-squeeze-28fec.firebaseapp.com",
    projectId: "pixel-squeeze-28fec",
    storageBucket: "pixel-squeeze-28fec.firebasestorage.app",
    messagingSenderId: "425578093531",
    appId: "1:425578093531:web:f46d943b709dc33ae6e5fe",
    measurementId: "G-QK24MDF3PD"
};

let db = null;
let auth = null;
let userId = null;
let isAuthReady = false;

// FIX: Define appId using the projectId for the database path, avoiding ReferenceError
const appId = firebaseConfig.projectId; 

// firebase service setup only runs if configuration is present
if (firebaseConfig) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    
    // listen for auth state changes to keep the userId updated
    onAuthStateChanged(auth, (user) => {
        userId = user ? user.uid : null;
        console.log(`Auth state changed. New User ID: ${userId ? userId.substring(0, 8) + '...' : 'None'}`);
    });

} else {
    console.warn("Firebase configuration not found. Running in offline/local-only mode.");
    // set userId to a temporary ID and mark auth as ready to allow local DB operations
    userId = crypto.randomUUID();
    isAuthReady = true;
}

/**
 * initializes firebase authentication by signing in the user.
 * this function called before any Firestore operations.
 */
async function initializeAuth() {
    if (!auth) {
        console.warn("Auth service is not available, skipping sign-in.");
        isAuthReady = true;
        return;
    }

    try {
        await setPersistence(auth, browserLocalPersistence);

        if (initialAuthToken) {
            // use the provided secure token for sign-in
            const userCredential = await signInWithCustomToken(auth, initialAuthToken);
            userId = userCredential.user.uid;
            console.log("Firebase: Signed in with custom token.");
        } else {
            // fallback to anonymous sign-in
            // NOTE: The 400 error suggests you need to ENABLE Anonymous Authentication 
            // in your Firebase Project Console (Authentication -> Sign-in method tab).
            const userCredential = await signInAnonymously(auth);
            userId = userCredential.user.uid;
            console.log("Firebase: Signed in anonymously.");
        }
    } catch (error) {
        // You are getting auth/configuration-not-found here. Check Firebase console!
        console.error("Firebase Auth initialization failed:", error);
    } finally {
        isAuthReady = true;
    }
}

// exports
export { initializeAuth, db, auth, userId, appId, isAuthReady };