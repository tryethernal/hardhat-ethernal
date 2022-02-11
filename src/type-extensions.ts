// If your plugin extends types from another plugin, you should import the plugin here.

// To extend one of Hardhat's types, you need to import the module where it has been defined, and redeclare it.
import "hardhat/types/config";
import "hardhat/types/runtime";

import { ContractInput } from './types';
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { MessageTraceStep } from "hardhat/internal/hardhat-network/stack-traces/message-trace";

declare module "hardhat/types/runtime" {
  export interface HardhatRuntimeEnvironment {
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
