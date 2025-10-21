// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCUQn6bqAwV_rLw5DjnSKuDnrEsTmQR-Yc",
  authDomain: "cad2526-2240398.firebaseapp.com",
  databaseURL: "https://cad2526-2240398-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "cad2526-2240398",
  storageBucket: "cad2526-2240398.firebasestorage.app",
  messagingSenderId: "1066630442131",
  appId: "1:1066630442131:web:b3006d173114320d443166"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Export para usar noutros ficheiros
export { database };