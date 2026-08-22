const { initializeApp, cert, getApps } = require('firebase-admin/app');
require('dotenv').config();

const initFirebase = () => {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const {
    FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY
  } = process.env;

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    console.warn('Firebase environment variables missing. Firebase Admin SDK will not be initialized.');
    return null;
  }

  try {
    const serviceAccount = {
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    };

    const app = initializeApp({
      credential: cert(serviceAccount)
    });

    console.log('Firebase Admin SDK initialized successfully.');
    return app;
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error.message);
    return null;
  }
};

module.exports = { initFirebase };
