# Spotipy download webhook probe

- **Workflow ID:** `aPffZXf2zrk4Ak7M`
- **Status:** validated; inactive after controlled probe
- **Purpose:** Isolate the VPS spotDL download path from Telegram delivery before restoring or changing Telegram behavior.
- **Input:** POST body with `spotifyUrl` set to one Spotify track URL.
- **Output:** Sanitized JSON with status, job ID, exit code, file count, basic track metadata, lyric availability, and error summary.
- **Credential:** `vps-spotdl` SSH private key.
- **External effects:** The probe downloads one audio file to a disposable job directory. It sends no Telegram messages. Job files are retained temporarily for inspection and should be cleaned after a successful test.

## Validation result

- Strict validation passed: 0 errors, 4 enabled nodes, 3 valid connections, and 1 expression validated.
- Controlled webhook test passed for the previously failing `Do I Wanna Know?` Spotify track: status `completed`, one file, lyrics available, and no Telegram delivery.
- It selected `cookies_001.txt` on the first attempt and downloaded successfully in 25.969 seconds after metadata resolution.
- The disposable job directory was removed after verification.

## Next step

The active Telegram workflow already calls the same VPS dispatcher. The webhook result confirms its download path; a `/song` request is the remaining Telegram-caption test. The public probe was deactivated after the successful test.
