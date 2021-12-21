# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
