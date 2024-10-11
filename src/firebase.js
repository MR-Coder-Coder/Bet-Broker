// firebase.js - Firebase Initialization
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyDVw33Xfy7Pg2kChJj22IliuydsG6UrJY4",
    authDomain: "bet-broker.firebaseapp.com",
    projectId: "bet-broker",
    storageBucket: "bet-broker.appspot.com",
    messagingSenderId: "465548793063",
    appId: "1:465548793063:web:4cd1124be5d169908a7e42",
    measurementId: "G-R7VS71R8QR"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and export it
export const auth = getAuth(app);