import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import OpenAI from "openai";

// Firebase config
const firebaseConfig = {
  apiKey: window.electronAPI.getEnv('FIREBASE_API_KEY'),
  authDomain: window.electronAPI.getEnv('FIREBASE_AUTH_DOMAIN'),
  projectId: window.electronAPI.getEnv('FIREBASE_PROJECT_ID'),
  storageBucket: window.electronAPI.getEnv('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: window.electronAPI.getEnv('FIREBASE_MESSAGING_SENDER_ID'),
  appId: window.electronAPI.getEnv('FIREBASE_APP_ID'),
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// OpenAI
const openai = new OpenAI({
  apiKey: window.electronAPI.getEnv('OPENAI_API_KEY'),
  dangerouslyAllowBrowser: true,
});

// UI Helpers
const leadLog = document.getElementById("lead-log");

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
  const prompt = lead.comments
    ? `Customer wrote: "${lead.comments}". Craft a helpful, concise reply to book an appointment at our Lexus dealership.`
    : `Generate a compelling message to follow up with a customer interested in a ${lead.vehicle}. Include dealership name and suggest a time to come in.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices[0].message.content;
};

// Live Listener
const q = query(collection(db, "leads"), orderBy("receivedAt", "desc"));

onSnapshot(q, async (snapshot) => {
  const latest = snapshot.docChanges().filter((change) => change.type === "added");

  for (let change of latest) {
    const lead = change.doc.data();

    notifyLead(lead);
    logLeadToUI(lead);

    const aiReply = await generateReply(lead);
    console.log("✍️ AI Suggestion:", aiReply);

    // Optional: display in popup/modal if needed
    alert(`AI Response:\n${aiReply}`);
  }
});
