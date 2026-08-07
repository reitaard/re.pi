# Spotipy Chat serialization — Step 1

- Revision date: 2026-08-06
- Status: applied; Redis-backed serialization gate passed; Phase 1 unblocked
- Workflow: `Spotipy Fast Mode` (`HYRePy4buI9l4SEk`)

## Scope

- Deduplicate Telegram `update_id` values using workflow static data.
- Allow one active Chat LLM run per Telegram `chatId`.
- Keep one bounded pending/latest message while the active run is processing.
- Rate-limit the busy notification to one every five seconds per chat.
- Add `/cancel` handling for queued Chat input.
- After a Chat reply is sent, finalize the session and process the pending message through the same Chat path.
- Keep Fast mode, Spotify download, lyrics, and caption behavior unchanged.
- Replace the prototype static-data lock with an atomic per-chat Redis lock using the dedicated `n8n-redis` network. Redis is reached from n8n through the existing SSH credential and raw RESP/Lua commands; no Redis secret is stored here.

## Validation

- Redis-backed workflow update applied successfully to active workflow `HYRePy4buI9l4SEk`.
- Strict validation: 62 enabled nodes, 66 valid connections, 85 expressions, zero invalid connections. One known pre-existing strict-validator error remains: the instance-supported custom Telegram `editMessageCaption` operation is not recognized by the community schema. All new Redis nodes and connections validate.
- Smoke test passed: execution `79585` acquired and released the Redis lock and delivered a Chat reply.
- Overlap gate passed: executions `79600` and `79601` overlapped. `79601` received Redis admission `busy`, stored the latest message, and sent one busy notice. `79600` completed the first reply, atomically consumed the pending message, ran the dedicated pending Spotify lookup and Chat agent chain, delivered the pending reply, and completed successfully.
- Redis cleanup verified after the test: the per-chat lock, pending, and cancel keys were absent.
- Cancel regression passed with a pending message: execution `79611` atomically marked cancellation, returned `cancelled`, and delivered `Queued Chat input cleared.`; execution `79608` then released the lock without processing the pending message.
- An initial cancel probe used synthetic Telegram message IDs and was rejected by Telegram as `message to be replied not found`; the probe was discarded and repeated with a valid message reference.
- Fast mode and its custom caption operation were preserved. No download path was added to Chat.

## Test plan

1. Send `/chat`.
2. Send one ordinary Chat message and wait for the reply.
3. While a second LLM reply is processing, send three rapid messages, including a duplicate.
4. Verify only one busy notification is sent, the latest pending message is processed after the active reply, and replies remain attached to the correct Telegram messages.
5. Send `/cancel` while a pending message exists and verify the pending message is cleared.
6. Confirm `/fast` still switches mode and the Fast branch remains unchanged.

## Gate result

The Redis-backed serialization gate passed. Phase 1 facts and candidate selection may proceed. Downloads remain deferred until the facts/selection phase is implemented and tested.
