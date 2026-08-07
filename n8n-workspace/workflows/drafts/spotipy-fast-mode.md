# Spotipy Fast Mode draft mirror

- **Status:** synchronized with the validated active workflow
- **Revision date:** 2026-08-07
- **Active version:** `b16004ec-aefe-470f-ad40-ea4618754ba0`
- **Workflow:** `HYRePy4buI9l4SEk`

This JSON mirrors the final 71-node workflow. Chat messages enter Redis admission, selected Spotify tracks receive grounded facts, and selected Chat tracks reuse the Fast YouTube search and `quick` M4A download route through `chatfast` callbacks. Ordinary Chat replies do not start download search.

Strict validation: 79 valid connections, 117 expressions, 0 errors. Credentials are referenced by name only: `spotipy`, `laxya`, `vps-spotdl`, and `LM studio`.
