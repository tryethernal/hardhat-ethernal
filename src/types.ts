import { BlockWithTransactions } from '@ethersproject/abstract-provider';

export interface EthernalConfig {
    disableSync: boolean;
    disableTrace: boolean;
    workspace?: string;
    uploadAst: boolean;
    disabled: boolean;
    resetOnStart?: string;
    email?: string;
    password?: string;
    serverSync?: boolean;
}

export interface ContractInput {
    name: string;
    address: string;
    workspace?: string;
}

export type EthernalContract = {
    name: string;
    abi: any;
    address: string;
    artifact: string;
    dependencies: {
        [dependencyName: string]: string;
    };
}

export type Workspace = {
    id: number;
    name: string;
    chain: string;
    networkId: string;
    public: boolean;
    rpcServer: string;
    defaultAccount?: string;
    gasLimit?: string;
    gasPrice?: string;
    userId: number;
    apiEnabled: boolean;
    tracing?: string;
    alchemyIntegrationEnabled: boolean;
    isRemote?: boolean;
    createdAt: string;
    updatedAt: string;
}

export type User = {
    isPremium: boolean;
    id: number;
    firebaseUserId: string;
    email: string;
    apiKey: string;
    currentWorkspaceId: number;
    plan: string;
    stripeCustomerId: string;
    explorerSubscriptionId?: string;
    createdAt: string;
    updatedAt: string;
    workspaces: Workspace[]
}

export type SyncedBlock = {
    hash: string;
    parentHash: string;
    number: number;
    timestamp: string;
    nonce: string;
    difficulty: string;
    gasLimit: string;
    gasUsed: string;
    miner: string;
    extraData: string;
}

export type TraceStep = {
    op: string;
    contractHashedBytecode: string;
    address: string;
    input: string;
    depth: number;
    returnData?: string;
}
