# Hardhat plugin for Ethernal

[Ethernal](https://www.tryethernal.com) is a block explorer for EVM-based chains. You can use it with your local chains (the Hardhat network for example), or for chains deployed on remote servers.

It allows you to interact with contracts by automatically generating an UI for all read/write methods. You can also read contract variables in any blocks.

To use Ethernal, you need to synchronize blocks, transactions & artifacts with the dashboard. This plugin allows you to easily do that instead of having to run the CLI separately.

If you are looking for more detailed doc about Ethernal: https://doc.tryethernal.com

## Installation

Add ```hardhat-ethernal``` to your ```package.json```, and run ```npm install``` or ```yarn```


In your ```hardhat-config.js```file, require the plugin:
```js
require('hardhat-ethernal');
````

To authenticate, you need to set `ETHERNAL_API_TOKEN` in your env variables. You can find the token by logging in at https://app.tryethernal.com > Settings > Account
You can also set them in the config object:
```js
module.exports = {
    ethernal: {
        apiToken: process.env.ETHERNAL_API_TOKEN
    }
};
```

## Synchronize blocks & transactions

Once you've installed the plugin and authenticated, the plugin will automatically sync blocks and transactions going through your node.
By default, it will synchronize to the latest workspace you've used in the dashboard. See next section to learn how to set the workspace manually.

## Options

All options need to be under the optional `ethernal` key in the Hardhat config object, default values are shown below:
```js
module.exports = {
    ethernal: {
        disableSync: false, // If set to true, plugin will not sync blocks & txs
        disableTrace: false, // If set to true, plugin won't trace transaction
        workspace: undefined, // Set the workspace to use, will default to the default workspace (latest one used in the dashboard). It is also possible to set it through the ETHERNAL_WORKSPACE env variable
        uploadAst: false, // If set to true, plugin will upload AST, and you'll be able to use the storage feature (longer sync time though)
        disabled: false, // If set to true, the plugin will be disabled, nohting will be synced, ethernal.push won't do anything either
        resetOnStart: undefined, // Pass a workspace name to reset it automatically when restarting the node, note that if the workspace doesn't exist it won't error
        serverSync: false, // Only available on public explorer plans - If set to true, blocks & txs will be synced by the server. For this to work, your chain needs to be accessible from the internet. Also, trace won't be synced for now when this is enabled.
        skipFirstBlock: false, // If set to true, the first block will be skipped. This is mostly useful to avoid having the first block synced with its tx when starting a mainnet fork
        verbose: false // If set to true, will display this config object on start and the full error object
    }
};
```

## Synchronize artifacts

In your deploy script, first require the plugin:
```js
const ethernal = require('hardhat-ethernal');
```
Then, push your artifacts to Ethernal, after deploying your contract:

/!\ The name parameter needs to match the name of the contract
```js
const Greeter = await hre.ethers.getContractFactory("Greeter");
const greeter = await Greeter.deploy("Hello, Hardhat!");
await hre.ethernal.push({
    name: 'Greeter',
    address: greeter.address,
    workspace: 'hardhat' // Optional, will override the workspace set in hardhat.config for this call only
});
```

By default, the push function is not going to upload AST to Ethernal. If you want to use "Storage" tab on contracts pages, you'll need to activate it. To do so, set the ```hre.ethernalUploadAst = true``` flag in your Hardhat config file (this will upload the ast field, as well as the source field).

## Reset a workspace programmatically

You can reset a workspace programmatically by calling: `hre.ethernal.resetWorkspace(workspaceName)` (async function). All accounts/blocks/transactions/contracts will be deleted.
