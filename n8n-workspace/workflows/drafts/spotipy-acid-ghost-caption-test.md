# Spotipy Acid Ghost caption-edit webhook test

- **Status:** completed live webhook test; workflow disabled after execution `79492`
- **Purpose:** Send `Epilogue — Acid Ghost` as one audio message, retrieve lyrics through LRCLIB, then edit the same audio caption through Telegram's `editMessageCaption` endpoint.
- **Trigger:** temporary POST webhook at `spotipy-odoriko-send-once`; workflow is disabled after the test.
- **Credentials by name only:** `vps-spotdl` (SSH), `spotipy` (Telegram API).
- **Result:** LRCLIB returned 1,297 lyric characters in 485 ms; Telegram edited audio message `385` in 258 ms; remote job cleanup succeeded.
- **Fallback note:** this test proves the fast LRCLIB path and the caption-edit operation. The active Fast workflow uses the existing spotDL provider chain only when LRCLIB returns no lyrics.
- **Revision date:** 2026-08-06
