const { app, BrowserWindow, Notification, Tray, Menu } = require("electron");
const path = require("path");
const admin = require("firebase-admin");
const player = require("play-sound")();
require("dotenv").config();

// Firebase Admin Initialization
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();
let tray = null;
let win = null;
let lastLeadId = null; // 🧠 Track most recent lead to prevent repeats
let isPlaying = false; // 🔇 Prevent overlapping sounds

function createWindow() {
  win = new BrowserWindow({
    width: 400,
    height: 250,
    show: false,
    webPreferences: { contextIsolation: true },
  });

  win.loadURL("data:text/html;charset=utf-8,<h2 style='font-family:sans-serif;text-align:center;'>Lead Notifier Running</h2>");
}

function createTray() {
  try {
    tray = new Tray(path.join(__dirname, "icon.png"));
    const contextMenu = Menu.buildFromTemplate([
      { label: "Quit", click: () => app.quit() },
    ]);
    tray.setToolTip("Lead Notifier");
    tray.setContextMenu(contextMenu);
  } catch (error) {
    console.error("Failed to create tray icon:", error);
  }
}

function playNotificationSound() {
  if (isPlaying) return;
  isPlaying = true;

  player.play(path.join(__dirname, 'sounds', 'notification.mp3'), (err) => {
    // Only log critical errors, not exit code 1 (harmless on some systems)
    if (err && !String(err).includes('code 1')) {
      console.error("Failed to play sound:", err);
    }
    isPlaying = false;
  });
}

function listenForLeads() {
  const leadsRef = db.collection("leads");

  leadsRef.orderBy("timestamp", "desc").limit(1).onSnapshot(
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const leadId = change.doc.id;
          if (leadId === lastLeadId) return; // Avoid duplicate notification

          lastLeadId = leadId;
          const data = change.doc.data();
          const note = `New lead: ${data.firstName || ""} ${data.lastName || ""}\nPhone: ${data.phone || ""}`;
          new Notification({ title: "📬 New Lead Received", body: note }).show();
          playNotificationSound();
        }
      });
    },
    (err) => {
      console.error("Error listening for leads:", err);
    }
  );
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  listenForLeads();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
