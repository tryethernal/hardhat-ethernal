import * as fs from "fs-extra";
import { sep } from "path";
import { HardhatRuntimeEnvironment, ResolvedFile, Artifacts } from "hardhat/types";
import { ContractInput, EthernalContract, Artifact } from './types';
const path = require('path');
const credentials = require('./credentials');
const firebase = require('./firebase');

export class Ethernal {
    public env: HardhatRuntimeEnvironment;
    private targetContract!: ContractInput;
    private db: any;

    constructor(hre: HardhatRuntimeEnvironment) {
        this.env = hre;
        this.db = new firebase.DB();
    }

    public async push(targetContract: ContractInput) {
        this.targetContract = targetContract;
        if (!this.targetContract.name || !this.targetContract.address) {
            return console.log('Contract name and address are mandatory');
        }
        const user = await this.login();
        if (!user) {
            return console.log('You are not logged in, please run "ethernal login".')
        }
        await this.setWorkspace();

        const ethernalContract = await this.getFormattedArtifact(targetContract);

        if (!ethernalContract) {
            return;
        }
        
        var storeArtifactRes = await this.db.contractStorage(`${ethernalContract.address}/artifact`).set(ethernalContract.artifact);
        if (storeArtifactRes) {
            console.log(storeArtifactRes);
            return;
        }
        var storeDependenciesRes = await this.db.contractStorage(`${ethernalContract.address}/dependencies`).set(ethernalContract.dependencies);
        if (storeDependenciesRes) {
            console.log(storeDependenciesRes);
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
            console.log(res);
            return;
        }
        console.log(`Updated artifacts for contract ${ethernalContract.name} (${ethernalContract.address}), with dependencies: ${Object.keys(ethernalContract.dependencies)}`);
    }

    private async getDefaultWorkspace() {
        var workspaces = await this.db.workspaces();
        var defaultWorkspace = await this.db.getWorkspace(workspaces[0]);
        return defaultWorkspace;
    }

    private async setWorkspace() {
        if (this.targetContract.workspace) {
            var currentWorkspace = await this.db.getWorkspace(this.targetContract.workspace);
            if (!currentWorkspace) {
                currentWorkspace = await this.getDefaultWorkspace();
                console.log(`Could not find workspace "${this.targetContract.workspace}", defaulting to ${currentWorkspace.name}`);
            }
        }
        else {
            currentWorkspace = await this.getDefaultWorkspace();
        }
        this.db.workspace = currentWorkspace;
    }

    private async login() {
        try {
            var email = await credentials.getEmail();
            if (!email) {
                return console.log('You are not logged in, please run "ethernal login".')
            }
            else {
                var password = await credentials.getPassword(email);
                if (!password) {
                    return console.log('You are not logged in, please run "ethernal login".')
                }    
            }

            return (await firebase.auth().signInWithEmailAndPassword(email, password)).user;
        }
        catch(_error) {
            console.log('Error while retrieving your credentials, please run "ethernal login"');
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
}
