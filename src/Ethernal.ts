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

    private async onData(blockNumber: number, error: any) {
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
        var sBlock: BlockWithTransactions = this.sanitize(block);
        var syncedBlock: SyncedBlock = {
            hash: sBlock.hash,
            parentHash: sBlock.parentHash,
            number: sBlock.number,
            timestamp: String(sBlock.timestamp),
            nonce: sBlock.nonce,
            difficulty: String(sBlock.difficulty),
            gasLimit: sBlock.gasLimit.toString(),
            gasUsed: sBlock.gasUsed.toString(),
            miner: sBlock.miner,
            extraData: sBlock.extraData
        };

        this.db.collection('blocks').doc(sBlock.number.toString()).set(syncedBlock).then(() => logger(`Synced block ${sBlock.number}`));

        sBlock.transactions.forEach((transaction: TransactionResponse) => {
            this.env.ethers.provider.getTransactionReceipt(transaction.hash).then((receipt: TransactionReceipt) => this.syncTransaction(syncedBlock, transaction, receipt));
        });
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
    
    private async syncTransaction(block: SyncedBlock, transaction: TransactionResponse, transactionReceipt: TransactionReceipt) {
        var stransactionReceipt: TransactionReceipt = this.stringifyBns(this.sanitize(transactionReceipt));
        var sTransaction: TransactionResponse = this.stringifyBns(this.sanitize(transaction));
        var txSynced = {
           ...sTransaction,
           functionSignature: '',
            receipt: {
                ...stransactionReceipt
            },
            timestamp: block.timestamp
        }

        if (transaction.to && transaction.data && transaction.value) {
            txSynced.functionSignature = await this.getFunctionSignatureForTransaction(sTransaction);    
        }
        
        this.db.collection('transactions')
            .doc(sTransaction.hash)
            .set(txSynced)
            .then(() => logger(`Synced transaction ${sTransaction.hash}`));

        if (!txSynced.to) {
            this.db.collection('contracts')
                .doc(transactionReceipt.contractAddress)
                .set({ address: transactionReceipt.contractAddress })
                .then(() => logger(`Synced new contract at ${transactionReceipt.contractAddress}`));
        }
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

    private async getFunctionSignatureForTransaction(transaction: TransactionResponse) {
        var doc = await this.db.collection('contracts').doc(transaction.to).get();

        if (!doc || !doc.exists) {
            return '';
        }

        var abi = doc.data().abi;

        if (!abi) {
            return '';
        }

        var jsonInterface = new this.env.ethers.utils.Interface(abi);

        var parsedTransactionData = jsonInterface.parseTransaction({ data: transaction.data, value: transaction.value });
        var fragment = parsedTransactionData.functionFragment;

        return `${fragment.name}(` + fragment.inputs.map((input: any) => `${input.type} ${input.name}`).join(', ') + ')'
    }
}
