# Spotipy Chat Mode Wiring

- Revision date: 2026-08-07
- Status: published and active
- Workflow: `Spotipy Fast Mode` (`HYRePy4buI9l4SEk`)
- Purpose: Maintain the `/chat` branch with grounded Spotify facts and candidate selection while preserving the existing Fast download flow.

## Scope

- `/chat` enables per-Telegram-chat Chat mode.
- Chat messages perform a read-only Spotify catalog lookup through `Spotipy Music Data Tool v1` (`2nRzAS4MCCB8uKMw`) before the agent runs.
- Natural Chat requests are reduced to a concrete Spotify subject when possible (for example, `Suggest a Radiohead track...` searches `Radiohead`).
- Track-like searches return up to five grounded Spotify candidates as Telegram inline buttons; no track is treated as selected until the user taps one.
- A selected `chatselect:<SpotifyID>` callback performs an exact read-only Spotify track lookup before the agent runs.
- Telegram message, caption, command, and callback parsing is normalized and preserves callback metadata for routing and replies.
- The normalized lookup evidence is injected into the AI Agent system context.
- Contextual follow-ups use the 15-message conversation memory as primary context and discard unrelated fresh catalog results.
- The existing `qwen3:8b` LM Studio model and Simple Memory node are reused.
- Memory is keyed by Telegram `chatId` and limited to 15 messages.
- Replies use Telegram HTML formatting, short 1–4-line responses, bounded links, and disabled link previews.
- Chat output sanitizes common Markdown bold/italic/code markers into safe Telegram HTML before delivery.
- The agent may use the connected Spotify search tool for an additional lookup when the prefetch evidence is insufficient.
- Redis-backed per-chat admission serializes normal messages and selection callbacks, with a bounded latest pending message, cancellation, and update deduplication.
- Chat mode has no download, playback, lyrics, or other expanded tools.
- `/fast` disables Chat mode and restores the existing Fast branch.

## Required credentials

- Existing Telegram credential: `spotipy`
- Existing Spotify credential is used only by the read-only data sub-workflow: `laxya`
- Existing OpenAI-compatible model credential: `LM studio`

## Validation

- The Spotify data sub-workflow passed strict validation with zero errors and was published first.
- `Spotipy Fast Mode` is active with 83 enabled nodes, 91 valid connections, and 132 validated expressions; strict validation reports 0 errors.
- The active graph contains the `/chat` route, grounded Spotify prefetch and exact-track lookup, candidate callbacks, LM Studio agent, 15-message chatId-keyed memory, bounded Spotify tool, Redis serialization, Telegram reply paths, Fast downloads, LRCLIB-first lyrics, fallback lyrics dispatch, rich HTML captions, and independent cleanup paths.
- The existing Fast branch remains enabled and connected.
- Final active workflow record is the deployed `HYRePy4buI9l4SEk` revision validated on 2026-08-07.
- Controlled webhook tests succeeded for mode switching, Spotify lookup, concise HTML reply delivery, candidate buttons, Redis completion, audio delivery, lyrics enrichment, and cleanup (including final Chat execution `79675`).
- The final Chat selection used a synthetic callback update through the webhook, but Telegram audio and lyrics delivery, metadata, LRCLIB lookup, Redis completion, and remote cleanup all completed successfully. A real client button tap remains optional additional evidence.
- The Spotify data sub-workflow passed an independent pin-data test (`79504`) and returned normalized evidence.
- The community validator still reports the pre-existing custom `editMessageCaption` operation as unsupported by its stock schema; n8n runtime publication succeeded with the instance's custom Telegram node support.
