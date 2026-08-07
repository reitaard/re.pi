# Spotipy Fast Mode

This draft mirrors the active deployed workflow. The validated status record is `workflows/validated/spotipy-fast-mode.md`.

- **Workflow:** `HYRePy4buI9l4SEk`
- **Status:** active and validated
- **Revision date:** 2026-08-07

The active workflow resolves Fast text requests through Spotify, presents exact YouTube selections, delivers M4A audio with Spotify metadata, retrieves LRCLIB lyrics with spotDL fallback, sends a rich HTML lyrics message, and cleans audio and lyrics jobs independently.

Final live validation: executions `79694` (Spotify search and ten YouTube choices) and `79695` (selected download, metadata, LRCLIB lyrics, Telegram delivery, and cleanup). Chat route validation: execution `79675`.

Credentials are referenced by name only: `spotipy`, `laxya`, and `vps-spotdl`.
