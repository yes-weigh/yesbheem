
import { db, app } from './services/firebase_config.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

async function seedAdmins() {
    /**
     * IMPORTANT: SECURITY NOTE
     * This script allows you to programmatically add Admins/Users.
     * 
     * LIMITATION:
     * - This script complies with Firestore Security Rules.
     * - It will ONLY work if the specific user running it (You) is ALREADY logged in as an 'admin'.
     * - You cannot use this to "Break In" if you are locked out.
     * 
     * USAGE:
     * - Use this to quickly set up a team or reset permissions while you still have access.
     * - If completely locked out, use the Firebase Console website directly.
     */
    console.log("Starting Admin Seeding...");

    // Admins to Seed
    const admins = [
        { email: 'fak.mzn@gmail.com', phone: '919544227744', role: 'admin' },
        { email: 'mhdfazalvs@gmail.com', phone: '918089059824', role: 'admin' }
    ];

    for (const admin of admins) {
        try {
            console.log(`Seeding ${admin.email}...`);
            const docRef = doc(db, 'authorized_users', admin.email);
            // Check if exists first to avoid overwriting timestamps if not needed (though setDoc with merge is safer)
            await setDoc(docRef, {
                phone: admin.phone,
                role: admin.role,
                seededAt: new Date().toISOString(),
                active: true
            }, { merge: true });
            console.log(`✅ Success: ${admin.email}`);
        } catch (error) {
            console.error(`❌ Failed: ${admin.email}`, error);
        }
    }
    console.log("Seeding Complete.");
}

// Global scope for console access
window.seedAdmins = seedAdmins;
console.log("Load this script and run window.seedAdmins() in console.");
