# Phase 4A — target contract and unchanged local route

Status: behavior gate passed on Windows at `cd47d55`; Biome normalization created two uncommitted source edits, so exact-head acceptance is pending one final committed rerun.

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

## Windows behavior gate

Tested source head before Biome normalization:

```text
cd47d55dafeb1fd59a141b945751d124db892be6
```

Observed Windows result:

```text
orchestrator tests: 7
pass: 7
fail: 0
orchestrator build: passed
full monorepo check: passed
browser smoke: passed
```

The root check reported:

```text
Checked 893 files. Fixed 2 files.
```

Only these files were modified by Biome:

```text
packages/orchestrator/src/request-handler.ts
packages/orchestrator/src/target-routing.ts
```

Because the root check uses `biome check --write`, the exact accepted head must include those deterministic edits and rerun the focused test, build, and full check with no remaining tracked changes.

The unrelated local `re.pi-packages/` nested checkout must not be committed. It may be hidden locally through `.git/info/exclude`.

## Final acceptance gate

```bash
npm --prefix packages/orchestrator test
npm --prefix packages/orchestrator run build
npm run check
git status --short
```

The target-routing tests must prove:

1. omitted target invokes the current local route exactly once;
2. explicit local forwards the unchanged inner command;
3. node and sandbox fail before local execution;
4. malformed, secret-bearing, endpoint, and scheduler-only fields fail closed;
5. node identifiers are bounded and credential-free;
6. omitted and explicit local IPC routes forward the exact same `RpcCommand`;
7. non-local IPC routes fail before instance lookup or RPC forwarding.

Phase 4B node capability discovery and selection must not begin until the exact committed formatting head passes this gate.