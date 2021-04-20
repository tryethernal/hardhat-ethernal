import * as fs from "fs-extra";
import { sep } from "path";
import { HardhatRuntimeEnvironment, ResolvedFile, Artifacts } from "hardhat/types";
import { ContractInput, EthernalContract, Artifact, SyncedBlock } from './types';
import { BlockWithTransactions, TransactionResponse, TransactionReceipt } from '@ethersproject/abstract-provider';

const path = require('path');
const credentials = require('./credentials');
const firebase = require('./firebase');

var logger = (message: string) => {
    console.log(`[Ethernal] ${message}`);
}

export class Ethernal {
    public env: HardhatRuntimeEnvironment;
    private targetContract!: ContractInput;
    private db: any;

    constructor(hre: HardhatRuntimeEnvironment) {
        this.env = hre;
        this.db = new firebase.DB();
    }

    public async startListening() {
        await this.setLocalEnvironment();
        if (!this.db.userId) { return; }

        this.env.ethers.provider.on('block', (blockNumber: number, error: any) => this.onData(blockNumber, error));
        this.env.ethers.provider.on('error', (error: any) => this.onError(error));
        this.env.ethers.provider.on('pending', () => this.onPending());
    }

    public async push(targetContract: ContractInput) {
        await this.setLocalEnvironment(); 
        if (!this.db.userId) { return; }

        this.targetContract = targetContract;
        if (!this.targetContract.name || !this.targetContract.address) {
            return logger('Contract name and address are mandatory');
        }
        
        const ethernalContract = await this.getFormattedArtifact(targetContract);

        if (!ethernalContract) {
            return;
        }
        
        var storeArtifactRes = await this.db.contractStorage(`${ethernalContract.address}/artifact`).set(ethernalContract.artifact);
        if (storeArtifactRes) {
            logger(storeArtifactRes);
            return;
        }
        var storeDependenciesRes = await this.db.contractStorage(`${ethernalContract.address}/dependencies`).set(ethernalContract.dependencies);
        if (storeDependenciesRes) {
            logger(storeDependenciesRes);
            return;
        }
        const res = await this.db.collection('contracts')
            .doc(ethernalContract.address)
            .set({
                name: ethernalContract.name,
                address: ethernalContract.address,
                abi: ethernalContract.abi
            }, { merge: true })
        if (res) {
            logger(res);
            return;
        }
        logger(`Updated artifacts for contract ${ethernalContract.name} (${ethernalContract.address}), with dependencies: ${Object.keys(ethernalContract.dependencies)}`);
    }

    private onData(blockNumber: number, error: any) {
        if (error && error.reason) {
            return logger(`Error while receiving data: ${error.reason}`);
        }
        this.env.ethers.provider.getBlockWithTransactions(blockNumber).then((block: BlockWithTransactions) => this.syncBlock(block));
    }

    private onError(error: any) {
        if (error && error.reason) {
            logger(`Could not connect to ${this.env.ethers.provider}. Error: ${error.reason}`);
        }
        else {
            logger(`Could not connect to ${this.env.ethers.provider}.`);
        }
    }

    private async setLocalEnvironment() {
        if (this.db.userId) { return; }
        const user = await this.login();
        if (!user) { return; }
        await this.setWorkspace();
        if (!this.db.workspace) {
            return logger(`Error while setting the workspace. Workspace data: ${this.db.workspace}`);
        }
    }

    private onPending() {
        //TODO: to implement
    }

    private syncBlock(block: BlockWithTransactions) {
        const promises = [];
        if (block) {
            promises.push(firebase.functions.httpsCallable('syncBlock')({ block: block, workspace: this.db.workspace.name }).then(({ data }: { data: any }) => console.log(`Synced block #${data.blockNumber}`)));
            block.transactions.forEach((transaction: TransactionResponse) => {
                this.env.ethers.provider.getTransactionReceipt(transaction.hash).then((receipt: TransactionReceipt) => promises.push(this.syncTransaction(block, transaction, receipt)));
            });
        }
        return Promise.all(promises);
    }

