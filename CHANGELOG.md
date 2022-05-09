# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
Updated README

## [v1.0.0] - 2022-05-09
### Changed
- All options are now going through an `ethernal` object on Hardhat config. See README for details

### Removed
- Local keychain is no longer used, only way to login are using env variables or config object.
- Keytar & configstore have been removed

## [v0.8.1] - 2022-05-07
### Fixed
- Bug with global flag on `ethernal.push`

## [v0.8.0] - 2022-05-07
### Added
- `disableEthernal` flag on Hardhat config object. When set to true, Nothing will be synced, `ethernal.push` won't do anything either.

## [v0.7.1] - 2022-04-12
### Changed
- Start syncing transactions when the block has been synced. If block syncing fails, tx won't be synced.

## [v0.7.0] - 2022-03-27
### Changed
- AST upload is now disabled by default. To enable it `hre.ethernalUploadAst` needs to be set to true in hardhat.config.js.

## [v0.6.0] - 2022-03-24
### Fixed
- Dependencies

## [v0.5.1] - 2022-03-24
### Fixed
- Reorganized dependencies to fix conflicts with hardhat-deploy

## [v0.5.0] - 2022-02-15
### Added
- Set `hre.ethernalResetOnStart = 'workspaceName'` in your Hardhat config file to automatically reset this workspace when the node starts.
- Function `hre.ethernal.resetWorkspace(workspaceName)` to manually reset a workspace

## [v0.4.1] - 2022-02-13
### Fixed
- package.json config

## [v0.4.0] - 2022-02-11
### Fixed
- Conflict with typechain
- Custom flagging to control tracing/syncing

### Removed
- A lot of boilerplate code & files

## [v0.3.13] - 2022-02-04
### Fixed
- Plugin was crashing if the traceHandler was called before the plugin was completely initialized

## [v0.3.12] - 2022-01-05
### Changed
- If dependencies fail to upload (often due to file size) when pushing artifacts, it won't make the whole thing fail. Contract abi/name will still be pushed. Only storage reading won't be available

## [v0.3.11] - 2021-12-21
### Added
- Return method result in transaction tracing.

## [v0.3.10] - 2021-08-22
### Fixed
- Bug that prevented calling the push functions multiple times in the same Ethernal instance.

## [v0.3.9] - 2021-08-22
### Fixed
- Conflict with ethersjs library in ethersjs package & hardhat-deploy.

## [v0.3.8] - 2021-07-25
### Fixed
- Fails gracefully when the plugin is called and no workspace has been created yet. Thanks @ShaunLWM for the PR!

## [v0.3.7] - 2021-07-22
### Added
- Allows logging in using ETHERNAL_EMAIL & ETHERNAL_PASSWORD env variables instead of configstore and keytar

## [v0.3.6] - 2021-06-02
### Changed
- Send dependencies one by one, to avoid Firebase payload limitation

## [v0.3.5] - 2021-05-29
### Fixed
- Changelog parsing when releasing new version

## [v0.3.4] - 2021-05-29
### Fixed
- Default Firebase variables

## [v0.3.3] - 2021-05-29
### Added
- Build system: when a new version is merged on master, a Github Action is going to build the plugin, create a release, and publish to NPM

### Changed
- Firebase config can now be set through environment variables. This makes it easier to connect to a custom Firebase backend (better ux for self hosted deployments).
