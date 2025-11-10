# Pixel Squeeze PWA

## Project Overview

This project is a **Progressive Web App design** for a simple JPEG/PNG image compressor named **Pixel Squeeze**.

The goal of this assignment is to show the core PWA capabilities. This includes **installability** (adding to the home screen) and **offline functionality**, using the **Materialize CSS framework** for a clean, responsive, and app-like user interface.

## Key PWA Features Demonstrated

* **Installability:** The PWA includes the **Web App Manifest** and uses the `beforeinstallprompt` event to simulate adding the application directly to a device's home screen.

* **Offline Access:** **Service Worker** registration is included, indicating that the core UI and compression simulation logic would function even without an internet connection.

* **Responsive Design:** The layout is responsive to both mobile and desktop screen sizes using the Materialize framework.

* **Compression Functionality:** The user interface allows for user input (file selection and quality), simulates processing time, and displays mock size and reduction statistics.

***

## Data Storage and Offline Sync

To give you a history of your compression and make sure the app works even without Wi-Fi, we use two different databases that constantly talk to each other:

1.  **IndexedDB (Local Database):** This is a small, hidden database that lives **inside your web browser** on your device. It's the key to **offline functionality** because it stores your history locally.
2.  **Firebase Firestore (Cloud Database):** This is the main server database. It securely stores your records so you can see your history on **any device** (like your phone or a different computer).

### CRUD (Create, Read, Update, Delete) Operations

Here's how saving and managing your history works, depending on your connection:

| Operation | Online Mode (Connected to Internet) | Offline Mode (No Internet) |
| :--- | :--- | :--- |
| **Create (Save)** | Saves immediately to **IndexedDB** (local) and **Firebase** (cloud). | Saves only to **IndexedDB** (local), marking the record as *unsynced*. |
| **Read (View History)** | Pulls history from both local and cloud databases for a complete, up-to-date list. | Only shows records saved in **IndexedDB**. |
| **Delete (Remove History)**| Deletes the record from **both** IndexedDB and Firebase to remove it everywhere. | Only deletes the local copy. It will be removed from the cloud once you connect and sync. |

### Synchronization

1.  **Offline Work Queued:** When you use the app offline, any new compression records are saved to **IndexedDB** and labeled as `synced: false`.
2.  **The Sync Moment:** As soon as your device gets back online, the app runs the synchronization process:
    * It checks IndexedDB for all records labeled `synced: false`.
    * It sends these "unsynced" records up to Firebase.
3.  **Firebase ID:** When a record is successfully saved on the Firebase server, Firebase gives it a unique identifier called a **Firebase ID**.
4.  **Local Update:** The app then takes that new **Firebase ID** and updates the local record in IndexedDB, marking it as `synced: true`. This ensures the app knows which local records now have a cloud match.
5.  **Real-Time Listening:** The app also uses a feature called `onSnapshot` to **listen** to Firebase in real-time. If you save a record on your phone, Firebase instantly tells your computer, which then saves the record locally using the same **Firebase ID**, making your history appear instantly across devices.

***

## How to View the PWA

To use the PWA features, follow these steps:

1.  **Open the File:** Open the `index.html` file in a modern web browser (Local Web Server/HTTPS Required for PWA installation prompt to appear).

2.  **Select a File:** Click the **"Select Picture"** button and choose any JPEG or PNG file from your computer.

3.  **Image Compression:** Adjust the quality slider and click the **"Squeeze & Download"** button.

4.  **Observe Results:** A brief loading indicator will display, followed by the results showing the file type, original size, and mock compressed size.

5.  **Test Installation:** A green **"Install" banner** should appear at the bottom of the screen, allowing you to trigger the PWA installation prompt.