    private stringifyBns(obj: any) {
        var res: any = {}
        for (const key in obj) {
            if (this.env.ethers.BigNumber.isBigNumber(obj[key])) {
                res[key] = obj[key].toString();
            }
            else {
                res[key] = obj[key];
            }
        }
        return res;
    }
    
    private syncTransaction(block: BlockWithTransactions, transaction: TransactionResponse, transactionReceipt: TransactionReceipt) {
        return firebase.functions.httpsCallable('syncTransaction')({
            block: block,
            transaction: transaction,
            transactionReceipt: transactionReceipt,
            workspace: this.db.workspace.name
        }).then(({ data }: { data: any }) => console.log(`Synced transaction ${data.txHash}`));
    }

    private async getDefaultWorkspace() {
        var currentUser = await this.db.currentUser().get();
        var defaultWorkspace = await currentUser.data().currentWorkspace.get();
        return { ...defaultWorkspace.data(), name: defaultWorkspace.id };
    }

    private async setWorkspace() {
        let workspace: any = {};
        if (this.env.ethernalWorkspace) {
            workspace = await this.db.getWorkspace(this.env.ethernalWorkspace);
            if (!workspace) {
                workspace = await this.getDefaultWorkspace();
                logger(`Could not find workspace "${this.env.ethernalWorkspace}", defaulting to ${workspace.name}`);
            }
            else {
                logger(`Using workspace "${workspace.name}"`);
            }
        }
        else {
            this.db.currentWorkspace = await this.getDefaultWorkspace();
            logger(`Using default workspace "${this.db.currentWorkspace.name}"`);
        }
        this.db.workspace = workspace;
    }

    private async login() {
        try {
            var email = await credentials.getEmail();
            if (!email) {
                return logger('You are not logged in, please run "ethernal login".')
            }
            else {
                var password = await credentials.getPassword(email);
                if (!password) {
                    return logger('You are not logged in, please run "ethernal login".')
                }    
            }

            const user = (await firebase.auth().signInWithEmailAndPassword(email, password)).user;
            logger(`Logged in with ${user.email}`);
            return user;
        }
        catch(_error) {
            logger('Error while retrieving your credentials, please run "ethernal login"');
        }
    }

    private async getFormattedArtifact(targetContract: ContractInput) {
        const fullyQualifiedNames = await this.env.artifacts.getAllFullyQualifiedNames();
        var defaultBuildInfo = {
            output: {
                contracts: {},
                sources: {}
            }
        };
        let res:EthernalContract = {
            name: '',
            address: '',
            abi: {},
            artifact: '',
            dependencies: {}
        }

        for (var i = 0; i < fullyQualifiedNames.length; i++) {
            var buildInfo = await this.env.artifacts.getBuildInfo(fullyQualifiedNames[i]);
            if (!buildInfo) {
                continue;
            }
            var buildInfoContracts = buildInfo.output.contracts;
            var buildInfoOutputSources = buildInfo.output.sources;
            var buildInfoInputSources = buildInfo.input.sources;
            for (var contractFile in buildInfoContracts) {
                for (var contractName in buildInfoContracts[contractFile]) {
                    var artifact = JSON.stringify({
                        contractName: contractName,
                        abi: buildInfoContracts[contractFile][contractName].abi,
                        ast: buildInfoOutputSources[contractFile].ast,
                        source: buildInfoInputSources[contractFile].content
                    });
                    if (contractName == targetContract.name) {
                        res.abi = buildInfoContracts[contractFile][contractName].abi;
                        res.name = contractName;
                        res.artifact = artifact;
                        res.address = targetContract.address;
                    }
                    else {
                        res.dependencies[contractName] = artifact;
                    }
                }
            }
        }
        return res;
    }

    private sanitize(obj: TransactionResponse | TransactionReceipt | BlockWithTransactions) {
        var res: any = {};
        res = Object.fromEntries(
            Object.entries(obj)
                .filter(([_, v]) => v != null)
            );
        return res;
    }
}
