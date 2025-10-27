import { openDB } from "https://unpkg.com/idb?module";
import {
  addTaskToFirebase,
  getTasksFromFirebase,
  deleteTaskFromFirebase,
} from "./firebaseDB.js";

// Initialize Sidenav and Forms
document.addEventListener("DOMContentLoaded", function () {
  const menus = document.querySelector(".sidenav");
  M.Sidenav.init(menus, { edge: "right" });

  const forms = document.querySelector(".side-form");
  M.Sidenav.init(forms, { edge: "left" });

  // Load tasks from IndexedDB and sync with Firebase
  loadTasks();
  syncTasks();

  // Check storage usage
  checkStorageUsage();

  // Request persistent storage
  requestPersistentStorage();
});

// Register Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/serviceworker.js")
    .then((req) => console.log("Service Worker Registered!", req))
    .catch((err) => console.log("Service Worker registration failed", err));
}

// Create IndexedDB database
async function createDB() {
  const db = await openDB("taskManager", 1, {
    upgrade(db) {
      const store = db.createObjectStore("tasks", {
        keyPath: "id",
        autoIncrement: true,
      });
      store.createIndex("status", "status");
      store.createIndex("synced", "synced");
    },
  });
  return db;
}

// Add Task (either to Firebase or IndexedDB)
async function addTask(task) {
  const db = await createDB();
  let taskId;

  if (navigator.onLine) {
    // Online - Add task to Firebase and get the Firebase ID
    const savedTask = await addTaskToFirebase(task);
    taskId = savedTask.id;

    // Add task with Firebase ID to IndexedDB for consistency
    const tx = db.transaction("tasks", "readwrite");
    const store = tx.objectStore("tasks");
    await store.put({ ...task, id: taskId, synced: true });
    await tx.done;
  } else {
    // Offline - Ensure a unique temporary ID is generated if none exists
    taskId = `temp-${Date.now()}`;

    // Check if taskId is valid before adding to IndexedDB
    const taskToStore = { ...task, id: taskId, synced: false };
    if (!taskToStore.id) {
      console.error("Failed to generate a valid ID for the task.");
      return; // Exit if the ID is invalid
    }

    const tx = db.transaction("tasks", "readwrite");
    const store = tx.objectStore("tasks");
    await store.put(taskToStore);
    await tx.done;
  }

  checkStorageUsage();

  // Return task with ID
  return { ...task, id: taskId };
}

// Sync unsynced tasks from IndexedDB to Firebase
async function syncTasks() {
  const db = await createDB();
  const tx = db.transaction("tasks", "readonly");
  const store = tx.objectStore("tasks");

  // Fetch all unsynced tasks
  const tasks = await store.getAll();
  await tx.done; // Complete the transaction used to read tasks

  for (const task of tasks) {
    if (!task.synced && navigator.onLine) {
      try {
        // Create a new task object with only the fields needed for Firebase
        const taskToSync = {
          title: task.title,
          description: task.description,
          status: task.status,
        };

        // Send the task to Firebase and get the new ID
        const savedTask = await addTaskToFirebase(taskToSync);

        // Replace temporary ID with Firebase ID and mark as synced
        const txUpdate = db.transaction("tasks", "readwrite");
        const storeUpdate = txUpdate.objectStore("tasks");

        // Remove the temporary entry if it exists
        await storeUpdate.delete(task.id);
        // Add the updated task with Firebase ID
        await storeUpdate.put({ ...task, id: savedTask.id, synced: true });
        await txUpdate.done;
      } catch (error) {
        console.error("Error syncing task:", error);
      }
    }
  }
}

// Delete Task with Transaction
async function deleteTask(id) {
  console.log(id);
  if (!id) {
    console.error("Invalid ID passed to deleteTask.");
    return;
  }
  const db = await createDB();
  // Delete from Firebase if online
  if (navigator.onLine) {
    await deleteTaskFromFirebase(id);
  }
  // Delete from IndexedDB
  const tx = db.transaction("tasks", "readwrite");
  const store = tx.objectStore("tasks");

  try {
    await store.delete(id);
  } catch (e) {
    console.error("Error deleting task from IndexedDB:", e);
  }

  await tx.done;

  // Remove task from UI
  const taskCard = document.querySelector(`[data-id="${id}"]`);
  if (taskCard) {
    taskCard.remove();
  }

  // Update storage usage
  checkStorageUsage();
}

