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

## Installed Recode 0.81.6 startup checkpoint

Artifact: `recode-0.81.6-installed/summary.json`, exact installed Windows x64 binary from commit `6ef78822166cd15c3400bff30cb96c469ce663d3`. One warmup plus five measured runs per endpoint; cache state remains uncontrolled and no provider/model request was made.

| Endpoint | State | Median | Min–max |
|---|---|---:|---:|
| TUI input echo | configured | 4,035.8 ms | 3,897.5–4,264.0 ms |
| RPC `get_state` | configured | 3,889.8 ms | 3,849.4–4,196.4 ms |
| TUI input echo | isolated | 778.3 ms | 753.6–1,032.0 ms |
| RPC `get_state` | isolated | 891.0 ms | 762.0–1,099.4 ms |

These compiled-binary results are not directly ratio-compared with the earlier Node-source results because runtime and artifact topology differ. During compiled Maestro certification, its child launcher was found to reference obsolete `pi.exe`; source commit `5ea2bfdf6` corrects it to the Recode companion executable.

Corrected installed compiled Maestro artifact (`maestro-service.json`, commit `c86c809a19fb94c1cb23da403d51b4eed8cfd27a`):

| Endpoint | Result |
|---|---:|
| Service start to authenticated ready | 930.8 ms |
| Warm direct `list` median | 1.0 ms |
| Warm compiled CLI `list` median | 536.9 ms |
| One configured read-only session spawn | 4,335.6 ms |
| Warm interactive attachment | 2.4 ms |
| One-session aggregate working set | 555,147,264 bytes |
| Ten-session aggregate working set | 5,075,718,144 bytes |

Ten sessions were admitted. The aggregate Windows working-set topology includes shared mapped pages and one extension-launched descendant, so it is not a private-memory or Linux-PSS claim.

The exact jcode `v0.54.4` Windows x64 binary was reverified at SHA-256 `2572765b72f776ef4bfdd41efc055e0078910d60aae600aa35c6b1fcb5f54523`. Its five-run `--version` process median was 31.6 ms. An isolated daemon/session endpoint could not be established because the binary refuses to start without configured jcode credentials; no login, credential mutation or provider request was performed. See `jcode-v0.54.4-matched.json`. Therefore no daemon/session/resource ratio is claimed.

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

These are aggregate Windows working-set samples, not Linux PSS and not topology-neutral cross-product comparisons. An attributed clean-source repeat in `maestro-service-attributed.json` measured 533,008,384 bytes for one session and 3,505,524,736 bytes for eight. Each depth-1 session `node.exe` used approximately 300–458 MiB, while the depth-0 Maestro service used approximately 136 MiB in the eight-session sample. This confirms that most aggregate growth is in repeated session processes rather than the service owner, but does not yet identify which package/backend allocations are safely shareable.

## Capacity result

The requested ten-session measurement is blocked by production `maxLiveInstances = 8`. The isolated benchmark admitted eight sessions and rejected the ninth with `Maestro live instance limit reached`. The benchmark preserved the bound instead of weakening it to manufacture a ten-session result.

## Remaining matched work

- Repeat resource samples and add per-process attribution before changing ownership boundaries.
- Decide whether the production bound should remain eight or be raised for the ten-session roadmap gate; change it only with resource and safety evidence.
- Run exact jcode and upstream Pi probes at the same lifecycle endpoints and report unlike process topologies separately.
- A destructive cold-cache run still requires separate approval and a documented cache-control procedure.
- Active model-generation measurements require explicit approval for a fixed provider/model request; no paid request was made here.
