# Changelog

All notable changes to this project will be documented in this file.

## [0.0.1] - 2026-02-28
### Added
- Initial core store implementation `createStore()`.
- Proxy auto-tracking for state mutations with eager wrapping for deep paths.
- Proper interception of arrays (`push`, `pop`, `splice`, index sets).
- Store subscription mechanism `subscribe()`.
- Added types: `StoreDefinition`, `Listener`, `Unsubscribe`, `Store`.
- Full test coverage for core store code (100% functions, 95%+ statements).
