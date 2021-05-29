# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.3] - 2021-05-29
### Added
- Build system: when a new version is merged on master, a Github Action is going to build the plugin, create a release, and publish to NPM

### Changed
- Firebase config can now be set through environment variables. This makes it easier to connect to a custom Firebase backend (better ux for self hosted deployments).
