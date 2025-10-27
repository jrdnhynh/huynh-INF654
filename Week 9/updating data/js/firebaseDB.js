// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js"
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDdomr_-xvC0TbPihy7uHI_ZHHfehdpN_M",
  authDomain: "taskmanager-ab74d.firebaseapp.com",
  databaseURL: "https://taskmanager-ab74d-default-rtdb.firebaseio.com",
  projectId: "taskmanager-ab74d",
  storageBucket: "taskmanager-ab74d.firebasestorage.app",
  messagingSenderId: "567043284179",
  appId: "1:567043284179:web:a98c55798245a8a6af4826",
  measurementId: "G-N610LZE3XW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app)

// add a task
export async function addTaskToFirebase(task) {
  try {
    const docRef = await addDoc(collection(db, "tasks"), task);
    return { id: docRef.id, ...task };
  } catch (e) {
    console.error("Error adding task: ", e);
  }
}

// get tasks
export async function getTasksFromFirebase() {
  const tasks = [];
  try {
    const querySnapshot = await getDocs(collection(db, "tasks"));
    querySnapshot.forEach((doc) => {
      tasks.push({ id: doc.id, ...doc.data() });
    });
  } catch (e) {
    console.error("Error retrieving tasks: ", e);
  }
  return tasks;
}

// delete task
export async function deleteTaskFromFirebase(id) {
  try {
    await deleteDoc(doc(db, "tasks", id));
  } catch (e) {
    console.error("Error deleting task: ", e);
  }
}

// update tasks
export async function updateTaskInFirebase(id, updatedData) {
  try {
    const taskRef = doc(db, "tasks", id);
    await updateDoc(taskRef, updatedData);
  } catch (e) {
    console.error("Error updating task: ", e);
  }
}
