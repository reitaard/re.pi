# Phase 4A — target contract and unchanged local route

Status: implemented on `phase-4a-target-routing`; Windows acceptance pending.

## Purpose

Phase 4A creates the smallest honest routing seam in the main RePi orchestrator without implementing remote-node transport or sandbox execution.

The browser package remains one deterministic registered tool inside the coding-agent process. The orchestrator owns the outer execution target envelope and removes it before forwarding the unchanged inner `RpcCommand`.

```text
Aizen / client
  -> orchestrator RPC envelope { target?, command }
     -> target validation and authorization
        -> current local coding-agent RPC child
           -> unchanged registered browser tool
```

## Target envelope

```ts
type OrchestratorExecutionTarget =
  | { kind: "local" }
  | { kind: "node"; nodeId: string }
  | { kind: "sandbox" };
```

Rules:

- omitted target resolves to local and preserves pre-Phase-4 behavior;
- explicit `{ kind: "local" }` uses the same local callback;
- node ids are bounded to 128 credential-free identifier characters;
- exact-key validation rejects endpoints, tokens, scheduler policy, image names, and other routing-only data not defined by the envelope;
- `node` and `sandbox` parse successfully but fail with `target_not_authorized` in Phase 4A before any instance lookup, RPC forwarding, tool execution, or browser launch;
- the local callback receives no target argument, preventing orchestration metadata from entering `RpcCommand` or browser tool input.

## Integration boundary

The target field is optional only on:

- `RpcRequest`;
- `RpcStreamRequest`.

The initial stream handshake authorizes the target for the lifetime of the stream. Stream messages remain the existing `RpcCommand | RpcExtensionUIResponse` contract.

Spawn, list, status, and stop requests are unchanged.

## Explicit non-goals

Phase 4A does not:

- discover or select nodes;
- authorize remote users or sessions;
- add network transport;
- create sandboxes;
- migrate tabs, profiles, or snapshot refs;
- add target fields to the browser tool schema;
- expose loopback browser-control tokens;
- create a second browser runtime.

## Acceptance gate

Run from the main `re.pi` repository on Windows:

```bash
npm --prefix packages/orchestrator test
npm --prefix packages/orchestrator run build
npm run check
```

The target-routing tests must prove:

1. omitted target invokes the current local route exactly once;
2. explicit local forwards the unchanged inner command;
3. node and sandbox fail before local execution;
4. malformed, secret-bearing, endpoint, and scheduler-only fields fail closed;
5. node identifiers are bounded and credential-free.

Phase 4B node capability discovery and selection must not begin until this exact-head gate passes.
