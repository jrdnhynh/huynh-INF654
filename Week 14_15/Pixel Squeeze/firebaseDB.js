import { db, userId, appId, isAuthReady, auth } from "./firebaseConfig.js";
import {
    collection,
    doc,
    addDoc,
    deleteDoc,
    onSnapshot,
    query,
    serverTimestamp,
    writeBatch,
    Timestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

// --- 1. IndexedDB setup (Dexie) ---

const localDb = new Dexie('PixelSqueezeDB');

localDb.version(2).stores({
    records: '++id, firebaseId, synced, timestamp, name, userId' 
}).upgrade(tx => {
});

// --- 2. Firestore path helper ---

const getRecordCollectionRef = () => {
    if (!db || !userId) {
        throw new Error("Database or User ID is not initialized.");
    }
    // path: /artifacts/{appId}/users/{userId}/compression_records
    const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
    return collection(userDocRef, 'compression_records');
};

// --- 3. core DB operations ---

export async function saveRecord(recordData, isOnline) {
    if (!userId) throw new Error("Must be logged in to save records.");

    const baseData = {
        ...recordData,
        userId: userId // CRITICAL: Link data to specific user
    };

    if (isOnline && isAuthReady) {
        try {
            const firebaseData = {
                ...baseData,
                timestamp: serverTimestamp(),
                synced: true,
            };
            const docRef = await addDoc(getRecordCollectionRef(), firebaseData);
            
            // save locally as synced
            const localData = {
                ...baseData,
                timestamp: Date.now(),
                firebaseId: docRef.id,
                synced: true,
            };
            await localDb.records.add(localData);

            return { message: `Record saved and synced to cloud.`, isSynced: true };

        } catch (error) {
            console.warn("Firebase save failed (fall back to offline):", error);
        }
    }

    // Offline or fallback
    const localData = {
        ...baseData,
        timestamp: Date.now(),
        synced: false,
    };
    await localDb.records.add(localData);
    return { message: `Record saved locally. Sync pending.`, isSynced: false };
}

export async function getLocalRecords() {
    try {
        if (!userId) return [];
        // FILTER: only get records for the current logged-in userId
        const records = await localDb.records
            .where('userId')
            .equals(userId)
            .toArray();
            
        records.sort((a, b) => b.timestamp - a.timestamp);
        return records;
    } catch (e) {
        console.error("Error retrieving local records:", e);
        return [];
    }
}

export async function deleteRecord(id, isFirebaseRecord, isOnline) {
    if (!id) return { message: "Invalid record ID." };

    try {
        if (isFirebaseRecord) {
            const localRecord = await localDb.records.where('firebaseId').equals(id).first();
            if (localRecord) {
                await localDb.records.delete(localRecord.id);
            }
            
            if (isOnline && isAuthReady) {
                const docRef = doc(getRecordCollectionRef(), id);
                await deleteDoc(docRef);
                return `Record deleted everywhere.`;
            } else {
                return `Record deleted locally. Cloud deletion pending.`;
            }
        } else {
            await localDb.records.delete(parseInt(id, 10));
            return `Unsynced record deleted locally.`;
        }
    } catch (error) {
        console.error("Error deleting record:", error);
        throw new Error("Failed to delete record.");
    }
}

// --- 4. synchronization logic ---

export async function syncOfflineToFirebase() {
    if (!isAuthReady || !userId) return { count: 0, message: "Auth not ready." };

    // only sync records belonging to THIS user
    const unsyncedRecords = await localDb.records
        .where('synced').equals(false)
        .and(r => r.userId === userId)
        .toArray();
    
    if (unsyncedRecords.length === 0) return { count: 0, message: "No offline records to sync." };

    const batch = writeBatch(db);
    const collectionRef = getRecordCollectionRef();
    
    for (const record of unsyncedRecords) {
        const firebaseData = {
            name: record.name,
            originalSize: record.originalSize,
            compressedSize: record.compressedSize,
            reduction: record.reduction,
            timestamp: Timestamp.fromMillis(record.timestamp),
            userId: userId,
            synced: true,
        };

        const newDocRef = doc(collectionRef);
        batch.set(newDocRef, firebaseData);

        await localDb.records.update(record.id, {
            synced: true,
            firebaseId: newDocRef.id
        });
    }

    await batch.commit();
    return { count: unsyncedRecords.length, message: `Synced ${unsyncedRecords.length} records.` };
}

export function subscribeToFirebaseRecords(updateUICallback) {
    if (!db) return;

    // use a variable to keep track of the current unsubscription function
    let unsubscribeSnapshot = null;

    onAuthStateChanged(auth, (user) => {
        // 1. if we were listening to a previous user's data, stop listening.
        if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
            unsubscribeSnapshot = null;
        }

        // 2. clear UI immediately to prevent leaking previous user's data
        updateUICallback(); 

        // 3. if a user is logged in, start listening to THEIR data
        if (user) {
            const recordQuery = query(getRecordCollectionRef());
            
            unsubscribeSnapshot = onSnapshot(recordQuery, async (snapshot) => {
                const changes = snapshot.docChanges();
                if (changes.length === 0) {
                    updateUICallback();
                    return;
                }

                for (const change of changes) {
                    const docData = change.doc.data();
                    const firebaseId = change.doc.id;
                    
                    const localData = {
                        name: docData.name,
                        originalSize: docData.originalSize,
                        compressedSize: docData.compressedSize,
                        reduction: docData.reduction,
                        timestamp: docData.timestamp?.toMillis() || Date.now(), 
                        firebaseId: firebaseId,
                        synced: true,
                        userId: user.uid // ensure incoming data is tagged with user ID
                    };

                    try {
                        if (change.type === 'added' || change.type === 'modified') {
                            const existing = await localDb.records.where('firebaseId').equals(firebaseId).first();
                            if (!existing) {
                                await localDb.records.add(localData);
                            } else {
                                await localDb.records.update(existing.id, localData);
                            }
                        } else if (change.type === 'removed') {
                            const localRecord = await localDb.records.where('firebaseId').equals(firebaseId).first();
                            if (localRecord) {
                                await localDb.records.delete(localRecord.id);
                            }
                        }
                    } catch(e) { console.error(e); }
                }
                updateUICallback(); 
            });
        }
    });
}