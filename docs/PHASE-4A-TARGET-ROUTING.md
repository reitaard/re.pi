# Phase 4A — target contract and unchanged local route

Status: accepted and frozen at Windows-tested code head `8ef5f64fe735e406db2eeb1ef3cf4effc420d67d`.

The branch may contain newer documentation-only commits recording this acceptance. The accepted code remains the exact tested head above.

## Purpose

Phase 4A creates the smallest honest routing seam in the main RePi orchestrator without implementing remote-node transport or sandbox execution.

The browser package remains one deterministic registered tool inside the coding-agent process. Aizen is the agent/runtime that reasons and invokes tools. The orchestrator is a separate outer service that owns instance lifecycle and execution-target routing. The optional target envelope is removed before the unchanged inner `RpcCommand` reaches Aizen's local coding-agent child.

```text
Aizen / client
  -> orchestrator RPC envelope { target?, command }
     -> target validation and authorization
        -> current local coding-agent RPC child
           -> Aizen / AgentHarness
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

## Accepted Windows gate

Exact tested code head:

```text
8ef5f64fe735e406db2eeb1ef3cf4effc420d67d
```

Results:

```text
orchestrator tests 7
pass 7
fail 0
cancelled 0
skipped 0
orchestrator build passed
full monorepo check passed
Checked 893 files. No fixes applied.
shrinkwrap up to date
install lock up to date
browser smoke passed
working tree clean
```

The tests prove:

1. omitted target invokes the current local route exactly once;
2. explicit local forwards the unchanged inner command;
3. node and sandbox fail before local execution;
4. malformed, secret-bearing, endpoint, and scheduler-only fields fail closed;
5. node identifiers are bounded and credential-free;
6. the IPC router forwards the exact `RpcCommand` for omitted and explicit local targets;
7. non-local targets are rejected before instance lookup or RPC forwarding.

Phase 4A is frozen. Phase 4B node capability discovery and deterministic selection may begin, but remote execution transport remains out of scope until its own later gate.
