import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers, keccak256 } from 'ethers';
import { ContractInput, EthernalContract, EthernalConfig } from './types';
import { BlockWithTransactions, TransactionResponse, TransactionReceipt } from '@ethersproject/abstract-provider';
import { MessageTraceStep, isCreateTrace, isCallTrace, CreateMessageTrace, CallMessageTrace, isEvmStep, isPrecompileTrace } from "hardhat/internal/hardhat-network/stack-traces/message-trace";

import { Api } from './api';
const ETHERNAL_API_ROOT = process.env.ETHERNAL_API_ROOT || 'https://api.tryethernal.com';
const ETHERNAL_WEBAPP_ROOT = process.env.ETHERNAL_WEBAPP_ROOT || 'https://app.tryethernal.com';

const logger = (message: any) => {
    console.log(`[Ethernal] `, message);
}

const handleError = (baseMessage: string, error: any, verbose: Boolean) => {
    try {
        const errorMessage = error.response?.data || error?.message || `Can't find an error message. Try in verbose mode.`;
        logger(`${baseMessage}: ${errorMessage}`);
        if (verbose) console.log(error);
    } catch(_error: any) {
        logger(_error.message);
        if (verbose) console.log(_error);
    }
}

export class Ethernal {
    public env: HardhatRuntimeEnvironment;
    private targetContract!: ContractInput;
    private db: any;
    private syncNextBlock: Boolean;
    private api: any;
    private traces: any[];
    private verbose: Boolean;
    private provider: any;

    constructor(hre: HardhatRuntimeEnvironment) {
        this.env = hre;
        this.api = new Api(ETHERNAL_API_ROOT, ETHERNAL_WEBAPP_ROOT);
        this.syncNextBlock = false;
        this.traces = [];
        this.verbose = hre.config.ethernal.verbose || false;
        this.provider = hre.ethers.provider;

        if (this.verbose) {
            console.log('### Verbose mode activated - Showing Ethernal plugin config ###')
            console.log(this.env.config.ethernal);
            console.log('### End of config ###');
        }
    }

    public async startListening() {
        const envSet = await this.setLocalEnvironment();
        if (!envSet) { return; }

        this.provider.on('block', (blockNumber: number, error: any) => {
            if (!!this.env.config.ethernal.skipFirstBlock && !this.syncNextBlock){
                logger(`Skipping block ${blockNumber}`);
                this.syncNextBlock = true;
            }
            else {
                this.onData(blockNumber, error);
            }
        });
    }

    public async push(targetContract: ContractInput) {
        if (this.env.config.ethernal.disabled) { return; }

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

        try {
            await this.api.syncContractData(contract.name, contract.address, contract.abi, targetContract.workspace);
        } catch(error: any) {
            handleError('Error syncing contract data', error, this.verbose);
        }

        if (this.env.config.ethernal.uploadAst) {
            logger('Uploading ASTs, this might take a while depending on the size of your contracts.');
            try {
                await this.api.syncContractAst(contract.address, {
                    artifact: contract.artifact,
                    dependencies: contract.dependencies
                }, targetContract.workspace);
            } catch(error: any) {
                handleError(`Couldn't sync dependencies`, error, this.verbose);
            }
        }

        const dependencies = Object.entries(contract.dependencies).map(art => art[0]);
        const dependenciesString = dependencies.length ? ` Dependencies: ${dependencies.join(', ')}.` : '';
        const workspaceString = ` Workspace: ${targetContract.workspace || this.api.currentWorkspaceName}.`;
        logger(`Updated artifacts for contract ${contract.name} (${contract.address}).${dependenciesString}${workspaceString}`);
    }

    public async traceHandler(trace: MessageTraceStep, isMessageTraceFromACall: Boolean) {
        if (this.env.config.ethernal.disabled) return;
        if (this.env.config.ethernal.disableTrace) return;
        if (isMessageTraceFromACall) return;

        await this.setLocalEnvironment();
        const envSet = await this.setLocalEnvironment();
        if (!envSet) return;

        const parsedTrace: any = [];

        let stepper = async (step: MessageTraceStep) => {
            if (isEvmStep(step) || isPrecompileTrace(step))
                return;
            if (isCreateTrace(step) && step.deployedContract) {
                const address = `0x${step.deployedContract.toString('hex')}`;
                const bytecode = await this.provider.getCode(address);
                parsedTrace.push({
                    op: 'CREATE2',
                    contractHashedBytecode: keccak256(bytecode),
                    address: address,
                    depth: step.depth
                });
            }
            if (isCallTrace(step)) {
                const address = `0x${step.address.toString('hex')}`;
                const bytecode = await this.provider.getCode(address);
                parsedTrace.push({
                    op: 'CALL',
                    contractHashedBytecode: keccak256(bytecode),
                    address: address,
                    input: step.calldata.toString('hex'),
                    depth: step.depth,
                    returnData: step.returnData.toString('hex')
                });
            }

            for (var i = 0; i < step.steps.length; i++) {
                await stepper(step.steps[i]);
            }
        };

        if (!isEvmStep(trace) && !isPrecompileTrace(trace)) {
            for (const step of trace.steps) {
                await stepper(step);
            }
        }

        this.traces.push(parsedTrace)
    }

