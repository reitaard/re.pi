# reddit-posts

- **Status:** published, active (`634a6cc8-cb67-4622-8688-7bddbf5f7fdc`)
- **Revision date:** 2026-08-04
- **Instance workflow ID:** `xrBvjuvnojsvrTTF`

## Purpose

Run an hourly Reddit intelligence scan. The workflow reads enabled subreddit sources, fetches new posts only, ignores comments, removes already-seen posts, uses the configured local model to keep only actionable intelligence, stores useful results, and sends a concise Telegram digest.

## Source configuration

Edit the n8n Data Table **Reddit Sources** (`QS7GVPN8CyuDvD9C`). Each row contains:

- `subreddit`: subreddit name without `r/`
- `enabled`: whether to scan it
- `focus`: source-specific intelligence focus supplied to the model
- `max_posts`: maximum posts requested for that source, capped at 25
- `min_score`: minimum Reddit score accepted for that source

Configured sources currently include:

- `LocalLLaMA`: enabled, `max_posts = 10`, `min_score = 0`
- `CrackWatch`: enabled, `max_posts = 25`, `min_score = 0`, restricted to author `voices38`

## Schedule and behavior

- Schedule: every hour at minute 0
- Sort: `new`
- Timeframe: `hour`
- Apify comment mode: `none`
- Persistent deduplication: n8n Data Table **Reddit Seen Posts** (`MB59virAuhnG7hqA`), keyed by `post_id`
- CrackWatch author condition: only `voices38`, case-insensitive, accepting `voices38`, `u/voices38`, or `/u/voices38`
- CrackWatch release override: a `voices38` post with release metadata such as NFO, platform, size, version, or similar is retained as a release even when the local model misclassifies it
- AI relevance threshold: `relevance_score >= 0.70`
- Digest limit: five highest-scoring useful posts
- Telegram formatting: plain text with labeled fields and separators; no emoji
- No Telegram message is sent when there are no new useful posts
- Apify and AI failures use a separate Telegram error route

Posts are recorded as seen before AI analysis so overlapping hourly runs cannot process the same post repeatedly.

## Stored results

Useful posts are stored in **Reddit Intelligence Results** (`ZmQ8rYc2iWGOFrcM`). The model classifies signals such as releases, updates, benchmarks, bug fixes, research, hardware, tools, techniques, and news. Opinions, rants, speculation, ordinary questions, memes, and low-information complaints are rejected.

## Required credentials

- `Apify temporary test` (`httpHeaderAuth`)
- `Zenith_reddit` (`telegramApi`)
- `LM studio` (`openAiApi`)

Credential values are not included in this artifact.

## Validation

- Runtime validation on 2026-08-04: 0 errors, 0 warnings before this revision.
- Published revision on 2026-08-04: added deterministic CrackWatch release handling, corrected the ignored-post expression syntax, and replaced the Telegram body with labeled plain-text sections and separators.
- Local parser smoke test: `Crimson.Desert-voices38` is promoted to `relevant: true`, `category: release`, and `relevance_score: 0.9` when the model returns an irrelevant decision.
- Validated topology: 23 nodes, 22 connections, one schedule trigger.
- The live source table contains two enabled rows: `LocalLLaMA` and `CrackWatch`.
- No production execution was run after this revision; the published workflow remains active for the next hourly schedule.

## Limitations

- The workflow depends on Apify, LM Studio, Telegram, and the named n8n credentials.
- A post marked seen before a model failure will not be analyzed again on a later hourly scan. The previously missed `Crimson.Desert-voices38` post is already marked seen and will not be resent automatically.
- Source configuration is stored remotely in n8n Data Tables rather than a local workspace file.
