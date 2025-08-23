// electron-app/src/renderer/firebase-config.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

export const app = initializeApp({
  apiKey: "AIzaSyB0g7f_313m1pvVDA7hTQthldNTkjvrgF8",
  authDomain: "priority-lead-sync.firebaseapp.com",
  projectId: "priority-lead-sync",
});
export const db = getFirestore(app); // default DB only
