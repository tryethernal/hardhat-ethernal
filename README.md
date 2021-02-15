# Hardhat plugin for Ethernal

_Synchronize your Hardhat artifacts with Ethernal_

## Installation

Add ```hardhat-ethernal``` to your ```package.json```, and run ```npm install``` or ```yarn```

## Usage

In your deploy script, first require the plugin:
```js
const ethernal = require('hardhat-ethernal');
```
Push your artifacts to Ethernal, after deploying your contract:
```js
const Greeter = await hre.ethers.getContractFactory("Greeter");
const greeter = await Greeter.deploy("Hello, Hardhat!");
await hre.ethernal.push({
    name: 'Greeter',
    address: greeter.address
});
```
