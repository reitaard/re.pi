# reddit-posts

- **Status:** published, active (`53532db0-b305-4b07-bad3-12c9d0982f1b`)
- **Revision date:** 2026-08-04
- **Instance workflow ID:** `xrBvjuvnojsvrTTF`

## Purpose

Run a Reddit intelligence scan every 30 minutes. The workflow reads enabled subreddit sources, fetches new posts only, ignores comments, removes already-seen posts, uses Qwen 3.5 4B with deterministic post-quality guards to keep actionable intelligence, stores useful results, and sends a formatted Telegram digest.

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

- Schedule: every 30 minutes, UTC
- Sort: `new`
- Timeframe: `hour`
- Apify comment mode: `none`
- Persistent deduplication: n8n Data Table **Reddit Seen Posts** (`MB59virAuhnG7hqA`), keyed by `post_id`
- CrackWatch author condition: only `voices38`, case-insensitive, accepting `voices38`, `u/voices38`, or `/u/voices38`
- CrackWatch release override: a `voices38` post with release metadata such as NFO, platform, size, version, or similar is retained as a release even when the local model misclassifies it
- AI relevance threshold: `relevance_score >= 0.70`
- Digest limit: five highest-scoring useful posts
- Telegram formatting: HTML-safe bold headings, italic summaries, monospace metadata, clickable title/subreddit/source links, labeled fields, and separators; no emoji
- Telegram digest and error delivery failures stop the workflow instead of being masked
- Qwen 3.5 4B output is normalized to the allowed categories and obvious advice, opinion, speculation, placeholder, and low-information posts are rejected deterministically after model evaluation
- No Telegram message is sent when there are no new useful posts
- Apify and AI failures use a separate Telegram error route

Posts are recorded as seen before AI analysis so overlapping runs cannot process the same post repeatedly.

## Stored results

Useful posts are stored in **Reddit Intelligence Results** (`ZmQ8rYc2iWGOFrcM`). The model classifies signals such as releases, updates, benchmarks, bug fixes, research, hardware, tools, techniques, and news. Opinions, rants, speculation, ordinary questions, memes, and low-information complaints are rejected.

## Required credentials

- `Apify temporary test` (`httpHeaderAuth`)
- `Zenith_reddit` (`telegramApi`)
- `LM studio` (`openAiApi`)

Credential values are not included in this artifact.

## Validation

- Strict runtime validation on 2026-08-04: 0 errors, 4 advisory warnings.
- Historical Gemma evaluation on executions `79312` and `79313`: 18/18 model responses were returned and parsed, but the 4B model showed a relevance bias. Several ordinary questions, opinions, speculation, and low-information posts were incorrectly marked useful; it also emitted non-schema labels such as `benchmarks` and `model_update`, and misstated an 8% RTX 5090 result as an 8% P40 result when the post reported 4% on the P40.
- The previously configured `qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2` returned `404 model not found` in execution `79318`; the exact model ID from the LM Studio list is `qwen3.5:4b`.
- Exact-model availability test: execution `79320` completed successfully in 60.981 seconds and returned `QWEN35_4B_ONLINE` through the active Cue webhook.
- Isolated benchmark workflow `N5OkesrJsi8n02BC` tested the same representative post: `qwen3.5:4b` returned valid JSON and the correct relevant decision in execution `79326` (119.582 seconds); Gemma returned an empty response and invalid schema in execution `79327` (244.618 seconds). This is an initial screen, not a final quality ranking.
- Historical `qwen3:8b` execution `79287` completed the model node but produced empty AI-agent output. Other listed models still require the same controlled test.
- Production status: `reddit-posts` now uses `qwen3.5:4b` through `LM studio`. Runtime validation passed with 0 errors and 1 existing expression warning. The isolated benchmark remains inactive.
- Published revision on 2026-08-04: added a stricter classifier prompt, deterministic low-signal guards, category normalization, exact-number instructions, HTML-formatted Telegram output, clickable title/subreddit/source links, and ellipsis-based truncation below Telegram's message limit.
- Controlled execution `79314` completed successfully, fetched 25 Reddit posts, and found no new unseen posts; the Telegram node was not reached because deduplication returned zero items.
- Local parser smoke test: `Crimson.Desert-voices38` is promoted to `relevant: true`, `category: release`, and `relevance_score: 0.9` when the model returns an irrelevant decision.
- Validated topology: 23 nodes, 22 connections, one schedule trigger.
- The live source table contains two enabled rows: `LocalLLaMA` and `CrackWatch`.

## Limitations

- The workflow depends on Apify, LM Studio, Telegram, and the named n8n credentials.
- A post marked seen before a model failure will not be analyzed again on a later 30-minute scan. The previously missed `Crimson.Desert-voices38` post is already marked seen and will not be resent automatically.
- Source configuration is stored remotely in n8n Data Tables rather than a local workspace file.
