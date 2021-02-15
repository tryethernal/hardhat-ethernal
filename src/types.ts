export type Artifact = {
    contractName: string;
    abi: any;
    ast: any;
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
