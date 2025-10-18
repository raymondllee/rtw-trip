// Firebase Configuration and Initialization
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

import { getRuntimeConfig } from '../config';

const firebaseConfig = getRuntimeConfig().firebase;

console.log('🔧 Initializing Firebase:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain
});

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

console.log('✅ Firebase initialized successfully');
