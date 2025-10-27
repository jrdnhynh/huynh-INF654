import { openDB } from "https://unpkg.com/idb?module";
import {
  addTaskToFirebase,
  getTasksFromFirebase,
  deleteTaskFromFirebase,
  updateTaskInFirebase,
} from "./firebaseDB.js";

// --- Constants ---
const STORAGE_THRESHOLD = 0.8;

// --- Initialization and Event Listeners ---
document.addEventListener("DOMContentLoaded", function () {
  const menus = document.querySelector(".sidenav");
  M.Sidenav.init(menus, { edge: "right" });
  const forms = document.querySelector(".side-form");
  M.Sidenav.init(forms, { edge: "left" });

  // Load tasks from IndexedDB and sync with Firebase
  loadTasks();
  syncTasks();
  checkStorageUsage();
  requestPersistentStorage();
});

// Register Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/serviceworker.js")
    .then((req) => console.log("Service Worker Registered!", req))
    .catch((err) => console.log("Service Worker registration failed", err));
}

// --- Database Operations ---

// Create or Get IndexedDB database instance
let dbPromise;
async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB("taskManager", 1, {
      upgrade(db) {
        const store = db.createObjectStore("tasks", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("status", "status");
        store.createIndex("synced", "synced");
      },
    });
  }
  return dbPromise;
}

// Sync unsynced tasks from IndexedDB to Firebase
async function syncTasks() {
  const db = await getDB();
  const tx = db.transaction("tasks", "readonly");
  const store = tx.objectStore("tasks");
  const tasks = await store.getAll();
  await tx.done;

  for (const task of tasks) {
    if (!task.synced && isOnline()) {
      try {
        const taskToSync = {
          title: task.title,
          description: task.description,
          status: task.status,
        };
        const savedTask = await addTaskToFirebase(taskToSync);
        const txUpdate = db.transaction("tasks", "readwrite");
        const storeUpdate = txUpdate.objectStore("tasks");
        await storeUpdate.delete(task.id);
        await storeUpdate.put({ ...task, id: savedTask.id, synced: true });
        await txUpdate.done;
      } catch (error) {
        console.error("Error syncing task:", error);
      }
    }
  }
}

// Check if the app is online
function isOnline() {
  return navigator.onLine;
}

// --- Task Management Functions ---

// Add Task (either to Firebase or IndexedDB)
async function addTask(task) {
  const db = await getDB();
  let taskId;

  if (isOnline()) {
    try {
      const savedTask = await addTaskToFirebase(task);
      taskId = savedTask.id;
      const tx = db.transaction("tasks", "readwrite");
      const store = tx.objectStore("tasks");
      await store.put({ ...task, id: taskId, synced: true });
      await tx.done;
    } catch (error) {
      console.error("Error adding task to Firebase:", error);
    }
  } else {
    taskId = `temp-${Date.now()}`;
    const taskToStore = { ...task, id: taskId, synced: false };
    const tx = db.transaction("tasks", "readwrite");
    const store = tx.objectStore("tasks");
    await store.put(taskToStore);
    await tx.done;
  }

  checkStorageUsage();
  return { ...task, id: taskId };
}

// Edit Task with Transaction
async function editTask(id, updatedData) {
  if (!id) {
    console.error("Invalid ID passed to editTask.");
    return;
  }

  const db = await getDB();

  if (isOnline()) {
    try {
      await updateTaskInFirebase(id, updatedData);
      // Update in IndexedDB as well
      const tx = db.transaction("tasks", "readwrite");
      const store = tx.objectStore("tasks");
      await store.put({ ...updatedData, id: id, synced: true });
      await tx.done;

      // Reload the entire task list to reflect the updates
      loadTasks(); // Call loadTasks here to refresh the UI
    } catch (error) {
      console.error("Error updating task in Firebase:", error);
    }
  } else {
    // If offline, make an IndexedDB transaction
    const tx = db.transaction("tasks", "readwrite");
    const store = tx.objectStore("tasks");
    await store.put({ ...updatedData, id: id, synced: false });
    await tx.done;
    loadTasks(); // Refresh the UI with loadTasks here as well
  }
}

// Delete Task with Transaction
async function deleteTask(id) {
  if (!id) {
    console.error("Invalid ID passed to deleteTask.");
    return;
  }
  const db = await getDB();
  if (isOnline()) {
    try {
      await deleteTaskFromFirebase(id);
    } catch (error) {
      console.error("Error deleting task from Firebase:", error);
    }
  }

  const tx = db.transaction("tasks", "readwrite");
  const store = tx.objectStore("tasks");
  try {
    await store.delete(id);
  } catch (e) {
    console.error("Error deleting task from IndexedDB:", e);
  }
  await tx.done;

  const taskCard = document.querySelector(`[data-id="${id}"]`);
  if (taskCard) {
    taskCard.remove();
  }
  checkStorageUsage();
}

