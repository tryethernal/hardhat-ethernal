import '@nomiclabs/hardhat-ethers';
import { extendEnvironment, subtask, experimentalAddHardhatNetworkMessageTraceHook } from "hardhat/config";
import { lazyObject } from "hardhat/plugins";
import { TASK_NODE_SERVER_READY } from "hardhat/builtin-tasks/task-names";

import { Ethernal } from "./Ethernal";

import "./type-extensions";

subtask(TASK_NODE_SERVER_READY).setAction(async (args, hre, runSuper) => {
    if (!hre.config.disableEthernal) {
        if (hre.ethernalSync) {
            hre.ethernal.startListening();
        }
        else
            console.log('[Ethernal] Not syncing')
    }
    await runSuper(args);
});

experimentalAddHardhatNetworkMessageTraceHook(async (hre, trace, isMessageTraceFromACall) => {
    if (!hre.config.disableEthernal)
        hre.ethernal.traceHandler(trace, isMessageTraceFromACall);
});

extendEnvironment((hre) => {
  if (hre.config.disableEthernal) {
      console.log('[Ethernal] Ethernal is disabled.')
  }
  else {
      hre.ethernalSync = hre.ethernalSync !== undefined ? hre.ethernalSync : true;
      hre.ethernalTrace = hre.ethernalTrace !== undefined ? hre.ethernalTrace : true;
      hre.ethernal = lazyObject(() => new Ethernal(hre));
  }
});
