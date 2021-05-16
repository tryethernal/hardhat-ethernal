import path from 'path';

require("@nomiclabs/hardhat-ethers");
import { extendConfig, extendEnvironment, task, subtask, experimentalAddHardhatNetworkMessageTraceHook } from "hardhat/config";
import { lazyObject, HardhatPluginError } from "hardhat/plugins";
import { HardhatConfig, HardhatUserConfig, ActionType, RunTaskFunction, HardhatRuntimeEnvironment } from "hardhat/types";
import { MessageTraceStep, isCreateTrace, isCallTrace, CreateMessageTrace, CallMessageTrace, isEvmStep, isPrecompileTrace } from "hardhat/internal/hardhat-network/stack-traces/message-trace";
import { TASK_NODE_SERVER_READY } from "hardhat/builtin-tasks/task-names";

import { Ethernal } from "./Ethernal";
import { Artifact, ContractInput } from './types';
// This import is needed to let the TypeScript compiler know that it should include your type
// extensions in your npm package's types file.
import "./type-extensions";

export const PluginName = 'hardhat-ethernal';

subtask(TASK_NODE_SERVER_READY).setAction(async (args, hre, runSuper) => {
    if (hre.ethernalSync)
        hre.ethernal.startListening();
    else
        console.log('[Ethernal] Not syncing')
    await runSuper(args);
});

experimentalAddHardhatNetworkMessageTraceHook(async (hre, trace, isMessageTraceFromACall) => {
    console.log(trace)
    let stepper = async (step: MessageTraceStep) => {
        if (isEvmStep(step) || isPrecompileTrace(step))
            return;
        if (isCreateTrace(step) && step.deployedContract) {
            const address = `0x${step.deployedContract.toString('hex')}`;
            const bytecode = await hre.ethers.provider.getCode(address);
            hre.ethernalSteps.push({
                op: 'CREATE2',
                contractHashedBytecode: hre.ethers.utils.keccak256(bytecode),
                address: address,
                depth: step.depth
            });
        }
        if (isCallTrace(step)) {
            const address = `0x${step.address.toString('hex')}`;
            hre.ethernalSteps.push({
                op: 'CALL',
                address: address,
                input: step.calldata.toString('hex'),
                depth: step.depth
            });
        }
        for (var i = 0; i < step.steps.length; i++) {
            await stepper(step.steps[i]);
        }
    };

    if (hre.ethernalTrace) {
        hre.ethernalSteps = [];
        if (!isEvmStep(trace) && !isPrecompileTrace(trace)) {
            for (const step of trace.steps) {
                stepper(step);
            }
        }
    }
});

extendConfig(
  (config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
    // We apply our default config here. Any other kind of config resolution
    // or normalization should be placed here.
    //
    // `config` is the resolved config, which will be used during runtime and
    // you should modify.
    // `userConfig` is the config as provided by the user. You should not modify
    // it.
    //
    // If you extended the `HardhatConfig` type, you need to make sure that
    // executing this function ensures that the `config` object is in a valid
    // state for its type, including its extentions. For example, you may
    // need to apply a default value, like in this example.
    const userPath = userConfig.paths?.newPath;

    let newPath: string;
    if (userPath === undefined) {
      newPath = path.join(config.paths.root, "newPath");
    } else {
      if (path.isAbsolute(userPath)) {
        newPath = userPath;
      } else {
        // We resolve relative paths starting from the project's root.
        // Please keep this convention to avoid confusion.
        newPath = path.normalize(path.join(config.paths.root, userPath));
      }
    }

    config.paths.newPath = newPath;
  }
);

extendEnvironment((hre) => {
  // We add a field to the Hardhat Runtime Environment here.
  // We use lazyObject to avoid initializing things until they are actually
  // needed.
  hre.ethernalSync = hre.ethernalSync ? hre.ethernalSync : true;
  hre.ethernalTrace = hre.ethernalTrace ? hre.ethernalTrace : true;
  hre.ethernal = lazyObject(() => new Ethernal(hre));
});
