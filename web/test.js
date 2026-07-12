const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

const app = initializeApp({
  credential: cert(serviceAccount)
});
const db = getFirestore(app);

async function checkStores() {
  const snap = await db.collection('stores').get();
  snap.forEach(doc => {
    console.log(doc.id, '->', doc.data().infraConfig?.projectId);
  });
}
checkStores().catch(console.error);
