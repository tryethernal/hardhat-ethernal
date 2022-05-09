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
    name: string;
    rpcServer: string;
    settings?: {
        defaultAccount?: string;
        gas?: string;
        gasPrice?: string;
    }
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
