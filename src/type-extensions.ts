// If your plugin extends types from another plugin, you should import the plugin here.

// To extend one of Hardhat's types, you need to import the module where it has been defined, and redeclare it.
import "hardhat/types/config";
import "hardhat/types/runtime";

import { ContractInput, EthernalConfig } from './types';

declare module "hardhat/types/runtime" {
  export interface HardhatRuntimeEnvironment {
    ethernal: {
        startListening:() => Promise<void>;
        push: (contract: ContractInput) => Promise<void>;
        resetWorkspace: (workspace: string) => Promise<void>;
    }
  }
}

declare module "hardhat/types/config" {
  export interface HardhatUserConfig {
    ethernal?: EthernalConfig;
  }
  export interface HardhatConfig {
    ethernal: EthernalConfig;
  }
}