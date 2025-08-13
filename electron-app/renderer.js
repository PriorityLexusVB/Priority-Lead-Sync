import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";

// Firebase config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// UI Helpers
const leadLog = document.getElementById("lead-log");
const modal = document.getElementById("ai-modal");
const modalText = document.getElementById("ai-modal-text");
const closeModal = document.getElementById("close-modal");

closeModal.addEventListener("click", () => {
  modal.style.display = "none";
});

window.addEventListener("click", (event) => {
  if (event.target === modal) {
    modal.style.display = "none";
  }
});

const showModal = (message) => {
  modalText.textContent = message;
  modal.style.display = "block";
};

// Reuse audio object to avoid recreating it on each notification
const notificationSound = new Audio("sounds/notification.mp3");

const playSound = () => {
  notificationSound.currentTime = 0;
  notificationSound.play();
};

const notifyLead = (lead) => {
  const { first_name, last_name, phone, email, comments, vehicle, trade } = lead;

  const body = `
📞 ${phone} | ✉️ ${email}
🚗 Vehicle: ${vehicle}
🔁 Trade: ${trade}
💬 Comments: ${comments || "None"}
`;

  const showNotification = () => {
    new Notification(`🔥 New Lead: ${first_name} ${last_name}`, {
      body,
      silent: false,
    });

    playSound();
  };

  if (Notification.permission === "default") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        showNotification();
      }
    });
  } else if (Notification.permission === "granted") {
    showNotification();
  }
};

const notifyUser = (title, body) => {
  const showNotification = () => {
    new Notification(title, { body, silent: true });
  };

  if (Notification.permission === "default") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        showNotification();
      }
    });
  } else if (Notification.permission === "granted") {
    showNotification();
  }
};

const logLeadToUI = (lead) => {
  const div = document.createElement("div");
  div.className = "lead-entry";
  div.innerHTML = `
    <h3>${lead.first_name} ${lead.last_name}</h3>
    <p><strong>Phone:</strong> ${lead.phone}</p>
    <p><strong>Email:</strong> ${lead.email}</p>
    <p><strong>Vehicle:</strong> ${lead.vehicle}</p>
    <p><strong>Trade:</strong> ${lead.trade}</p>
    <p><strong>Comments:</strong> ${lead.comments || "None"}</p>
    <hr />
  `;
  leadLog.prepend(div);
};

const generateReply = async (lead) => {
  try {
    return await window.electronAPI.generateAIReply(lead);
  } catch (error) {
    console.error("OpenAI IPC error:", error);
    notifyUser("AI Reply Error", "Failed to generate AI suggestion.");
    return null;
  }
};

// Live Listener
const q = query(collection(db, "leads_v2"), orderBy("receivedAt", "desc"));

onSnapshot(q, async (snapshot) => {
  const latest = snapshot.docChanges().filter((change) => change.type === "added");

  for (let change of latest) {
    const lead = change.doc.data();

    notifyLead(lead);
    logLeadToUI(lead);

    const aiReply = await generateReply(lead);
    if (aiReply) {
      console.log("✍️ AI Suggestion:", aiReply);
      showModal(aiReply);
    }
  }
});
