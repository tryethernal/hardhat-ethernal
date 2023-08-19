import "@nomicfoundation/hardhat-ethers";
import { extendEnvironment, subtask, experimentalAddHardhatNetworkMessageTraceHook, extendConfig } from "hardhat/config";
import { HardhatConfig, HardhatUserConfig, HardhatRuntimeEnvironment } from "hardhat/types";
import { lazyObject } from "hardhat/plugins";
import { TASK_NODE_SERVER_READY } from "hardhat/builtin-tasks/task-names";

import { Ethernal } from "./Ethernal";

import "./type-extensions";

subtask(TASK_NODE_SERVER_READY).setAction(async (args, hre, runSuper) => {
    const ethernalConfig = hre.config.ethernal;
    if (ethernalConfig && !ethernalConfig.disabled) {
        if (!ethernalConfig.disableSync) {
            hre.ethernal.startListening();
        }
        else
            console.log('[Ethernal] Not syncing')
    }
    await runSuper(args);
});

experimentalAddHardhatNetworkMessageTraceHook(async (hre, trace, isMessageTraceFromACall) => {
    if (!hre.config.ethernal.disabled && !isMessageTraceFromACall)
        hre.ethernal.traceHandler(trace, isMessageTraceFromACall);
});

extendConfig(
    (config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
        config.ethernal = {
            disableSync: !!userConfig.ethernal?.disableSync,
            disableTrace: !!userConfig.ethernal?.disableTrace,
            workspace: userConfig.ethernal?.workspace || process.env.ETHERNAL_WORKSPACE,
            uploadAst: !!userConfig.ethernal?.uploadAst,
            disabled: !!userConfig.ethernal?.disabled,
            resetOnStart: userConfig.ethernal?.resetOnStart,
            email: userConfig.ethernal?.email || process.env.ETHERNAL_EMAIL,
            password: userConfig.ethernal?.password || process.env.ETHERNAL_PASSWORD,
            serverSync: !!userConfig.ethernal?.serverSync,
            apiToken: userConfig.ethernal?.apiToken || process.env.ETHERNAL_API_TOKEN,
            skipFirstBlock: !!userConfig.ethernal?.skipFirstBlock,
            verbose: !!userConfig.ethernal?.verbose
        };

        return config;
    }
);

extendEnvironment((hre: HardhatRuntimeEnvironment) => {
  if (hre.config.ethernal.disabled) {
      console.log('[Ethernal] Ethernal is disabled.')
  }
  hre.ethernal = lazyObject(() => new Ethernal(hre));
});
