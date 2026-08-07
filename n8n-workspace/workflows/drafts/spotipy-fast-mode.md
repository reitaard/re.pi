# Spotipy Fast Mode

This draft mirrors the active deployed workflow. The validated status record is `workflows/validated/spotipy-fast-mode.md`.

- **Workflow:** `HYRePy4buI9l4SEk`
- **Status:** active and validated
- **Revision date:** 2026-08-07

The active workflow resolves Fast text requests through Spotify, presents exact YouTube selections, delivers M4A audio with Spotify metadata, retrieves LRCLIB lyrics with spotDL fallback, sends a rich HTML lyrics message, and cleans audio and lyrics jobs independently.

Final live validation: executions `79694` (Spotify search and ten YouTube choices) and `79695` (selected download, metadata, LRCLIB lyrics, Telegram delivery, and cleanup). Historical Chat route validation: execution `79675`.

Runtime diagnostics found that executions `79704` and `79708` stop at the unconnected `Route Fast input` Chat-message output. Temporary Webhook execution `79728` added that connection only for testing and successfully sent Telegram message `508` through `spotipy`; the temporary nodes and connection were then removed and the Telegram Trigger was restored.

The permanent Chat route connection remains pending: `Route Fast input` output 2 (`Chat message`) must connect to `Build Redis Chat admission`.

Credentials are referenced by name only: `spotipy`, `laxya`, and `vps-spotdl`.
