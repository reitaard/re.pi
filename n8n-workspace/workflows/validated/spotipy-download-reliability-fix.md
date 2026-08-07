# Spotipy download reliability fix

- Status: validated and deployed
- Revision date: 2026-08-05
- Active workflow: `Spotipy Music Companion v3` (`8Sviq9pjDE3GFdnF`)
- Purpose: bypass fragile VPS SpotipyFree metadata resolution, route direct Spotify tracks through official n8n Spotify OAuth, and repair the VPS YouTube worker health dependency.

## Changes

1. VPS `/opt/yt-downloader/y0utubed/system/docker-compose.yml`
   - Replaced the stale hardcoded Redis address with `retakt-redis` in the YouTube worker environment and healthcheck.
   - Recreated the worker; it reports healthy.
   - Existing compose backup retained on the VPS.

2. VPS `/opt/spotdl/runner.py`
   - Added `metadataQuery` handling.
   - Artist/title metadata is saved through spotDL search rather than SpotipyFree's private Spotify client-token endpoint.
   - Official Spotify URL metadata remains attached when supplied.
   - Python compilation, container rebuild, and worker healthcheck passed.

3. n8n workflow
   - Free-text Spotify resolution now sends `metadataQuery` and artist/title queries.
   - Direct Spotify track links now use the official Spotify `Get Track` node before the same resolver.
   - Direct-track ID extraction uses URL splitting rather than a fragile regex literal.
   - Download requests now receive a temporary Telegram reply stating `Downloading… finding a source`, followed by `Preparing audio…` after the VPS download completes; it is deleted after success or failure. Percentages are intentionally omitted because the dispatcher does not expose live byte-level progress.
   - Audio remains a fresh non-reply message; the temporary status is the only extra message.
   - n8n validation: 27 enabled nodes, 30 valid connections, 39 expressions, 0 errors, 0 warnings.

## Verification

- One-time Odoriko webhook execution `79429` completed successfully.
- Telegram sent exactly one audio message, message ID `330`, to the Creator chat.
- Audio: `Vaundy-odoriko.mp3`, 3.78 MB, 228 seconds.
- Post-deployment runner verification produced `track-metadata.spotdl` with Vaundy/odoriko metadata and 1,286 lyric characters; its temporary job was cleaned up.
- One-time webhook workflow was deactivated and deleted after the send.
- No cookie files were modified.
