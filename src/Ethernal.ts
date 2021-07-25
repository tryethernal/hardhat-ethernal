import * as fs from "fs-extra";
import { sep } from "path";
import { HardhatRuntimeEnvironment, ResolvedFile, Artifacts } from "hardhat/types";
import { ContractInput, EthernalContract, Artifact, SyncedBlock } from './types';
import { BlockWithTransactions, TransactionResponse, TransactionReceipt } from '@ethersproject/abstract-provider';
import { MessageTraceStep, isCreateTrace, isCallTrace, CreateMessageTrace, CallMessageTrace, isEvmStep, isPrecompileTrace } from "hardhat/internal/hardhat-network/stack-traces/message-trace";

const path = require('path');
const credentials = require('./credentials');
const firebase = require('./firebase');

var logger = (message: any) => {
    console.log(`[Ethernal] `, message);
}

export class Ethernal {
    public env: HardhatRuntimeEnvironment;
    private targetContract!: ContractInput;
    private db: any;
    private trace: any[];

    constructor(hre: HardhatRuntimeEnvironment) {
        this.env = hre;
        this.db = new firebase.DB();
        this.trace = [];
    }

    public async startListening() {
        const envSet = await this.setLocalEnvironment();
        if (!envSet) { return; }

        this.env.ethers.provider.on('block', (blockNumber: number, error: any) => this.onData(blockNumber, error));
        this.env.ethers.provider.on('error', (error: any) => this.onError(error));
        this.env.ethers.provider.on('pending', () => this.onPending());
    }

    public async push(targetContract: ContractInput) {
        const envSet = await this.setLocalEnvironment();
        if (!envSet) { return; }

        this.targetContract = targetContract;
        if (!this.targetContract.name || !this.targetContract.address) {
            return logger('Contract name and address are mandatory');
        }
        
        const contract = await this.getFormattedArtifact(targetContract);

        if (!contract) {
            return;
        }
        
        var storeArtifactRes = await firebase.functions.httpsCallable('syncContractArtifact')({
            workspace: this.db.workspace.name,
            address: contract.address,
            artifact: contract.artifact
        });
        if (!storeArtifactRes.data) {
            return logger(storeArtifactRes);
        }

        const dependenciesPromises = [];
        for (const dep in contract.dependencies)
            dependenciesPromises.push(
                    firebase.functions.httpsCallable('syncContractDependencies')({
                        workspace: this.db.workspace.name,
                        address: contract.address,
                        dependencies: { [dep]: contract.dependencies[dep] }
                    })
            );
        
        await Promise.all(dependenciesPromises);

        var contractSyncRes = await firebase.functions.httpsCallable('syncContractData')({
            workspace: this.db.workspace.name,
            name: contract.name,
            address: contract.address,
            abi: contract.abi
        });
        if (!contractSyncRes.data) {
            return logger(contractSyncRes);
        }

        const dependencies = Object.entries(contract.dependencies).map(art => art[0]);
        const dependenciesString = dependencies.length ? ` Dependencies: ${dependencies.join(', ')}` : '';
        logger(`Updated artifacts for contract ${contract.name} (${contract.address}).${dependenciesString}`);
    }

    public async traceHandler(trace: MessageTraceStep, isMessageTraceFromACall: Boolean) {
        if (!this.db.userId) { return; }
        if (this.db.workspace.advancedOptions?.tracing != 'hardhat') return;

        logger('Tracing transaction...');
        let stepper = async (step: MessageTraceStep) => {
            if (isEvmStep(step) || isPrecompileTrace(step))
                return;
            if (isCreateTrace(step) && step.deployedContract) {
                const address = `0x${step.deployedContract.toString('hex')}`;
                const bytecode = await this.env.ethers.provider.getCode(address);
                this.trace.push({
                    op: 'CREATE2',
                    contractHashedBytecode: this.env.ethers.utils.keccak256(bytecode),
                    address: address,
                    depth: step.depth
                });
            }
            if (isCallTrace(step)) {
                const address = `0x${step.address.toString('hex')}`;
                const bytecode = await this.env.ethers.provider.getCode(address);
                this.trace.push({
                    op: 'CALL',
                    contractHashedBytecode: this.env.ethers.utils.keccak256(bytecode),
                    address: address,
                    input: step.calldata.toString('hex'),
                    depth: step.depth
                });
            }
            for (var i = 0; i < step.steps.length; i++) {
                await stepper(step.steps[i]);
            }
        };

        if (this.trace) {
            this.trace = [];
            if (!isEvmStep(trace) && !isPrecompileTrace(trace)) {
                for (const step of trace.steps) {
                    stepper(step);
                }
            }
        }
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
        if (this.db.userId) { return false; }
        const user = await this.login();
        if (!user) { return false; }
        await this.setWorkspace();
        if (!this.db.workspace)
            return false;
        return true;
    }

    private onPending() {
        //TODO: to implement
    }

    private syncBlock(block: BlockWithTransactions) {
        const promises = [];
        if (block) {
            promises.push(firebase.functions.httpsCallable('syncBlock')({ block: block, workspace: this.db.workspace.name }).then(({ data }: { data: any }) => logger(`Synced block #${data.blockNumber}`)));
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
        })
        .then(({ data }: { data: any }) => {
            if (this.trace && this.trace.length) {
                firebase.functions.httpsCallable('syncTrace')({
                    workspace: this.db.workspace.name,
                    txHash: transaction.hash,
                    steps: this.trace
                })
                .catch(logger)
                .finally(() => this.trace = []);
            }
        });
    }

    private async getDefaultWorkspace() {
        var currentUser = await this.db.currentUser().get();
        var data = await currentUser.data();
        if (!data.currentWorkspace) {
            throw new Error('Please create a workspace first on https://app.tryethernal.com.');
        }
        
        var defaultWorkspace = await data.currentWorkspace.get();
        return { ...defaultWorkspace.data(), name: defaultWorkspace.id };
    }

    private async setWorkspace() {
        try {
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
                workspace = await this.getDefaultWorkspace();
                logger(`Using default workspace "${workspace.name}"`);
            }
            this.db.workspace = workspace;
        } catch(error) {
            logger(error.message || 'Error while setting the workspace.');
        }
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
            logger(_error);
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
