import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";

import { getFirestore } from
    "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBoySAJVKWu703qFhyQyUnIAuMmD6iwQUc",
    authDomain: "college-registry-website.firebaseapp.com",
    projectId: "college-registry-website",
    storageBucket:
        "college-registry-website.firebasestorage.app",
    messagingSenderId: "883226236600",
    appId:
        "1:883226236600:web:be4b75d316805a3542064d",
    measurementId: "G-6MTZPKG3TS"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
