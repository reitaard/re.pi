# Spotipy quick YouTube mode

- **Status:** validated and deployed
- **Revision date:** 2026-08-06
- **Purpose:** Adds `/quick <artist - track>` to Spotipy Music Companion v3 for a low-latency first-result YouTube audio download.
- **Inputs:** Telegram `/quick` command.
- **Credentials:** `vps-spotdl` (SSH private key), `spotipy` (Telegram API). No credentials are stored in this artifact.
- **Fast path:** uses `ytsearch1:` with yt-dlp's `android_vr` player client, downloads the selected first M4A audio stream without Spotify metadata, lyrics, artwork, ID3 tagging, or source scoring, then uses the existing Telegram delivery path.
- **Validation:** VPS direct quick-mode benchmark completed in 3,383 ms for a 3.99 MiB YouTube audio source. Active workflow validation passed: 27 nodes, 30 valid connections, 39 expressions, zero errors/warnings.
- **Limitations:** `/quick` chooses the first YouTube result and therefore trades canonical Spotify matching, lyrics, and rich metadata for speed. Existing `/song`, Spotify links, albums, playlists, and search behavior remain unchanged.
