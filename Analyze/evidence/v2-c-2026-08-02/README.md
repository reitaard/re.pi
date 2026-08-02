# V2-C Recode baseline — 2026-08-02

## Scope

Local Windows x64 Node 26.5.0 baseline. All runs use clean committed source, make no provider/model request, and classify cache state as **uncontrolled**. These results are not destructive cold-cache claims.

## Startup medians

| Endpoint | State | Median | Min–max |
|---|---|---:|---:|
| RPC `get_state` | configured | 3,446.5 ms | 3,261.1–3,675.1 ms |
| TUI input echo | configured | 3,307.3 ms | 3,242.6–3,377.1 ms |
| RPC `get_state` | isolated | 1,450.3 ms | 1,435.1–1,463.2 ms |
| TUI input echo | isolated | 1,500.6 ms | 1,481.5–1,578.1 ms |

Configured RPC extension loading had a 1,988 ms median. Largest measured contributors were Browser/OpenClaw entry (720 ms), Open Provider factory (654 ms), web-access module (439 ms), and MCP adapter module (192 ms). These values are measurements, not yet an optimization decision.

Startup artifacts use commit `79b9855c6e9f6203af512c0d41c554b0f28d61d7`, version `0.81.5`, and report a clean working tree.

## Maestro service and session endpoints

Artifact: `maestro-service.json`, commit `b6050d6652c417ca1a829c273537f9e30a18db0b`, clean working tree.

| Endpoint | Result |
|---|---:|
| Isolated service start to authenticated ready | 1,802.3 ms |
| Warm `list` control request median | 1.2 ms |
| Warm `list` control request p90 | 1.5 ms |
| One read-only session spawn | 3,845.6 ms |
| Warm interactive attachment | 1.7 ms |

Windows process-tree working-set samples:

| Topology | Processes | Aggregate RSS |
|---|---:|---:|
| Service plus one read-only session | 3 | 539,320,320 bytes (514.3 MiB) |
| Service plus maximum admitted eight sessions | 10 | 3,546,009,600 bytes (3,381.7 MiB) |

These are aggregate Windows working-set samples, not Linux PSS and not topology-neutral cross-product comparisons. They show material per-session duplication and justify measuring package/backend ownership before selecting O9 changes.

## Capacity result

The requested ten-session measurement is blocked by production `maxLiveInstances = 8`. The isolated benchmark admitted eight sessions and rejected the ninth with `Maestro live instance limit reached`. The benchmark preserved the bound instead of weakening it to manufacture a ten-session result.

## Remaining matched work

- Repeat resource samples and add per-process attribution before changing ownership boundaries.
- Decide whether the production bound should remain eight or be raised for the ten-session roadmap gate; change it only with resource and safety evidence.
- Run exact jcode and upstream Pi probes at the same lifecycle endpoints and report unlike process topologies separately.
- A destructive cold-cache run still requires separate approval and a documented cache-control procedure.
- Active model-generation measurements require explicit approval for a fixed provider/model request; no paid request was made here.
