# Spotipy free-text Spotify resolution

- **n8n workflow ID:** `8Sviq9pjDE3GFdnF`
- **Status:** Validated and deployed on 2026-08-05
- **Purpose:** Resolve `/song <artist/title>` through Spotify before invoking the existing VPS dispatcher, preserving Spotify metadata and lyrics.

## Behavior

- Spotify-link requests continue directly to the dispatcher.
- `/song` and `/spotify` requests without a link search Spotify for up to five tracks and select the first verified Spotify result.
- The selected Spotify URL replaces the free-text query in the dispatch payload.
- If Spotify returns no usable result, the existing Telegram failure reply is used.

## Required credentials

- Spotify OAuth2: `laxya`
- Existing Telegram and SSH credentials remain unchanged.

## Validation

Strict MCP validation passed with 19 enabled nodes, 20 valid connections, 26 expressions validated, and 0 errors. A live Telegram-triggered no-URL test remains required because the MCP test runner cannot invoke Telegram Trigger workflows directly.
