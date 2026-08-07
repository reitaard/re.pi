# Spotipy Music Companion v3

- **n8n workflow ID:** `8Sviq9pjDE3GFdnF`
- **Status:** Active; strict MCP validation passed on 2026-08-05 (0 errors, 20 valid connections, 26 expressions validated).
- **Purpose:** Single Telegram workflow for Spotify search, VPS-backed audio downloads, Telegram delivery, and remote-file cleanup.

## Supported user input

- `/help` or `/start`
- `/search <artist or track>`
- `/song <track query or Spotify link>`; free-text song queries are resolved through Spotify before dispatch so metadata and lyrics are retained
- `/album <Spotify album link>`
- `/playlist <Spotify playlist link>`
- A direct Spotify track, album, or playlist link

For each delivered track, the bot sends one audio message with a timestamp-free expandable lyric caption. Captions render the title in monospace, artist in bold, album in bold italic, then an italic metadata line such as `[2015 · 8/11 · Acid Ghost inc.]`. Lyrics remain in their own expandable block and use as much of Telegram's 1,024-character limit as possible before appending `…`. No LLM is used for Facts yet. It sends neither download-started nor download-complete status messages. The `/lyrics` route remains reserved for future design.

## Required credentials

- Telegram API: `spotipy`
- Spotify OAuth2: `laxya`
- SSH private key: `vps-spotdl`

No credential values are stored in this file.

## Runtime dependencies

The VPS must retain these existing privileged commands:

- `/usr/local/sbin/spotdl-dispatch`
- `/usr/local/sbin/spotdl-cleanup`

## Validation and test state

Static validation passed after adding the free-text Spotify resolution path. The Telegram trigger has been cut over from the legacy `spotdl-telegram` workflow. The remaining live check is an authorized `/song Overthinking — Acid Ghost` request; inspect that execution to confirm Spotify resolution, Facts, and lyric caption delivery.

## Superseded workflows

The prior Telegram gateway, async submit, async delivery, legacy downloader, Spotify evidence webhook, and music-data sub-workflow are inactive. They were preserved for rollback; none were deleted.