    public async resetWorkspace(workspace: string) {
        if (this.env.config.ethernal.disabled) { return; }
        const envSet = await this.setLocalEnvironment();
        if (!envSet) { return; }

        logger(`Resetting workspace "${workspace}"...`);

        try {
            await this.api.resetWorkspace(workspace);
            logger(`Workspace "${workspace}" has been reset!`);
        } catch(error: any) {
            handleError(`Error while resetting workspace "${workspace}"`, error, this.verbose);
        }
    }

    private async onData(blockNumber: number, error: any) {
        if (error && error.reason) {
            return logger(`Error while receiving data: ${error.reason}`);
        }
        if (this.env.config.ethernal.serverSync) {
            try {
                logger(`Syncing block #${blockNumber}...`);
                await this.api.syncBlock({ number: blockNumber }, true);
            } catch(error: any) {
                handleError(`Couldn't sync block #${blockNumber}`, error, this.verbose);
            }
        }
        else {
            try {
                const block = await this.provider.getBlock(blockNumber, true);
                await this.syncBlock(block);
            } catch(error: any) {
                handleError(`Couldn't sync block #${blockNumber}`, error, this.verbose);
            }
        }
    }

    private async setLocalEnvironment() {
        if (this.api.isLoggedIn && this.api.hasWorkspace)
            return true;

        if (!this.api.isLoggedIn) {
            const isLoggedIn = await this.login();
            if (!isLoggedIn)
                return false;
        }

        const isWorkspaceSet = await this.setWorkspace();
        if (!isWorkspaceSet)
            return false;

        return true;
    }

    private async syncBlock(block: BlockWithTransactions) {
        if (block) {
            const trace = this.traces.shift();
            try {
                await this.api.syncBlock(this.stringifyBns(block), false);
                logger(`Synced block #${block.number}`);
            }  catch(error: any) {
                handleError(`Couldn't sync block #${block.number}`, error, this.verbose);
            }
            for (let i = 0; i < block.transactions.length; i++) {
                const hash = block.transactions[i];
                const transaction = await this.provider.getTransaction(hash);

                try {
                    const receipt = await this.provider.getTransactionReceipt(transaction.hash);

                    if (!receipt)
                        logger(`Couldn't get receipt for transaction ${transaction.hash}`);
                    else {
                        const syncedTransaction = {
                            ...this.stringifyBns(this.sanitize(transaction)),
                            provider: null,
                            r: transaction.signature.r,
                            s: transaction.signature.s,
                            transactionIndex: transaction.index || transaction.transactionIndex
                        };

                        // We can't match a trace to a transaction, so we assume blocks with 1 transaction, and sync the trace only for the first one
                        await this.syncTransaction(block, syncedTransaction, this.stringifyBns(this.sanitize({ ...receipt, logs: receipt.logs, provider: null})), i == 0 ? trace : null);
                    }
                } catch(error: any) {
                    handleError(`Couldn't sync transaction ${transaction.hash}`, error, this.verbose);
                }
            }
        }
    }

    private async syncTransaction(block: BlockWithTransactions, transaction: TransactionResponse, transactionReceipt: TransactionReceipt, trace: any[] | null) {
        try {
            await this.api.syncTransaction(block, transaction, transactionReceipt);
            logger(`Synced transaction ${transaction.hash}`);
        } catch (error: any) {
            handleError(`Couldn't sync transaction ${transaction.hash}`, error, this.verbose);
        }
        if (trace && trace.length) {
            try {
                await this.api.syncTrace(transaction.hash, trace);
                logger(`Synced trace for transaction ${transaction.hash}`);
            } catch(error: any) {
                handleError(`Error while syncing trace for transaction ${transaction.hash}`, error, this.verbose);
            }
        }
    }

    private async setWorkspace() {
        try {
            const workspace = await this.api.setWorkspace(this.env.config.ethernal.workspace);
            logger(`Using workspace "${workspace.name}"`);

            return true;
        } catch(error: any) {
            handleError(`Error while setting the workspace`, error, this.verbose);
            return false;
        }
    }

    private async login() {
        try {
            if (this.env.config.ethernal.apiToken) {
                await this.api.setApiToken(this.env.config.ethernal.apiToken);
                logger(`Authenticated with API token.`)
            }
            else {
                let email, password;

                email = this.env.config.ethernal.email;

                if (!email) {
                    return logger(`Missing email to authenticate. Make sure you've either set ETHERNAL_EMAIL in your environment or they key 'email' in your Ethernal config object & restart the node.`);
                }
                else {
                    password = this.env.config.ethernal.password;
                    if (!password) {
                        return logger(`Missing password to authenticate. Make sure you've either set ETHERNAL_PASSWORD in your environment or they key 'password' in your Ethernal config object & restart the node.`);
                    }    
                }

                await this.api.login(email, password);
                logger(`Logged in with ${email}`);
            }

            return true;
        }
        catch(error: any) {
            handleError(`Login error`, error, this.verbose);
            return false;
        }
    }

    private async getFormattedArtifact(targetContract: ContractInput) {
        const fullyQualifiedNames: string[] = [];
        (await this.env.artifacts.getAllFullyQualifiedNames()).map(fqn => {
            if (fqn.split(':')[1] == targetContract.name)
                fullyQualifiedNames.push(fqn)
        });

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
                .filter(([k, v]) => v != null && k != 'provider')
            );
        return res;
    }

    private stringifyBns(obj: any) {
        var res: any = {}
        for (const key in obj) {
            if (typeof obj[key] == 'bigint') {
                res[key] = obj[key].toString();
            }
            else {
                res[key] = obj[key];
            }
        }
        return res;
    }
}
