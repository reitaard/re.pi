# Spotipy Fast Mode

- **Status:** validated and active
- **Revision date:** 2026-08-07
- **Active version:** `b16004ec-aefe-470f-ad40-ea4618754ba0`
- **Workflow:** `HYRePy4buI9l4SEk`
- **Purpose:** Telegram Chat and Fast music requests with Spotify metadata, YouTube source selection, M4A delivery, lyrics, and cleanup.

## Delivery flow

### Fast mode

1. Spotify resolves the request to a candidate track.
2. The VPS returns up to ten YouTube sources.
3. The selected YouTube source is downloaded as M4A through `spotdl-dispatch` using the `quick` operation.
4. Telegram receives audio with title, artist, duration, filename, and caption.
5. LRCLIB is queried first for lyrics; the `quickLyrics` fallback remains configured.
6. Telegram receives a second rich HTML message containing metadata, expandable lyrics, and the Spotify link.
7. Audio and lyric job directories are cleaned independently.

### Chat mode

1. Chat messages enter `Build Redis Chat admission` through `Route Fast input` output 2.
2. Track-like requests return grounded Spotify candidate buttons.
3. A `chatselect:<SpotifyID>` callback performs an exact Spotify lookup and sends grounded facts.
4. The selected-track facts reply is conditionally routed to the Fast YouTube search path.
5. Chat YouTube results use `chatfast:<YouTubeID>:<SpotifyID>` callbacks.
6. The callback enters the existing Fast `quick` download, transfer, metadata, lyrics, and cleanup chain.
7. Redis Chat completion runs after the shared Fast chain finishes. Ordinary Chat replies complete directly and do not start a download search.

The obsolete direct Spotify Chat-download chain was removed because it bypassed YouTube source selection and could fail with `No audio files were produced`.

## Credentials

- Telegram: `spotipy`
- SSH private key: `vps-spotdl`
- Spotify OAuth: `laxya`
- OpenAI-compatible model: `LM studio`

Only credential names are recorded here. No credential values are stored.

## Current validation

Strict validation passed after the Chat/Fast integration:

- 71 enabled nodes
- 79 valid connections
- 117 validated expressions
- 0 validation errors
- Remaining warnings are advisory error-handling and existing Telegram schema warnings

## Final live tests

- Ordinary Chat execution **79748** completed Spotify lookup, grounded reply, and Redis completion without starting the download search path.
- Chat selection/search execution **79751** sent grounded facts, ran the Fast YouTube search route, and returned ten `chatfast:` buttons.
- Chat download execution **79753** selected `8SbUC-UaAxE`, downloaded `Guns N' Roses - November Rain.m4a`, transferred a 9.01 MB M4A, sent audio message **521**, sent LRCLIB-enriched lyrics message **522**, and completed Fast and Redis cleanup.
- Temporary webhook executions were used only for isolation testing. The temporary webhook and payload nodes were removed before the final publish.
- The final active workflow has one real `Telegram Trigger` and no temporary test trigger.

## Legacy workflow

`Spotipy Music Companion v3` (`8Sviq9pjDE3GFdnF`) remains inactive and preserved for rollback. It is not the active delivery path.
