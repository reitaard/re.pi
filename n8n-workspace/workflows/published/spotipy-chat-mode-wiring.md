# Spotipy Chat Mode Wiring

- Revision date: 2026-08-07
- Status: published and active
- Active version: `b16004ec-aefe-470f-ad40-ea4618754ba0`
- Workflow: `Spotipy Fast Mode` (`HYRePy4buI9l4SEk`)
- Purpose: Grounded Chat facts with candidate selection while reusing the validated Fast download path.

## Routing

- `/chat` enables per-Telegram-chat Chat mode.
- `Route Fast input` output 2 (`Chat message`) connects to `Build Redis Chat admission`.
- Chat messages perform a read-only Spotify lookup before the agent runs.
- Track-like searches return up to five Spotify candidates as `chatselect:<SpotifyID>` buttons.
- A selected Spotify track is verified exactly and produces a grounded facts reply.
- `Route Chat download search` prevents ordinary Chat replies from entering the download path.
- Selected-track replies enter `Send Chat loading songs` and `Build Chat YouTube search request`.
- The existing Fast `Search ten YouTube results`, `Format Fast results`, and `Send Fast results` nodes return `chatfast:<YouTubeID>:<SpotifyID>` buttons.
- `chatfast` callbacks enter the existing Fast `quick` download path, including transfer, audio delivery, LRCLIB/fallback lyrics, metadata, and cleanup.
- `Route Fast Chat completion` releases the Chat Redis lock after the shared Fast chain completes.
- `/fast` disables Chat mode and restores the normal Fast branch.

## Grounding and serialization

- The normalized Spotify evidence is injected into the AI Agent system context.
- Exact-track facts are limited to catalog evidence.
- Chat memory is keyed by Telegram `chatId` and limited to 15 messages.
- Redis admission serializes normal messages and Spotify candidate callbacks.
- Chat download lock state is carried to the later `chatfast` callback through workflow static data with bounded expiry.
- Update deduplication and pending-message handling remain enabled.

## Credentials

- Telegram: `spotipy`
- Spotify data workflow credential: `laxya`
- OpenAI-compatible model credential: `LM studio`
- VPS SSH credential: `vps-spotdl`

Only credential names are recorded here. No secret values are stored.

## Validation and evidence

Strict validation of the final active workflow reports:

- 71 enabled nodes
- 79 valid connections
- 117 validated expressions
- 0 errors

Live evidence:

- Execution **79748**: ordinary Chat reply completed through Redis without starting YouTube search.
- Execution **79751**: Spotify candidate selection sent grounded facts and returned ten Fast-compatible YouTube choices.
- Execution **79753**: `chatfast` selection downloaded and delivered a 9.01 MB M4A as Telegram audio message **521**, delivered LRCLIB-enriched lyrics as message **522**, and completed remote and Redis cleanup.
- Temporary webhook nodes used during isolation testing were removed before the final publish.

The obsolete direct Spotify Chat-download nodes are not part of the active graph. The Chat download feature remains enabled through the shared Fast route.
