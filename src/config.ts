const PROD_CONFIG = {
    apiKey: 'AIzaSyCUefO7sAM0YafO3CVslIf8Tn7eRZbXI3s',
    authDomain: 'ethernal-95a14.firebaseapp.com',
    databaseURL: 'https://ethernal-95a14-default-rtdb.firebaseio.com',
    projectId: 'ethernal-95a14',
    storageBucket: 'ethernal-95a14.appspot.com',
    messagingSenderId: '864612390560',
    appId: '1:864612390560:web:b339dc0292ff15f7161bc5'
}

const DEV_CONFIG = {
    apiKey: 123,
    projectId: 'ethernal-95a14',
    databaseURL: process.env.RTDB_HOST,
};

module.exports = {
    FIREBASE_CONFIG: process.env.NODE_ENV == 'development' ? DEV_CONFIG : PROD_CONFIG
};
