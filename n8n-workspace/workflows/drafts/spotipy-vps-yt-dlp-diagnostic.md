# Spotipy VPS yt-dlp diagnostic

- **Revision:** 2026-08-05
- **Status:** draft, inactive
- **Purpose:** Read-only inspection of the deployed spotDL/yt-dlp wrapper, cookie-pool metadata, and worker topology.
- **Credential:** `vps-spotdl` SSH private-key credential.
- **Validation:** workflow validation passed; manual read-only executions `79374`–`79379` completed. Production wrapper change deployed and runtime-validated on 2026-08-05.

## Findings

- The worker uses `/opt/spotdl/venv/bin/yt-dlp` `2026.07.04` and spotDL `4.5.2`.
- The shared cookie pool contains `cookies_001.txt`, `cookies_002.txt`, `cookies_010.txt`, and `cookies_011.txt`; no cookie contents were read. The newly added `001` and `002` files are worker-readable with group-only permissions and each passed a wrapper-equivalent yt-dlp simulation against a source that previously downloaded successfully.
- The wrapper rotates only for explicitly classified invalid-cookie or rate-limit failures. Generic `YT-DLP download error` is classified as `PROVIDER_ERROR` and terminates without trying the alternate cookie.
- Recent successful download `79369` used `cookies_011.txt`; failed downloads `79365` and `79371` used `cookies_010.txt` and terminated as `PROVIDER_ERROR`.
- The worker shares the `retakt-gluetun` network namespace, so its `127.0.0.1:4416` bgutil endpoint must be evaluated from that namespace, not the host.
- Deployed change: `PROVIDER_ERROR` now excludes the failed cookie for the current job and retries with an alternate cookie. It does not quarantine the cookie or reduce its health score. The worker image was rebuilt and `retakt-spotdl-worker` was restarted healthy; the deployed wrapper hash matches the source. An isolated runtime test using two temporary dummy cookies verified the first provider failure rotates to the other cookie. That test initially created the slot directory as root, blocking the worker account; the directory was corrected to UID/GID 1001 and a runtime write probe passed.
- Superseded: the earlier 3-minute provider-error cooldown and broad 5-minute cookie reuse cooldown were replaced by the fast-rotation policy below.
- Execution `79392` failed before audio delivery, so the caption code did not run. Its selected cookies `010`, `011`, and `002` each produced a transient `PROVIDER_ERROR` for the same YouTube source. A subsequent exact spotDL download of that source using `cookies_001.txt` succeeded. Direct probes also succeeded for `001`, `002`, and `010`; `011` reports expired YouTube account cookies.
- Deployed fast-rotation policy: healthy cookies are selected by least-recent use with no general cooldown. A provider error excludes only that cookie for 60 seconds; a 429/rate-limit excludes it for five minutes; invalid cookies remain quarantined through health scoring. The wrapper tries up to three cookies per request and yt-dlp performs one extractor retry and three fragment retries. The worker was rebuilt and recreated healthy. The isolated runtime test passed: it selects the least-recently-used cookie, skips a provider-cooled cookie, skips a rate-limited cookie, and confirms the one-retry configuration.
