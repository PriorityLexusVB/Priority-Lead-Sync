# Priority Lead Sync – User Guide

This guide describes what happens after the desktop notifier is installed and running.

## Running in the Background
- The app launches when the computer starts and lives in the system tray as **Priority Lead Alert**.
- The tray menu provides **Show App** to reveal the window and **Quit** to exit.
- Clicking the tray icon toggles the main window.

## Desktop Window
- The window lists leads as they arrive. Each entry shows the customer's contact details, vehicle interest, trade information and comments.
- You can open the window from the tray or leave it hidden while notifications arrive.

## Notifications
- When a new lead is written to the `leads_v2` collection, the app shows a desktop notification with a chime.
- The notification displays the customer's phone, email, vehicle, trade and comments.
- The first time the app runs, you'll be asked to grant notification permission.

## AI Reply Suggestions
- After each lead, the app sends the lead details to OpenAI and displays an AI‑generated follow‑up message.
- The suggestion appears in a pop‑up modal on top of the window; close it with the × button.

## Quitting
- Selecting **Quit** from the tray or closing the window (on Windows/Linux) exits the application.
- On macOS, closing the window keeps the tray icon active; use **Quit** to fully exit.

Enjoy real‑time lead alerts on your desktop.
