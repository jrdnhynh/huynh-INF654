# Pixel Squeeze PWA

## Project Overview

This project is a **Progressive Web App design** for a simple JPEG/PNG image compressor named **Pixel Squeeze**.

The goal of this assignment is to show the core PWA capabilities. This includes **installability** (adding to the home screen) and **offline functionality**, using the **Materialize CSS framework** for a clean, responsive, and app-like user interface.

## Key PWA Features Demonstrated

* **Installability:** The PWA includes the **Web App Manifest** and uses the `beforeinstallprompt` event to simulate adding the application directly to a device's home screen.

* **Offline Access:** **Service Worker** registration is included, indicating that the core UI and compression simulation logic would function even without an internet connection.

* **Responsive Design:** The layout is responsive to both mobile and desktop screen sizes using the Materialize framework.

* **Compression Functionality:** The user interface allows for user input (file selection and quality), simulates processing time, and displays mock size and reduction statistics.

## How to View the PWA

To use the PWA features, follow these steps:

1. **Open the File:** Open the `index.html` file in a modern web browser (Local Web Server/HTTPS Required for PWA installation prompt to appear).

2. **Select a File:** Click the **"Select Picture"** button and choose any JPEG or PNG file from your computer.

3. **Image Compression:** Adjust the quality slider and click the **"Simulate Squeeze & Download"** button.

4. **Observe Results:** A brief loading indicator will display, followed by the results showing the file type, original size, and mock compressed size.

5. **Test Installation:** A green **"Install" banner** should appear at the bottom of the screen, allowing you to trigger the PWA installation prompt.