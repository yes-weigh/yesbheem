const admin = require('firebase-admin');
const fs = require('fs');
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
    fs.writeFileSync('dump_output.json', JSON.stringify(data, null, 2));
    console.log('Dump written to dump_output.json');
}

dumpUser().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
