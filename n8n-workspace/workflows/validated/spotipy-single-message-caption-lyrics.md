# Spotipy single-message caption lyrics

- **Workflow:** `Spotipy Music Companion v3` (`8Sviq9pjDE3GFdnF`)
- **Revision:** 2026-08-05
- **Status:** validated and deployed
- **Purpose:** Deliver each downloaded audio file as one Telegram message, with compact lyrics in its caption.

## Intended behavior

- Remove the `Download started` and `Download complete` messages.
- Remove the separate automatic rich-lyrics message and its SSH helper invocation.
- Strip LRC timestamp tokens before caption rendering.
- Send lyrics inside Telegram's HTML `<blockquote expandable>` caption element.
- Style the title as monospace, the artist as bold, and the album as bold italic.
- Render a compact metadata-based Facts line in italics after the album: `[year · track/total · label]`; no LLM is used yet.
- Keep the rendered caption within Telegram's 1,024-character limit. Preserve as much text as possible at a word or line boundary, then append `…`.
- Preserve the audio title, artist, album, Spotify link, duration, and filename metadata.
- Keep download-failure messages and file cleanup unchanged.

## Known limitation

Telegram permits a maximum 1,024 caption characters after entity parsing. The expandable quote provides a compact Show More presentation, but it does not raise that protocol limit. Lyrics exceeding the limit are intentionally truncated rather than sent as a second message.

## Validation

- The partial-update preview passed before deployment.
- The deployed workflow passed strict validation: 0 errors, 19 enabled nodes, 20 valid connections, and 26 expressions validated.
- A live `/song` request remains the final visual confirmation that the Telegram client renders the expandable caption as expected.
