import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyD-vY8rFSs_pvPNaa2urJgs0BuyAxk7rjc",
  authDomain: "daoda-9c68b.firebaseapp.com",
  projectId: "daoda-9c68b",
  storageBucket: "daoda-9c68b.firebasestorage.app",
  messagingSenderId: "1056333522698",
  appId: "1:1056333522698:web:d82665a11f98c487d3bcf3",
  measurementId: "G-7JNPWK46YQ"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app); // If you need it later
export const storage = getStorage(app);

export const auth = getAuth(app);
