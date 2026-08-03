# @reitaard/repi-server

Experimental server-facing package for Recode.

This package is a facade over Recode Maestro (`@reitaard/repi-orchestrator`). It does not create a second process supervisor or own independent session lifecycles. Consumers use the exported Maestro IPC, lifecycle, dashboard, and service APIs.

The package may gain remote or multi-client transports after their authentication and authorization contracts are reviewed. Its API is not yet stable.
