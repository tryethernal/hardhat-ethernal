# Hardhat plugin for Ethernal

Synchronize your Hardhat artifacts with [Ethernal](https://www.tryethernal.com)

If you are looking for more detailed doc about Ethernal: https://doc.tryethernal.com

## Installation

Add ```hardhat-ethernal``` to your ```package.json```, and run ```npm install``` or ```yarn```

## Usage

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
