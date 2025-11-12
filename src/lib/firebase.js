// src/lib/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAaL08nyDxhfIi6qOxhB_iHD9h_pYytwrs",
  authDomain: "haji-agri-86.firebaseapp.com",
  projectId: "haji-agri-86",
  storageBucket: "haji-agri-86.firebasestorage.app",
  messagingSenderId: "568192614473",
  appId: "1:568192614473:web:247f8712d19589c31ebf98",
  measurementId: "G-FFDP91PE6P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);