const PROD_CONFIG = {
    apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyCUefO7sAM0YafO3CVslIf8Tn7eRZbXI3s',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'ethernal-95a14.firebaseapp.com',
    databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://ethernal-95a14-default-rtdb.firebaseio.com',
    projectId: process.env.FIREBASE_PROJECT_ID || 'ethernal-95a14',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'ethernal-95a14.appspot.com',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '864612390560',
    appId: process.env.FIREBASE_APP_ID || '1:864612390560:web:b339dc0292ff15f7161bc5'
}

const DEV_CONFIG = {
    apiKey: 123,
    projectId: 'ethernal-95a14',
    databaseURL: process.env.RTDB_HOST,
};

module.exports = {
    FIREBASE_CONFIG: process.env.NODE_ENV == 'development' ? DEV_CONFIG : PROD_CONFIG
};
