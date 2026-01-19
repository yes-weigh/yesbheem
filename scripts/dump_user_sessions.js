const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function dumpUser() {
    const uid = 'DpCw3RC0m4hIDtefItsncGmTdul2'; // mhdfazalvs@gmail.com
    console.log(`Dumping data for ${uid}...`);

    const userRef = db.collection('users').doc(uid);
    const doc = await userRef.get();

    if (!doc.exists) {
        console.log('User not found');
        return;
    }

    const data = doc.data();
    console.log(JSON.stringify(data, null, 2));

    // Specifically check for weird keys
    console.log("\n--- Keys Analysis ---");
    Object.keys(data).forEach(key => {
        if (key.includes('activeSessions')) {
            console.log(`Key: "${key}" | Type: ${typeof data[key]} | IsNull: ${data[key] === null}`);
        }
    });
}

dumpUser().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
