# Changelog

## [Unreleased]

### Added

- Added Recode Maestro's versioned public lifecycle contract, bounded supervision service, and private worker/full-session adapters.
- Added validated atomic instance/machine manifests with bounded backup recovery, corruption diagnostics, process-start identity verification, and terminal retention.
- Added bounded RPC deadlines, command/instance cancellation results, prompt/request/session/subscriber limits, and verified graceful-to-forced shutdown outcomes.

### Fixed

- Resolved the coding-agent RPC entry through its ESM export so Node-based child startup works.
- Retained cancelled, failed, and recovered terminal instance records instead of deleting them during shutdown.
- Prevented timed-out requests, stale command IDs, stale attachments, hung children, and throwing observers from corrupting or indefinitely blocking Maestro lifecycle control.

## [0.81.4] - 2026-07-22

## [0.80.6] - 2026-07-09

## [0.80.5] - 2026-07-09

## [0.80.4] - 2026-07-09

## [0.80.3] - 2026-06-30
