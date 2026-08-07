# Spotipy workflow implementation checkpoint

**Status:** Fast and Chat routes active; Chat downloads reuse the validated Fast route
**Revision date:** 2026-08-07

## Active workflow

- **Name:** `Spotipy Fast Mode`
- **n8n workflow ID:** `HYRePy4buI9l4SEk`
- **Active version:** `b16004ec-aefe-470f-ad40-ea4618754ba0`
- **Active:** yes
- **Nodes:** 71 enabled
- **Strict validation:** 0 errors, 79 valid connections, 117 expressions validated

## Implemented behavior

- Fast text requests resolve through Spotify before YouTube source selection.
- Chat messages reach the Chat admission path from `Route Fast input` output 2.
- Chat track-like requests return Spotify candidate buttons and exact-track grounded facts.
- Selected Chat tracks use the Fast YouTube source-search and `chatfast` callback route.
- Chat downloads reuse Fast `quick` download, M4A transfer, Telegram audio delivery, metadata, LRCLIB-first lyrics, fallback lyrics, and independent cleanup.
- Ordinary Chat replies are conditionally separated from the Chat download search path and complete Redis normally.
- Numeric timestamp job IDs use a per-execution sequence suffix.
- No credential values or secret exports are stored in workflow artifacts.
- The old direct Spotify Chat-download chain was removed after it reproduced `No audio files were produced`.

## Final live evidence

- **Execution 79748:** ordinary Chat lookup and grounded reply completed with Redis cleanup; no YouTube search was started.
- **Execution 79751:** selected Spotify candidate sent grounded facts and returned ten YouTube `chatfast` choices.
- **Execution 79753:** selected `8SbUC-UaAxE` downloaded successfully through Fast `quick`; Telegram audio message **521** contained a 9.01 MB `Guns N' Roses - November Rain.m4a`, and lyrics message **522** contained metadata, expandable LRCLIB lyrics, and the Spotify link. Fast job cleanup and Chat Redis completion succeeded.
- Temporary webhook executions were used for isolation only. The temporary webhook and payload nodes were removed before final publication.

## Remaining work

No workflow-routing work remains for this change. Repository artifact synchronization, secret checks, explicit staging, commit, and Topic 58 workspace copying remain separate maintenance steps.

## Legacy workflow status

`Spotipy Music Companion v3` (`8Sviq9pjDE3GFdnF`) is inactive and preserved for rollback. Legacy downloader workflows remain preserved inactive where applicable.
