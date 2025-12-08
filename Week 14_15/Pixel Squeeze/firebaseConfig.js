import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged, 
    setPersistence, 
    browserLocalPersistence 
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore, setLogLevel } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

// set debug logging for development
setLogLevel('Debug');

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
let userProfile = null; // Store name/photo

// FIX: Define appId using the projectId for the database path
const appId = firebaseConfig.projectId; 

// firebase service setup
if (firebaseConfig) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    
    // listen for auth state changes to keep the userId updated
    onAuthStateChanged(auth, (user) => {
        if (user) {
            userId = user.uid;
            userProfile = {
                displayName: user.displayName,
                photoURL: user.photoURL,
                email: user.email
            };
            console.log(`Auth State: Logged in as ${user.displayName} (${userId})`);
        } else {
            userId = null;
            userProfile = null;
            console.log("Auth State: Signed out.");
        }
        isAuthReady = true;
    });

} else {
    console.warn("Firebase configuration not found. Running in offline/local-only mode.");
    userId = 'offline-user-' + crypto.randomUUID();
    isAuthReady = true;
}

/**
 * initializes firebase authentication
 */
async function initializeAuth() {
    if (!auth) return;
    try {
        // ensure the browser remembers the user across page refreshes
        await setPersistence(auth, browserLocalPersistence);
    } catch (error) {
        console.error("Firebase Auth persistence failed:", error);
    }
}

/**
 * logs the user in using Google popup
 */
async function loginUser() {
    if (!auth) throw new Error("Auth not initialized");
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        return result.user;
    } catch (error) {
        console.error("Login failed:", error);
        throw error;
    }
}

/**
 * logs current user out
 */
async function logoutUser() {
    if (!auth) return;
    try {
        await signOut(auth);
        console.log("User signed out");
    } catch (error) {
        console.error("Logout failed:", error);
    }
}

// exports
export { initializeAuth, loginUser, logoutUser, db, auth, userId, userProfile, appId, isAuthReady };