// Load tasks and sync with Firebase if online
export async function loadTasks() {
  const db = await createDB();
  const taskContainer = document.querySelector(".tasks");
  taskContainer.innerHTML = ""; // Clear current tasks

  // Load tasks from Firebase if online
  if (navigator.onLine) {
    const firebaseTasks = await getTasksFromFirebase();
    const tx = db.transaction("tasks", "readwrite");
    const store = tx.objectStore("tasks");

    for (const task of firebaseTasks) {
      // Save tasks to IndexedDB with 'synced' flag
      await store.put({ ...task, synced: true });
      displayTask(task); // Display each task in the UI
    }
    await tx.done;
  } else {
    // Load tasks from IndexedDB if offline
    const tx = db.transaction("tasks", "readonly");
    const store = tx.objectStore("tasks");
    const tasks = await store.getAll();

    tasks.forEach((task) => {
      displayTask(task);
    });
    await tx.done;
  }
}

// Display Task in the UI
function displayTask(task) {
  const taskContainer = document.querySelector(".tasks");
  const html = `
    <div class="card-panel white row valign-wrapper" data-id="${task.id}">
      <div class="col s2">
        <img src="/img/icons/task.png" class="circle responsive-img" alt="Task icon" style="max-width: 100%; height: auto"/>
      </div>
      <div class="task-detail col s8">
        <h5 class="task-title black-text">${task.title}</h5>
        <div class="task-description">${task.description}</div>
      </div>
      <div class="col s2 right-align">
        <button class="task-delete btn-flat" aria-label="Delete task">
          <i class="material-icons black-text text-darken-1" style="font-size: 30px">delete</i>
        </button>
      </div>
    </div>
  `;
  taskContainer.insertAdjacentHTML("beforeend", html);

  // Attach delete event listener
  const deleteButton = taskContainer.querySelector(
    `[data-id="${task.id}"] .task-delete`
  );
  deleteButton.addEventListener("click", () => deleteTask(task.id));
}

// Add Task Button Listener
const addTaskButton = document.querySelector(".btn-small");
addTaskButton.addEventListener("click", async () => {
  const titleInput = document.querySelector("#title");
  const descriptionInput = document.querySelector("#description");

  const task = {
    title: titleInput.value,
    description: descriptionInput.value,
    status: "pending",
  };

  const savedTask = await addTask(task); // Add task and get task with ID
  displayTask(savedTask); // Display task in UI with correct ID

  titleInput.value = "";
  descriptionInput.value = "";

  const forms = document.querySelector(".side-form");
  const instance = M.Sidenav.getInstance(forms);
  instance.close();
});

// Function to check storage usage
async function checkStorageUsage() {
  if (navigator.storage && navigator.storage.estimate) {
    const { usage, quota } = await navigator.storage.estimate();
    const usageInMB = (usage / (1024 * 1024)).toFixed(2); // Convert to MB
    const quotaInMB = (quota / (1024 * 1024)).toFixed(2); // Convert to MB

    console.log(`Storage used: ${usageInMB} MB of ${quotaInMB} MB`);

    const storageInfo = document.querySelector("#storage-info");
    if (storageInfo) {
      storageInfo.textContent = `Storage used: ${usageInMB} MB of ${quotaInMB} MB`;
    }

    if (usage / quota > 0.8) {
      const storageWarning = document.querySelector("#storage-warning");
      if (storageWarning) {
        storageWarning.textContent =
          "Warning: You are running low on storage space. Please delete old tasks to free up space.";
        storageWarning.style.display = "block";
      }
    } else {
      const storageWarning = document.querySelector("#storage-warning");
      if (storageWarning) {
        storageWarning.textContent = "";
        storageWarning.style.display = "none";
      }
    }
  }
}

// Function to request persistent storage
async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    const isPersistent = await navigator.storage.persist();
    console.log(`Persistent storage granted: ${isPersistent}`);

    const storageMessage = document.querySelector("#persistent-storage-info");
    if (storageMessage) {
      if (isPersistent) {
        storageMessage.textContent =
          "Persistent storage granted. Your data is safe!";
        storageMessage.classList.remove("red-text");
        storageMessage.classList.add("green-text");
      } else {
        storageMessage.textContent =
          "Persistent storage not granted. Data might be cleared under storage pressure.";
        storageMessage.classList.remove("green-text");
        storageMessage.classList.add("red-text");
      }
    }
  }
}

// Event listener to detect online status and sync
window.addEventListener("online", syncTasks);
window.addEventListener("online", loadTasks);