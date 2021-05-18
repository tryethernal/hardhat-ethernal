// If your plugin extends types from another plugin, you should import the plugin here.

// To extend one of Hardhat's types, you need to import the module where it has been defined, and redeclare it.
import "hardhat/types/config";
import "hardhat/types/runtime";

import { Ethernal } from "./Ethernal";
import { ContractInput } from './types';
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { MessageTraceStep } from "hardhat/internal/hardhat-network/stack-traces/message-trace";

declare module "hardhat/types/config" {
  // This is an example of an extension to one of the Hardhat config values.

  // We extendr the UserConfig type, which represents the config as writen
  // by the users. Things are normally optional here.
  export interface ProjectPathsUserConfig {
    newPath?: string;
  }

  // We also extend the Config type, which represents the configuration
  // after it has been resolved. This is the type used during the execution
  // of tasks, tests and scripts.
  // Normally, you don't want things to be optional here. As you can apply
  // default values using the extendConfig function.
  export interface ProjectPathsConfig {
    newPath: string;
  }
}

declare module "hardhat/types/runtime" {
  // This is an example of an extension to the Hardhat Runtime Environment.
  // This new field will be available in tasks' actions, scripts, and tests.
  export interface HardhatRuntimeEnvironment {
    ethers: any;
    ethernalSync: boolean;
    ethernalTrace: boolean;
    ethernalWorkspace: string;
    ethernal: {
        startListening:() => Promise<void>;
        traceHandler:(trace: MessageTraceStep, isMessageTraceFromACall: Boolean) => Promise<void>;
        push: (contract: ContractInput) => Promise<void>;
    }
  }
}
