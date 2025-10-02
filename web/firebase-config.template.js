// Firebase Configuration and Initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';

// Firebase configuration for pdf-extract-393514 project
// INSTRUCTIONS:
// 1. Copy this file to firebase-config.js
// 2. Replace YOUR_API_KEY_HERE with your actual Firebase API key
// 3. Never commit firebase-config.js to git (it's in .gitignore)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "pdf-extract-393514.firebaseapp.com",
  projectId: "pdf-extract-393514",
  storageBucket: "pdf-extract-393514.firebasestorage.app",
  messagingSenderId: "755108588357",
  appId: "1:755108588357:web:164e14af0c2ea4c4196c2c",
  measurementId: "G-E9JS8CSNCP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

export { db };
