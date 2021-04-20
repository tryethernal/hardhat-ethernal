const firebase = require('firebase/app');
require('firebase/firestore');
require('firebase/auth');
require('firebase/database');
require('firebase/functions');

import { QueryDocumentSnapshot, SnapshotOptions } from '@firebase/firestore-types';
import { Workspace } from './types';
const { FIREBASE_CONFIG } = require('./config');

const app = firebase.initializeApp(FIREBASE_CONFIG);
const _db = app.firestore();
const _rtdb = firebase.database();
const _auth = firebase.auth;
const _functions = firebase.functions();

var _DB = class DB {

    workspace!: Workspace;

    get userId() {
        return firebase.auth().currentUser?.uid;
    }

    collection(path: string) {
        if (!this.userId || !this.workspace) return;
        var ref = _db.collection('users')
            .doc(this.userId)
            .collection('workspaces')
            .doc(this.workspace.name)
            .collection(path);
        
        return ref;
    }

    contractStorage(contractAddress: string) {
        if (!this.userId || !this.workspace) return;
        return _rtdb.ref(`/users/${this.userId}/workspaces/${this.workspace.name}/contracts/${contractAddress}`);
    }
    
    currentUser() {
        if (!this.userId) return;
        return _db.collection('users')
            .doc(this.userId);
    }

    async workspaces() {
        if (!this.userId) return;
        var res: String[] = [];
        var snapshot = await _db.collection('users')
            .doc(this.userId)
            .collection('workspaces')
            .get();
        snapshot.forEach((doc: QueryDocumentSnapshot) => res.push(doc.id));
        return res;
    }

    async getWorkspace(workspaceName: string) {
        if (!this.userId) return;
        var res = [];
        var snapshot = await _db.collection('users')
            .doc(this.userId)
            .collection('workspaces')
            .doc(workspaceName)
            .withConverter({
                fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions) => {
                    return Object.defineProperty(snapshot.data(options), 'name', { value: workspaceName })
                }
            })
            .get();
        return snapshot.data();
    }
};

if (process.env.NODE_ENV == 'development') {
    _functions.useFunctionsEmulator(process.env.FUNCTIONS_HOST);
    _auth().useEmulator(process.env.AUTH_HOST);

    if (process.env.FIRESTORE_HOST) {
        const firestoreSplit = process.env.FIRESTORE_HOST.split(':');
        _db.useEmulator(firestoreSplit[0], firestoreSplit[1]);
    }
}

module.exports = {
    DB: _DB,
    auth: _auth,
    functions: _functions
}
