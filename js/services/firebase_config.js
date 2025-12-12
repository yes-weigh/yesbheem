
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyAe60OJTWPBt0KsL7q5TMHOf2ecwp_sFEo",
    authDomain: "yesweighmomentumhub.firebaseapp.com",
    projectId: "yesweighmomentumhub",
    storageBucket: "yesweighmomentumhub.firebasestorage.app",
    messagingSenderId: "979624929975",
    appId: "1:979624929975:web:96962436134197488f3b32"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };
