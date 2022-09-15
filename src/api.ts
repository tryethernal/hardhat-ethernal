const axios = require('axios');
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { BlockWithTransactions, TransactionResponse, TransactionReceipt } from '@ethersproject/abstract-provider';
import { Workspace, TraceStep } from './types';
const { FIREBASE_CONFIG } = require('./config');

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const functions = getFunctions(app);

export class Api {
    private apiRoot: string;
    private webappRoot: string;
    private firebaseUserId: string | undefined;
    private currentUser: any;
    private currentWorkspace: Workspace | undefined;
    private auth: any;

    constructor(apiRoot: string, webappRoot: string) {
        this.apiRoot = apiRoot;
        this.auth = auth;
        this.webappRoot = webappRoot;
    }

    get isLoggedIn() {
        return !!this.currentUser;
    }

    get hasWorkspace() {
        console.log(this.currentWorkspace)
        return !!this.currentWorkspace;
    }

    get currentWorkspaceName() {
        return this.currentWorkspace?.name;
    }

    async getFirebaseAuthToken() {
        return this.auth?.currentUser ? await this.auth.currentUser.getIdToken() : null;
    }

    async login(email: string, password: string) {
        try {
            if (process.env.AUTH_HOST)
                connectAuthEmulator(auth, process.env.AUTH_HOST);

            if (process.env.FUNCTIONS_HOST)
                connectFunctionsEmulator(functions, 'localhost', 5001);

            await signInWithEmailAndPassword(this.auth, email, password);
            if (this.auth.currentUser) {
                this.firebaseUserId = this.auth.currentUser.uid;
                const firebaseAuthToken = await this.getFirebaseAuthToken();
                this.currentUser = (await axios.get(`${this.apiRoot}/api/users/me?firebaseAuthToken=${firebaseAuthToken}`)).data;

                if (!this.currentUser.workspaces.length)
                    throw new Error(`You need to create a new workspace on ${this.webappRoot} before using the plugin`);

                if (this.currentUser.currentWorkspace)
                    this.currentWorkspace = this.currentUser.currentWorkspace;
                else {
                    await this.setWorkspace(this.currentUser.workspaces[0].name);
                    await axios.post(`${this.apiRoot}/api/users/me/setCurrentWorkspace`, { firebaseAuthToken, data: { workspace: this.currentUser.workspaces[0].name }});
                }
            }
            else
                throw new Error(`Couldn't login with the specified email/password`);
        } catch(error: any) {
            if (error.code == 'auth/wrong-password')
                throw new Error(`Couldn't login with the specified email/password`);
            throw error;
        }
    }

    async setWorkspace(workspace: string | undefined) {
        if (workspace && this.currentUser) {
            let foundWorkspace = false;
            for (let i = 0; i < this.currentUser.workspaces.length; i++) {
                const loopedWorkspace = this.currentUser.workspaces[i];
                if (loopedWorkspace.name == workspace) {
                    this.currentWorkspace = loopedWorkspace;
                    foundWorkspace = true;
                    break;
                }
            }
            if (!foundWorkspace)
                throw new Error(`Couldn't find workspace ${workspace}. Make sure you're logged in with the correct account`);

            const firebaseAuthToken = await this.getFirebaseAuthToken();
            if (!firebaseAuthToken)
                throw new Error('[setWorkspace] You need to be authenticated to set a workspace');
        }

        return this.currentWorkspace;
    }

    async resetWorkspace(workspaceName: string) {
        if (!workspaceName)
            throw new Error('[resetWorkspace] Missing workspace name');

        const firebaseAuthToken = await this.getFirebaseAuthToken();
        if (!firebaseAuthToken)
            throw new Error('[resetWorkspace] You need to be authenticated to reset a workspace');
        
        return await axios.post(`${this.apiRoot}/api/workspaces/reset`, { firebaseAuthToken, data: { workspace: workspaceName }});
    }

