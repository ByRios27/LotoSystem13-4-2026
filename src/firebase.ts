// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDK2BETkJGwmZYH2tqSiA5MWOet4bTomAo",
  authDomain: "chances-pro-28881102-6f5e0.firebaseapp.com",
  projectId: "chances-pro-28881102-6f5e0",
  storageBucket: "chances-pro-28881102-6f5e0.firebasestorage.app",
  messagingSenderId: "1075918394533",
  appId: "1:1075918394533:web:45379e63e71fe277f6694c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, firebaseConfig };