// --- UI Functions ---
// Load tasks and sync with Firebase if online
export async function loadTasks() {
  const db = await getDB();
  const taskContainer = document.querySelector(".tasks");
  taskContainer.innerHTML = "";

  if (isOnline()) {
    const firebaseTasks = await getTasksFromFirebase();
    const tx = db.transaction("tasks", "readwrite");
    const store = tx.objectStore("tasks");

    for (const task of firebaseTasks) {
      await store.put({ ...task, synced: true });
      displayTask(task);
    }
    await tx.done;
  } else {
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

  // Check if the task already exists in the UI and remove it
  const existingTask = taskContainer.querySelector(`[data-id="${task.id}"]`);
  if (existingTask) {
    existingTask.remove();
  }

  // Create new task HTML and add it to the container
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
        <button class="task-edit btn-flat" data-target="side-form" aria-label="Edit task">
          <i class="material-icons black-text text-darken-1" style="font-size: 30px">edit</i>
        </button>
      </div>
    </div>
  `;
  taskContainer.insertAdjacentHTML("beforeend", html);

  const deleteButton = taskContainer.querySelector(
    `[data-id="${task.id}"] .task-delete`
  );
  deleteButton.addEventListener("click", () => deleteTask(task.id));

  const editButton = taskContainer.querySelector(
    `[data-id="${task.id}"] .task-edit`
  );
  editButton.addEventListener("click", () =>
    openEditForm(task.id, task.title, task.description)
  );
}

// Add/Edit Task Button Listener
const addTaskButton = document.querySelector("#form-action-btn");
addTaskButton.addEventListener("click", async () => {
  const titleInput = document.querySelector("#title");
  const descriptionInput = document.querySelector("#description");
  const taskIdInput = document.querySelector("#task-id");
  const formActionButton = document.querySelector("#form-action-btn");
  // Prepare the task data
  const taskId = taskIdInput.value; // If editing, this will have a value
  const taskData = {
    title: titleInput.value,
    description: descriptionInput.value,
    status: "pending",
  };
  if (!taskId) {
    // If no taskId, we are adding a new task
    const savedTask = await addTask(taskData);
    displayTask(savedTask); // Display new task in the UI
  } else {
    // If taskId exists, we are editing an existing task
    await editTask(taskId, taskData); // Edit task in Firebase and IndexedDB
    loadTasks(); // Refresh task list to show updated data
  }
  // Reset the button text and close the form
  formActionButton.textContent = "Add";
  closeForm();
});

// Open Edit Form with Existing Task Data
function openEditForm(id, title, description) {
  const titleInput = document.querySelector("#title");
  const descriptionInput = document.querySelector("#description");
  const taskIdInput = document.querySelector("#task-id");
  const formActionButton = document.querySelector("#form-action-btn");

  // Fill in the form with existing task data
  titleInput.value = title;
  descriptionInput.value = description;
  taskIdInput.value = id; // Set taskId for the edit operation
  formActionButton.textContent = "Edit"; // Change the button text to "Edit"

  M.updateTextFields(); // Materialize CSS form update

  // Open the side form
  const forms = document.querySelector(".side-form");
  const instance = M.Sidenav.getInstance(forms);
  instance.open();
}

// Helper function to reset the form after use
function closeForm() {
  const titleInput = document.querySelector("#title");
  const descriptionInput = document.querySelector("#description");
  const taskIdInput = document.querySelector("#task-id");
  const formActionButton = document.querySelector("#form-action-btn");
  titleInput.value = "";
  descriptionInput.value = "";
  taskIdInput.value = "";
  formActionButton.textContent = "Add";
  const forms = document.querySelector(".side-form");
  const instance = M.Sidenav.getInstance(forms);
  instance.close();
}

// Check storage usage and display warnings
async function checkStorageUsage() {
  if (navigator.storage && navigator.storage.estimate) {
    const { usage, quota } = await navigator.storage.estimate();
    const usageInMB = (usage / (1024 * 1024)).toFixed(2);
    const quotaInMB = (quota / (1024 * 1024)).toFixed(2);
    console.log(`Storage used: ${usageInMB} MB of ${quotaInMB} MB`);

    const storageInfo = document.querySelector("#storage-info");
    if (storageInfo) {
      storageInfo.textContent = `Storage used: ${usageInMB} MB of ${quotaInMB} MB`;
    }

    const storageWarning = document.querySelector("#storage-warning");
    if (usage / quota > STORAGE_THRESHOLD) {
      if (storageWarning) {
        storageWarning.textContent = "Warning: Running low on storage space.";
        storageWarning.style.display = "block";
      }
    } else if (storageWarning) {
      storageWarning.textContent = "";
      storageWarning.style.display = "none";
    }
  }
}

// Request persistent storage
async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    const isPersistent = await navigator.storage.persist();
    console.log(`Persistent storage granted: ${isPersistent}`);

    const storageMessage = document.querySelector("#persistent-storage-info");
    if (storageMessage) {
      storageMessage.textContent = isPersistent
        ? "Persistent storage granted!"
        : "Data might be cleared under storage pressure.";
      storageMessage.classList.toggle("green-text", isPersistent);
      storageMessage.classList.toggle("red-text", !isPersistent);
    }
  }
}

// Event listener to detect online status and sync
window.addEventListener("online", syncTasks);
window.addEventListener("online", loadTasks);