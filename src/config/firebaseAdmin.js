const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");

let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
  privateKey = privateKey.slice(1, -1);
}
if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
  privateKey = privateKey.slice(1, -1);
}
privateKey = privateKey.replace(/\\n/g, '\n');

let app;
if (!getApps().length) {
  app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
} else {
  app = getApps()[0];
}

const messaging = getMessaging(app);

module.exports = { messaging };