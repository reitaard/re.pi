# Automatic rich lyrics for Spotipy Fast Mode

- **Status:** validated and deployed
- **Revision date:** 2026-08-07
- **Target workflow:** `HYRePy4buI9l4SEk` — Spotipy Fast Mode
- **Purpose:** Send the established rich lyric presentation after every successful audio delivery when lyrics are available.

## Behaviour

- Sends audio immediately with its short caption and metadata.
- Retrieves LRCLIB lyrics first and uses the spotDL `quickLyrics` fallback when LRCLIB has no result.
- Removes standard LRC timestamps before presentation.
- Sends a second HTML message with title, artist, album, bounded release/track facts, expandable lyrics, and the Spotify link.
- Keeps the lyric path independent from audio cleanup.
- Sends no extra lyrics message when no lyrics are returned.
- Uses Telegram-safe formatting and a 1,024-character caption budget.
- Does not add or reserve a `/lyrics` command.

## Credentials

- Telegram: `spotipy`
- SSH private key: `vps-spotdl`

No credential values are stored in this file.

## Validation

Strict validation of the active workflow passed with 83 enabled nodes, 91 valid connections, 132 expressions, and 0 errors.

Final Fast execution **79695** delivered audio message **502** and rich lyrics message **503** for `Glory Box — Portishead`. LRCLIB succeeded and both cleanup stages completed. Final Chat execution **79675** delivered audio message **495** and lyrics message **496** with the same enrichment behavior.

## Known limitations

Lyrics are provider-supplied. This change does not add Whisper or GPT transcription. The old v3 workflow remains inactive for rollback.
