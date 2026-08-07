# Spotipy Fast Mode

- **Status:** validated and active
- **Revision date:** 2026-08-07
- **Workflow:** `HYRePy4buI9l4SEk`
- **Purpose:** Telegram Fast downloads with Spotify metadata, exact YouTube selection, M4A delivery, rich lyrics, and remote cleanup.

## Delivery flow

1. Spotify resolves the text request to a candidate track and stores normalized metadata.
2. The VPS returns up to ten YouTube sources.
3. The selected source is downloaded as M4A through `spotdl-dispatch`.
4. Telegram receives audio with title, artist, duration, filename, and a short caption.
5. LRCLIB is queried first for lyrics; the spotDL `quickLyrics` fallback remains configured.
6. Telegram receives a second rich HTML message containing metadata, expandable lyrics, and the Spotify link.
7. Audio and lyric job directories are cleaned independently.

## Credentials

- Telegram: `spotipy`
- SSH private key: `vps-spotdl`
- Spotify OAuth: `laxya`

Only credential names are recorded here. No credential values are stored.

## Current validation

Strict validation passed after the final enrichment changes:

- 83 enabled nodes
- 91 valid connections
- 132 validated expressions
- 0 validation errors
- Remaining warnings are advisory error-handling suggestions from the validator

## Final live tests

- Search execution **79694** resolved `Glory Box` to Spotify metadata and returned ten YouTube choices with cached track metadata.
- Selection execution **79695** delivered `Glory Box` as `Portishead - Glory Box.m4a`.
- Telegram audio message **502** reported duration `308`, title `Glory Box`, and performer `Portishead`.
- Telegram lyrics message **503** used LRCLIB lyrics, expandable HTML formatting, `[1994 · 11/11]`, and the Spotify link.
- `Cleanup Fast job` and `Cleanup Fast lyrics job` both succeeded; the VPS job directory was removed.
- Chat route final test **79675** also succeeded with audio message **495** and lyrics message **496**.
- Real Telegram Chat message execution **79704** correctly parsed `Tell me something about the song purple rain` but stopped at `Route Fast input`; the Chat-message output was not connected to the Chat admission path, so no reply node ran.
- The subsequent `hey` execution **79708** stopped at the same unconnected Chat-message output.
- Temporary Webhook diagnostic execution **79728** added the missing route only for testing, completed Spotify lookup, sent Telegram message **508** through credential `spotipy`, and completed Redis cleanup. The temporary Webhook, payload, route connection, and reply override were removed afterward; the Telegram Trigger was restored and republished.

## Known active issue

Static validation still reports 0 errors, but the active graph is missing the permanent connection from `Route Fast input` output 2 (`Chat message`) to `Build Redis Chat admission`. Add that connection before treating normal Telegram Chat mode as fixed, then rerun a real Telegram message test with reply-to behavior enabled.

The `/fast` confirmation probe **79693** used a fabricated Telegram message id and failed only because Telegram could not reply to that nonexistent message. The actual search and selected-download tests completed successfully.

## Legacy workflow

`Spotipy Music Companion v3` (`8Sviq9pjDE3GFdnF`) remains inactive and preserved for rollback. It is not the active delivery path.
