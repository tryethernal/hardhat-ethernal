# Hardhat plugin for Ethernal

This plugin lets you synchronize blocks, transactions & artifacts with [Ethernal](https://www.tryethernal.com)

When using it, you don't need to use the CLI.

If you are looking for more detailed doc about Ethernal: https://doc.tryethernal.com

## Installation

Add ```hardhat-ethernal``` to your ```package.json```, and run ```npm install``` or ```yarn```

## Synchronize blocks & transactions

In your ```hardhat-config.js```file, require the plugin:
```js
require('hardhat-ethernal');
````

That's it! Blocks and transactions will now be synchronized.

### Options

It's possible to disable the synchronization by setting ```ethernalSync``` to ```false``` on the ```hre``` object.

You can also specify which workspace you want to synchronize blocks & transactions to (default to the last one used in the dashboard):
```js
extendEnvironment((hre) => {
    hre.ethernalSync = true;
    hre.ethernalWorkspace = 'Workspace';
});
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
    address: greeter.address
});
```
The following fields will be synchronized:
- contractName
- abi
- ast
- source
