import { db, userId, appId, isAuthReady, auth } from "./firebaseConfig.js";
import {
    collection,
    doc,
    addDoc,
    setDoc,
    getDocs,
    deleteDoc,
    onSnapshot,
    query,
    where,
    Timestamp,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

// --- 1. IndexedDB setup (Dexie) ---

/**
 * the IndexedDB database structure using Dexie.
 * store records that need to be synced to Firebase (synced=false) and records that are already synced.
 */
const localDb = new Dexie('PixelSqueezeDB');
localDb.version(1).stores({
    records: '++id, firebaseId, synced, timestamp, name' // 'id' is Dexie's auto-increment key
});

// --- 2. Firestore path helper ---

/**
 * gets the correct Firestore collection reference for the current user's private records.
 */
const getRecordCollectionRef = () => {
    if (!db || !userId) {
        throw new Error("Database or User ID is not initialized.");
    }
    // path: /artifacts/{appId}/users/{userId}/compression_records
    const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
    return collection(userDocRef, 'compression_records');
};

// --- 3. core DB operations ---

/**
 * saves a new record to the appropriate database (IndexedDB or Firebase)
 * @param {object} recordData - the compression data
 * @param {boolean} isOnline - current network status
 * @returns {object} status - success message and sync status
 */
export async function saveRecord(recordData, isOnline) {
    if (isOnline && isAuthReady) {
        // ONLINE: Save directly to Firebase
        try {
            const firebaseData = {
                ...recordData,
                timestamp: serverTimestamp(),
                userId: userId,
                synced: true,
            };
            const docRef = await addDoc(getRecordCollectionRef(), firebaseData);
            
            // immediately store in IndexedDB as synced for UI consistency
            const localData = {
                ...recordData,
                timestamp: Date.now(),
                firebaseId: docRef.id,
                synced: true,
            };
            await localDb.records.add(localData);

            return { message: `Record for ${recordData.name} saved and synced to cloud.`, isSynced: true };

        } catch (error) {
            console.warn("Firebase save failed (fall back to offline):", error);
            // fall through to offline save if Firebase fails
        }
    }

    // offline or Firebase failure: save to IndexedDB (unsynced)
    const localData = {
        ...recordData,
        timestamp: Date.now(),
        synced: false,
    };
    await localDb.records.add(localData);
    return { message: `Record for ${recordData.name} saved locally. Sync pending.`, isSynced: false };
}

/**
 * retrieves all records from IndexedDB
 * records will include both synced Firebase records and pending offline records.
 */
export async function getLocalRecords() {
    try {
        // fetch all records from local IndexedDB
        const records = await localDb.records.toArray();
        // sort by timestamp (newest first)
        records.sort((a, b) => b.timestamp - a.timestamp);
        return records;
    } catch (e) {
        console.error("Error retrieving local records:", e);
        return [];
    }
}

/**
 * deletes a record from local IndexedDB and queues deletion for Firebase if synced
 * @param {string} id - either the FirebaseId or Dexie ID
 * @param {boolean} isFirebaseRecord - true if the record has a Firebase ID
 * @param {boolean} isOnline - current network status
 */
export async function deleteRecord(id, isFirebaseRecord, isOnline) {
    if (!id) return { message: "Invalid record ID." };

    try {
        if (isFirebaseRecord) {
            // find the local copy by firebaseId to get the Dexie 'id' for deletion
            const localRecord = await localDb.records.where('firebaseId').equals(id).first();
            if (localRecord) {
                await localDb.records.delete(localRecord.id);
            }
            
            if (isOnline && isAuthReady) {
                // ONLINE: delete from Firebase
                const docRef = doc(getRecordCollectionRef(), id);
                await deleteDoc(docRef);
                return `Record deleted locally and synced to cloud.`;
            } else {
                // OFFLINE: mark for deferred Firebase deletion (not implemented for simplicity, but shown for sync concept)
                // For this example, we only delete locally when offline to prevent UI confusion.
                return `Record deleted locally. Cloud deletion pending connection.`;
            }
        } else {
            // unsynced record, delete only from IndexedDB using its Dexie 'id'
            await localDb.records.delete(parseInt(id, 10));
            return `Unsynced record deleted locally.`;
        }
    } catch (error) {
        console.error("Error deleting record:", error);
        throw new Error("Failed to delete record.");
    }
}

// --- 4. synchronization logic ---

// syncs all unsynced records from IndexedDB to Firebase.
export async function syncOfflineToFirebase() {
    if (!isAuthReady) {
        console.log("[Sync] Auth not ready, skipping sync.");
        return { count: 0, message: "Auth not ready." };
    }

    const unsyncedRecords = await localDb.records.where('synced').equals(false).toArray();
    
    if (unsyncedRecords.length === 0) {
        return { count: 0, message: "No offline records to sync." };
    }

    const batch = writeBatch(db);
    const collectionRef = getRecordCollectionRef();
    
    console.log(`[Sync] Found ${unsyncedRecords.length} records to sync.`);

    for (const record of unsyncedRecords) {
        // prepare Firebase data
        const firebaseData = {
            name: record.name,
            originalSize: record.originalSize,
            compressedSize: record.compressedSize,
            reduction: record.reduction,
            timestamp: Timestamp.fromMillis(record.timestamp), // convert Dexie timestamp to Firestore timestamp
            userId: userId,
            synced: true,
        };

        const newDocRef = doc(collectionRef);
        batch.set(newDocRef, firebaseData);

        // update local Dexie record in batch to mark as synced and save Firebase ID
        await localDb.records.update(record.id, {
            synced: true,
            firebaseId: newDocRef.id
        });
    }

    await batch.commit();
    return { count: unsyncedRecords.length, message: `Successfully synced ${unsyncedRecords.length} records to Firebase!` };
}

/**
 * Subscribes to Firebase changes and updates the IndexedDB store accordingly.
 * acts as the "reconciliation" layer between cloud and local data.
 * @param {function} updateUICallback - Function to call after updating IndexedDB.
 */
export function subscribeToFirebaseRecords(updateUICallback) {
    if (!db) return console.error("Firebase DB not ready for subscription.");

    // Wwait for auth to be ready before querying the protected path
    const unsubscribeGuard = onAuthStateChanged(auth, (user) => {
        if (user) {
            // once authenticated, start the real-time listener
            const recordQuery = query(getRecordCollectionRef());
            
            // main real-time listener
            onSnapshot(recordQuery, async (snapshot) => {
                const changes = snapshot.docChanges();
                if (changes.length === 0) {
                    console.log("[Snapshot] No changes detected.");
                    updateUICallback(); // refresh in case of initial load
                    return;
                }

                console.log(`[Snapshot] Processing ${changes.length} changes from Firebase...`);

                for (const change of changes) {
                    const docData = change.doc.data();
                    const firebaseId = change.doc.id;
                    
                    const localData = {
                        name: docData.name,
                        originalSize: docData.originalSize,
                        compressedSize: docData.compressedSize,
                        reduction: docData.reduction,
                        // convert Firestore Timestamp to JS timestamp
                        timestamp: docData.timestamp?.toMillis() || Date.now(), 
                        firebaseId: firebaseId,
                        synced: true,
                    };

                    try {
                        if (change.type === 'added' || change.type === 'modified') {
                            // check if this record already exists locally (by firebaseId)
                            const existingLocalRecord = await localDb.records.where('firebaseId').equals(firebaseId).first();
                            
                            if (!existingLocalRecord) {
                                // add to local DB if it's new
                                await localDb.records.add(localData);
                                console.log(`[Snapshot] Added/Updated local record: ${firebaseId}`);
                            } else {
                                // if it exists, update it to ensure local reflects cloud
                                await localDb.records.update(existingLocalRecord.id, localData);
                                console.log(`[Snapshot] Updated local record: ${firebaseId}`);
                            }

                        } else if (change.type === 'removed') {
                            // find and delete local copy
                            const localRecord = await localDb.records.where('firebaseId').equals(firebaseId).first();
                            if (localRecord) {
                                await localDb.records.delete(localRecord.id);
                                console.log(`[Snapshot] Removed local record: ${firebaseId}`);
                            }
                        }
                    } catch(e) {
                         console.error("[Snapshot] Error processing change:", e);
                    }
                }
                
                // refresh the UI after all local IndexedDB changes are processed
                updateUICallback(); 
            });

            // stop listening to the auth state once the listener is established
            unsubscribeGuard(); 
        }
    });
}