    async syncBlock(block: BlockWithTransactions, serverSync: boolean = false) {
        if (!block)
            throw new Error('[syncBlock] Missing block');

        const firebaseAuthToken = await this.getFirebaseAuthToken();
        if (!firebaseAuthToken)
            throw new Error('[syncBlock] You need to be authenticated to reset a workspace');

        if (!this.currentWorkspace)
            throw new Error('[syncBlock] The workspace needs to be set to synchronize blocks.')

        return await axios.post(`${this.apiRoot}/api/blocks?serverSync=${serverSync}`, { firebaseAuthToken, data: { block: block, workspace: this.currentWorkspace.name }});
    }

    async syncTransaction(block: BlockWithTransactions, transaction: TransactionResponse, transactionReceipt: TransactionReceipt) {
        if (!block || !transaction || !transactionReceipt)
            throw new Error('[syncTransaction] Missing parameter');

        const firebaseAuthToken = await this.getFirebaseAuthToken();
        if (!firebaseAuthToken)
            throw new Error('[syncTransaction] You need to be authenticated to reset a workspace');

        if (!this.currentWorkspace)
            throw new Error('[syncTransaction] The workspace needs to be set to synchronize blocks');
        
        return await axios.post(`${this.apiRoot}/api/transactions`, {
            firebaseAuthToken,
            data: {
                block: block,
                transaction: transaction,
                transactionReceipt: transactionReceipt,
                workspace: this.currentWorkspace.name
            }
        });
    }

    async syncTrace(transactionHash: string, trace: TraceStep[]) {
        if (!transactionHash || !trace)
            throw new Error('[syncTrace] Missing parameter');

        const firebaseAuthToken = await this.getFirebaseAuthToken();
        if (!firebaseAuthToken)
            throw new Error('[syncTrace] You need to be authenticated to reset a workspace');

        if (!this.currentWorkspace)
            throw new Error('[syncTrace] The workspace needs to be set to synchronize blocks');
    
        return await axios.post(`${this.apiRoot}/api/transactions/${transactionHash}/trace`, {
            firebaseAuthToken,
            data: {
                txHash: transactionHash,
                steps: trace,
                workspace: this.currentWorkspace.name
            }
        });
    }

    async syncContractData(name: string, address: string, abi: any[] | null, hashedBytecode: string | undefined) {
        if (!name || !address)
            throw new Error('[syncContractData] Missing parameter');

        const firebaseAuthToken = await this.getFirebaseAuthToken();
        if (!firebaseAuthToken)
            throw new Error('[syncContractData] You need to be authenticated to reset a workspace');

        if (!this.currentWorkspace)
            throw new Error('[syncContractData] The workspace needs to be set to synchronize blocks');

        return await axios.post(`${this.apiRoot}/api/contracts/${address}`, {
            firebaseAuthToken,
            data: {
                name: name,
                address: address,
                abi: abi,
                hashedBytecode: hashedBytecode, 
                workspace: this.currentWorkspace.name
            }
        });
    }

    syncContractArtifact(address: string, artifact: any) {
        if (!address || !artifact)
            throw new Error('[syncContractArtifact] Missing parameter');

        if (!this.currentWorkspace)
            throw new Error('[syncContractArtifact] The workspace needs to be set to synchronize blocks');

        return httpsCallable(functions, 'syncContractArtifact')({
            workspace: this.currentWorkspace.name,
            address: address,
            artifact: artifact
        });
    }

    syncContractDependencies(address: string, dependencies: any) {
        if (!address || !dependencies)
            throw new Error('[syncContractDependencies] Missing parameter');

        if (!this.currentWorkspace)
            throw new Error('[syncContractDependencies] The workspace needs to be set to synchronize blocks');

        return httpsCallable(functions, 'syncContractDependencies')({
            workspace: this.currentWorkspace.name,
            address: address,
            dependencies: dependencies
        });
    }
}
